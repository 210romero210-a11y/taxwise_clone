import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { evaluateCondition } from "./validationRules";
import { getActiveRules } from "./validationRules";

export const getDiagnosticsForReturn = query({
    args: { returnId: v.id("returns") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("diagnostics")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .collect();
    },
});

// Alias used by AI agent tools
export const getForReturn = getDiagnosticsForReturn;

export const clearDiagnostics = internalMutation({
    args: { returnId: v.id("returns"), instanceId: v.id("formInstances") },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("diagnostics")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .filter((q) => q.eq(q.field("instanceId"), args.instanceId))
            .collect();

        for (const d of existing) {
            await ctx.db.delete(d._id);
        }
    },
});

// Public mutation to clear all diagnostics for a return
export const clearAllDiagnostics = mutation({
    args: { returnId: v.id("returns") },
    handler: async (ctx, args) => {
        // Fetch all diagnostics for the return in a single query
        const allDiagnostics = await ctx.db
            .query("diagnostics")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .collect();
        
        // Build a map of instanceId -> diagnostics
        const byInstance = new Map<string, typeof allDiagnostics>();
        for (const d of allDiagnostics) {
            const existing = byInstance.get(d.instanceId) || [];
            existing.push(d);
            byInstance.set(d.instanceId, existing);
        }
        
        // Get all form instances for this return
        const instances = await ctx.db
            .query("formInstances")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .collect();
        
        // Delete diagnostics for each instance from the pre-fetched map
        for (const instance of instances) {
            const instanceDiags = byInstance.get(instance._id) || [];
            for (const d of instanceDiags) {
                await ctx.db.delete(d._id);
            }
        }
    },
});

export const addDiagnostic = internalMutation({
    args: {
        returnId: v.id("returns"),
        instanceId: v.id("formInstances"),
        fieldKey: v.string(),
        message: v.string(),
        severity: v.string(), // "Error", "Warning", "Info"
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("diagnostics", {
            returnId: args.returnId,
            instanceId: args.instanceId,
            fieldKey: args.fieldKey,
            message: args.message,
            severity: args.severity,
        });
    },
});

// =============================================================================
// BILINGUAL DIAGNOSTICS SUPPORT
// =============================================================================

// Diagnostic message translation mapping
const diagnosticKeyMap: Record<string, string> = {
  "SSN is required": "ERR_SSN_MISSING",
  "SSN must be 9 digits": "ERR_SSN_INVALID",
  "Name is required": "ERR_NAME_REQUIRED",
  "Address is incomplete": "ERR_ADDRESS_INCOMPLETE",
  "Income cannot be negative": "ERR_INCOME_NEGATIVE",
  "Invalid routing number": "ERR_BANK_ROUTING_INVALID",
  "EFIN required": "ERR_EFIN_REQUIRED",
};

/**
 * Get diagnostics with translations for a specific locale
 * This enables bilingual diagnostic display
 */
export const getDiagnosticsForReturnWithTranslations = query({
    args: { returnId: v.id("returns"), locale: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const diagnostics = await ctx.db
            .query("diagnostics")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .collect();
        
        // Get translations for diagnostics category
        const translations = args.locale ? await ctx.db
            .query("translations")
            .withIndex("by_locale_category", (q) => 
                q.eq("locale", args.locale!).eq("category", "diagnostics")
            )
            .collect() : [];
        
        const translationMap = new Map<string, string>();
        for (const t of translations) {
            translationMap.set(t.key, t.value);
        }
        
        // Map diagnostics to include translated messages
        return diagnostics.map(d => {
            // Find translation key for this message
            let translatedMessage = d.message;
            
            // Check if message matches a known diagnostic key
            const knownKey = diagnosticKeyMap[d.message];
            if (knownKey && translationMap.has(knownKey)) {
                translatedMessage = translationMap.get(knownKey)!;
            } else {
                // Try to find by partial match
                for (const [msg, key] of Object.entries(diagnosticKeyMap)) {
                    if (d.message.includes(msg) && translationMap.has(key)) {
                        translatedMessage = translationMap.get(key)!;
                        break;
                    }
                }
            }
            
            return {
                ...d,
                message: translatedMessage,
                originalMessage: d.message,
            };
        });
    },
});

/**
 * Validate and add diagnostic with automatic translation support
 */
export const addDiagnosticWithValidation = internalMutation({
    args: {
        returnId: v.id("returns"),
        instanceId: v.id("formInstances"),
        fieldKey: v.string(),
        diagnosticKey: v.string(), // Pre-defined key for translation lookup
        severity: v.string(),
        locale: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Get translated message if locale provided
        let message = args.diagnosticKey;
        
        if (args.locale) {
            const translation = await ctx.db
                .query("translations")
                .withIndex("by_locale_category", (q) => 
                    q.eq("locale", args.locale!).eq("category", "diagnostics")
                )
                .filter((q) => q.eq(q.field("key"), args.diagnosticKey))
                .first();
            
            if (translation) {
                message = translation.value;
            }
        }
        
        return await ctx.db.insert("diagnostics", {
            returnId: args.returnId,
            instanceId: args.instanceId,
            fieldKey: args.fieldKey,
            message,
            severity: args.severity,
        });
    },
});

// =============================================================================
// METADATA-DRIVEN VALIDATION INTEGRATION
// =============================================================================

/**
 * Run metadata-driven validation for a return's form
 * Uses validationRules table instead of hardcoded logic
 * 
 * @param returnId - The return ID to validate
 * @param formCode - The form code (e.g., "1040")
 * @param year - Tax year
 * @param locale - Optional locale for messages (en/es)
 * @returns Count of errors and warnings
 */
export const runMetadataValidation = mutation({
    args: {
        returnId: v.id("returns"),
        formCode: v.string(),
        year: v.number(),
        locale: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Get all active validation rules for this form and year
        const rules = await ctx.db
            .query("validationRules")
            .withIndex("by_formCode_year", (q) => 
                q.eq("formCode", args.formCode).eq("year", args.year)
            )
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect();
        
        if (rules.length === 0) {
            return {
                errorCount: 0,
                warningCount: 0,
                totalRules: 0,
                message: "No active validation rules found for this form",
            };
        }
        
        // Get all form instances for this return
        const instances = await ctx.db
            .query("formInstances")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .filter((q) => q.eq(q.field("formType"), args.formCode))
            .collect();
        
        if (instances.length === 0) {
            return {
                errorCount: 0,
                warningCount: 0,
                totalRules: rules.length,
                message: "No form instances found for validation",
            };
        }
        
        const instance = instances[0];
        
        // Get fields for each instance and build field values map
        const instanceFieldsMap = new Map<any, Record<string, unknown>>();
        
        for (const instance of instances) {
            const fields = await ctx.db
                .query("fields")
                .withIndex("by_instance", (q) => q.eq("instanceId", instance._id))
                .collect();
            
            const fieldValues: Record<string, unknown> = {};
            for (const field of fields) {
                fieldValues[field.fieldKey] = field.value;
            }
            instanceFieldsMap.set(instance._id, fieldValues);
        }
        
        let errorCount = 0;
        let warningCount = 0;
        const violations: Array<{
            instanceId: string;
            fieldKey: string;
            ruleId: string;
            message: string;
            severity: string;
        }> = [];
        
        // Evaluate each rule against the field values
        for (const rule of rules) {
            // Find which instance contains this field
            for (const [instanceId, fieldValues] of instanceFieldsMap) {
                const value = fieldValues[rule.fieldKey];
                const isValid = evaluateCondition(value, rule.condition);
                
                if (!isValid) {
                    // Determine message based on locale
                    const message = args.locale === "es" 
                        ? rule.errorMessageEs 
                        : rule.errorMessageEn;
                    
                    // Create diagnostic entry
                    await ctx.db.insert("diagnostics", {
                        returnId: args.returnId,
                        instanceId: instanceId,
                        fieldKey: rule.fieldKey,
                        message,
                        severity: rule.severity === "error" ? "Error" : "Warning",
                    });
                    
                    violations.push({
                        instanceId: String(instanceId),
                        fieldKey: rule.fieldKey,
                        ruleId: rule.ruleId,
                        message,
                        severity: rule.severity,
                    });
                    
                    if (rule.severity === "error") {
                        errorCount++;
                    } else {
                        warningCount++;
                    }
                }
            }
        }
        
        // Update lifecycle status with diagnostic count
        const lifecycle = await ctx.db
            .query("lifecycleStatus")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .first();
        
        if (lifecycle) {
            await ctx.db.patch(lifecycle._id, {
                diagnosticCount: errorCount,
                lastDiagnosticRunAt: Date.now(),
            });
        }
        
        return {
            errorCount,
            warningCount,
            totalRules: rules.length,
            violations: violations.length,
        };
    },
});

/**
 * Validate a single field value against all applicable rules
 * Used for real-time validation when field value changes
 * 
 * @param formCode - The form code
 * @param year - Tax year
 * @param fieldKey - The field key to validate
 * @param value - The current field value
 * @param locale - Optional locale for messages (en/es)
 * @returns Validation result with pass/fail and messages
 */
export const validateFieldOnChange = query({
    args: {
        formCode: v.string(),
        year: v.number(),
        fieldKey: v.string(),
        value: v.any(),
        locale: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Get all active rules for this form and year that apply to this field
        const rules = await ctx.db
            .query("validationRules")
            .withIndex("by_formCode_year", (q) => 
                q.eq("formCode", args.formCode).eq("year", args.year)
            )
            .filter((q) => 
                q.eq(q.field("isActive"), true)
            )
            .collect();
        
        // Filter to rules that apply to this specific field
        const fieldRules = rules.filter(r => r.fieldKey === args.fieldKey);
        
        if (fieldRules.length === 0) {
            return {
                fieldKey: args.fieldKey,
                isValid: true,
                errors: [],
                warnings: [],
            };
        }
        
        const errors: string[] = [];
        const warnings: string[] = [];
        
        for (const rule of fieldRules) {
            const isValid = evaluateCondition(args.value, rule.condition);
            
            if (!isValid) {
                const message = args.locale === "es"
                    ? rule.errorMessageEs
                    : rule.errorMessageEn;
                
                if (rule.severity === "error") {
                    errors.push(message);
                } else {
                    warnings.push(message);
                }
            }
        }
        
        return {
            fieldKey: args.fieldKey,
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    },
});

/**
 * Get all validation rules that apply to a specific field
 * Used by UI to show field-specific validation hints
 * 
 * @param formCode - The form code
 * @param year - Tax year
 * @param fieldKey - The field key
 * @returns List of validation rules for the field
 */
export const getValidationRulesForField = query({
    args: {
        formCode: v.string(),
        year: v.number(),
        fieldKey: v.string(),
    },
    handler: async (ctx, args) => {
        // Get all active rules for this form and year
        const allRules = await ctx.db
            .query("validationRules")
            .withIndex("by_formCode_year", (q) => 
                q.eq("formCode", args.formCode).eq("year", args.year)
            )
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect();
        
        // Filter to rules that apply to this specific field
        const fieldRules = allRules.filter(r => r.fieldKey === args.fieldKey);
        
        return fieldRules.map(rule => ({
            ruleId: rule.ruleId,
            fieldKey: rule.fieldKey,
            condition: rule.condition,
            errorMessageEn: rule.errorMessageEn,
            errorMessageEs: rule.errorMessageEs,
            severity: rule.severity,
        }));
    },
});

/**
 * Update diagnostic count in lifecycle status
 * Called after running diagnostics to update the return's lifecycle
 */
export const updateDiagnosticCountInLifecycle = mutation({
    args: {
        returnId: v.id("returns"),
        errorCount: v.number(),
    },
    handler: async (ctx, args) => {
        const lifecycle = await ctx.db
            .query("lifecycleStatus")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .first();
        
        if (!lifecycle) {
            throw new Error("Lifecycle status not found for this return");
        }
        
        await ctx.db.patch(lifecycle._id, {
            diagnosticCount: args.errorCount,
            lastDiagnosticRunAt: Date.now(),
        });
        
        return {
            success: true,
            diagnosticCount: args.errorCount,
        };
    },
});
