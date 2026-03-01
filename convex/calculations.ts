import { v } from "convex/values";
import { internalMutation, MutationCtx, query, internalAction, QueryCtx } from "./_generated/server";
import { calculateStandardDeduction, FilingStatus } from "../lib/taxMath/standardDeduction";
import { calculateFederalTax, calculateChildTaxCredit, calculateQBIDeduction } from "../lib/taxMath/taxCalculation";
import { calculateSETax } from "../lib/taxMath/seTax";
import { Id } from "./_generated/dataModel";

// =============================================================================
// HELPER: Apply a transform function to a value
// =============================================================================
function applyTransform(value: number, transform?: string): number {
    if (!transform || transform === "pass()") {
        return value;
    }
    if (transform === "sum()") {
        return value;
    }
    if (transform.startsWith("*")) {
        const multiplier = parseFloat(transform.substring(1));
        if (!isNaN(multiplier)) {
            return value * multiplier;
        }
    }
    if (transform.startsWith("/")) {
        const divisor = parseFloat(transform.substring(1));
        if (!isNaN(divisor) && divisor !== 0) {
            return value / divisor;
        }
    }
    return value;
}

/**
 * Apply all flow-through mappings inline
 * This replicates the logic from mappingEngine.applyFlowThrough
 */
async function applyFlowThroughMappings(
    ctx: MutationCtx,
    returnId: Id<"returns">,
    year: number
): Promise<void> {
    // Get all active flow-through mappings
    const allMappings = await ctx.db
        .query("mappingEngine")
        .filter((q) =>
            q.and(
                q.eq(q.field("mappingType"), "flow_through"),
                q.eq(q.field("isActive"), true)
            )
        )
        .collect();

    for (const mapping of allMappings) {
        // Only apply mappings for the specified year
        if (mapping.sourceYear !== year || mapping.targetYear !== year) {
            continue;
        }

        // Get source form instances
        const sourceInstances = await ctx.db
            .query("formInstances")
            .withIndex("by_return", (q) => q.eq("returnId", returnId))
            .filter((q) => q.eq(q.field("formType"), mapping.sourceFormCode))
            .collect();

        if (sourceInstances.length === 0) continue;

        // Collect and sum values
        let totalValue = 0;
        for (const instance of sourceInstances) {
            const sourceFields = await ctx.db
                .query("fields")
                .withIndex("by_instance", (q) => q.eq("instanceId", instance._id))
                .filter((q) => q.eq(q.field("fieldKey"), mapping.sourceFieldKey))
                .collect();

            for (const field of sourceFields) {
                const val = field.value;
                const num = typeof val === "number" ? val : parseFloat(val as string);
                if (!isNaN(num)) {
                    totalValue += num;
                }
            }
        }

        // Apply transform
        const transformedValue = applyTransform(totalValue, mapping.transform);

        // Find or create target field
        const targetInstances = await ctx.db
            .query("formInstances")
            .withIndex("by_return", (q) => q.eq("returnId", returnId))
            .filter((q) => q.eq(q.field("formType"), mapping.targetFormCode))
            .collect();

        if (targetInstances.length === 0) continue;

        const targetInstance = targetInstances[0];
        const existingTargetFields = await ctx.db
            .query("fields")
            .withIndex("by_instance", (q) => q.eq("instanceId", targetInstance._id))
            .filter((q) => q.eq(q.field("fieldKey"), mapping.targetFieldKey))
            .collect();

        const existingField = existingTargetFields[0];

        if (existingField) {
            if (!existingField.isManualOverride) {
                await ctx.db.patch(existingField._id, {
                    value: transformedValue,
                    isCalculated: true,
                });
            }
        } else {
            await ctx.db.insert("fields", {
                instanceId: targetInstance._id,
                fieldKey: mapping.targetFieldKey,
                value: transformedValue,
                isManualOverride: false,
                isCalculated: true,
            });
        }
    }
}

// =============================================================================
// IMPORT FIELD DEFINITIONS FUNCTIONS  
// =============================================================================
// Import field definitions query functions
import { getCalculatedFields as getCalculatedFieldsQuery, getFieldsByForm as getFieldsByFormQuery } from "./fieldDefinitions";

// =============================================================================
// HELPER: Execute formula based on field definition
// =============================================================================

/**
 * Execute a formula and return calculated value
 * Supports: sum(), simple arithmetic, max(), min(), multiplication with constants
 */
function executeFormula(
    formula: string,
    dependencyValues: Record<string, number>
): number {
    if (!formula) return 0;

    const trimmedFormula = formula.trim();

    // Handle sum() - sum multiple fields
    // Format: "sum(field1, field2, ...)" or "sum(Line1z,Line2b,...)"
    const sumMatch = trimmedFormula.match(/^sum\(([^)]+)\)$/i);
    if (sumMatch) {
        const args = sumMatch[1].split(",").map((s) => s.trim());
        return args.reduce((sum, arg) => {
            const val = dependencyValues[arg] || 0;
            return sum + val;
        }, 0);
    }

    // Handle max() - maximum of fields
    // Format: "max(field1, field2, ...)"
    const maxMatch = trimmedFormula.match(/^max\(([^)]+)\)$/i);
    if (maxMatch) {
        const args = maxMatch[1].split(",").map((s) => s.trim());
        const values = args.map((arg) => dependencyValues[arg] || 0);
        return Math.max(...values);
    }

    // Handle min() - minimum of fields
    // Format: "min(field1, field2, ...)"
    const minMatch = trimmedFormula.match(/^min\(([^)]+)\)$/i);
    if (minMatch) {
        const args = minMatch[1].split(",").map((s) => s.trim());
        const values = args.map((arg) => dependencyValues[arg] || 0);
        return Math.min(...values);
    }

    // Handle simple arithmetic: "field1 + field2" or "field1 * 0.9235"
    // Replace field names with their values
    let expression = trimmedFormula;

    // Find all field references (like Line1z, Line2b, etc.)
    const fieldPattern = /[A-Za-z_][A-Za-z0-9_]*/g;
    const matches = trimmedFormula.match(fieldPattern);

    if (matches) {
        const uniqueFields = Array.from(new Set(matches));
        for (const field of uniqueFields) {
            // Skip known function names and keywords
            if (["sum", "max", "min", "if", "and", "or", "true", "false", "null"].includes(field.toLowerCase())) {
                continue;
            }
            const value = dependencyValues[field] !== undefined ? dependencyValues[field] : 0;
            // Replace field name with its numeric value
            expression = expression.replace(new RegExp(`\\b${field}\\b`, "g"), value.toString());
        }
    }

    // Handle standard_deduction special function
    // Format: "standard_deduction(filingStatus, age, blind)"
    if (trimmedFormula.startsWith("standard_deduction(")) {
        // This is handled separately in the actual calculation
        return 0;
    }

    // Handle tax_table special function
    // Format: "tax_table(Line15, filingStatus)"
    if (trimmedFormula.startsWith("tax_table(")) {
        // This is handled separately in the actual calculation  
        return 0;
    }

    // Evaluate the arithmetic expression
    try {
        // Only allow safe characters for evaluation
        const safeExpression = expression.replace(/[^0-9+\-*/().\s]/g, "");
        if (safeExpression && !isNaN(Number(safeExpression))) {
            // It's just a number
            return parseFloat(safeExpression);
        }
        // Use Function constructor for safe evaluation (only + - * / and numbers)
        const result = new Function(`return ${safeExpression}`)();
        return typeof result === "number" && !isNaN(result) ? result : 0;
    } catch (error) {
        console.error("Formula evaluation error:", error, "Expression:", expression);
        return 0;
    }
}

/**
 * Get field definition from database
 */
async function getFieldDefinitionFromDb(
    ctx: MutationCtx,
    formCode: string,
    year: number,
    fieldKey: string
): Promise<any | null> {
    const definitions = await ctx.db
        .query("fieldDefinitions")
        .withIndex("by_formCode_year", (q) =>
            q.eq("formCode", formCode).eq("year", year)
        )
        .collect();

    return definitions.find((d) => d.fieldKey === fieldKey) || null;
}

/**
 * Get calculated fields for a form from database
 */
async function getCalculatedFieldsFromDb(
    ctx: MutationCtx,
    formCode: string,
    year: number
): Promise<any[]> {
    const definitions = await ctx.db
        .query("fieldDefinitions")
        .withIndex("by_formCode_year", (q) =>
            q.eq("formCode", formCode).eq("year", year)
        )
        .collect();

    return definitions.filter((d) => d.isCalculated === true);
}

// =============================================================================
// METADATA-DRIVEN CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate a single metadata-driven field
 * Takes returnId, formCode, year, fieldKey and calculates the value
 */
export async function calculateMetadataField(
    ctx: MutationCtx,
    returnId: Id<"returns">,
    formCode: string,
    year: number,
    fieldKey: string
): Promise<number> {
    // 1. Get the field definition to check if it's calculated
    const fieldDef = await getFieldDefinitionFromDb(ctx, formCode, year, fieldKey);

    // If no definition or not calculated, return 0
    if (!fieldDef || !fieldDef.isCalculated || !fieldDef.formula) {
        return 0;
    }

    // 2. Get the formula from fieldDefinitions
    const formula = fieldDef.formula;

    // 3. Get the dependencies (dependsOn fields)
    const dependsOn = fieldDef.dependsOn || [];

    // 4. Resolve all dependency values from the fields table
    const dependencyValues: Record<string, number> = {};

    // Get form instance for this form
    const instances = await ctx.db
        .query("formInstances")
        .withIndex("by_return", (q) => q.eq("returnId", returnId))
        .filter((q) => q.eq(q.field("formType"), formCode))
        .collect();

    if (instances.length === 0) {
        return 0;
    }

    const instance = instances[0];

    // Get all fields for this instance
    const allFields = await ctx.db
        .query("fields")
        .withIndex("by_instance", (q) => q.eq("instanceId", instance._id))
        .collect();

    // Build dependency values map
    for (const depField of dependsOn) {
        const field = allFields.find((f) => f.fieldKey === depField);
        if (field) {
            const val = field.value;
            dependencyValues[depField] = typeof val === "number" ? val : parseFloat(val as string) || 0;
        } else {
            dependencyValues[depField] = 0;
        }
    }

    // 5. Execute the formula and return the calculated value
    return executeFormula(formula, dependencyValues);
}

/**
 * Calculate all metadata-driven fields for a form in dependency order
 */
export async function calculateAllMetadataFields(
    ctx: MutationCtx,
    returnId: Id<"returns">,
    formCode: string,
    year: number
): Promise<void> {
    // Get all calculated fields for this form
    const calculatedFields = await getCalculatedFieldsFromDb(ctx, formCode, year);

    if (calculatedFields.length === 0) {
        return;
    }

    // Build dependency graph and sort topologically
    const fieldMap = new Map(calculatedFields.map((f) => [f.fieldKey, f]));
    const visited = new Set<string>();
    const sorted: any[] = [];

    function visit(field: any) {
        if (visited.has(field.fieldKey)) return;
        visited.add(field.fieldKey);

        const deps = field.dependsOn || [];
        for (const dep of deps) {
            const depField = fieldMap.get(dep);
            if (depField) {
                visit(depField);
            }
        }

        sorted.push(field);
    }

    for (const field of calculatedFields) {
        visit(field);
    }

    // Get form instance
    const instances = await ctx.db
        .query("formInstances")
        .withIndex("by_return", (q) => q.eq("returnId", returnId))
        .filter((q) => q.eq(q.field("formType"), formCode))
        .collect();

    if (instances.length === 0) {
        return;
    }

    const instance = instances[0];

    // Calculate each field in dependency order
    for (const fieldDef of sorted) {
        const value = await calculateMetadataField(ctx, returnId, formCode, year, fieldDef.fieldKey);

        // Get existing field or create new one
        const existingFields = await ctx.db
            .query("fields")
            .withIndex("by_instance", (q) => q.eq("instanceId", instance._id))
            .filter((q) => q.eq(q.field("fieldKey"), fieldDef.fieldKey))
            .collect();

        const existingField = existingFields[0];

        if (existingField) {
            if (!existingField.isManualOverride && existingField.value !== value) {
                await ctx.db.patch(existingField._id, {
                    value,
                    isCalculated: true,
                });
            }
        } else {
            await ctx.db.insert("fields", {
                instanceId: instance._id,
                fieldKey: fieldDef.fieldKey,
                value,
                isManualOverride: false,
                isCalculated: true,
            });
        }
    }
}

/**
 * Get all fields that depend on a specific field
 */
export async function getDependentFields(
    ctx: MutationCtx,
    formCode: string,
    year: number,
    fieldKey: string
): Promise<string[]> {
    const calculatedFields = await getCalculatedFieldsFromDb(ctx, formCode, year);
    const dependentFields: string[] = [];

    for (const field of calculatedFields) {
        const dependsOn = field.dependsOn || [];
        if (dependsOn.includes(fieldKey)) {
            dependentFields.push(field.fieldKey);
        }
    }

    return dependentFields;
}

/**
 * Recalculate dependent fields when a field value changes
 * This enables real-time calculation updates
 */
export async function recalculateDependentFields(
    ctx: MutationCtx,
    returnId: Id<"returns">,
    formCode: string,
    year: number,
    changedFieldKey: string
): Promise<void> {
    // Find all fields that depend on the changed field
    const dependentFields = await getDependentFields(ctx, formCode, year, changedFieldKey);

    if (dependentFields.length === 0) {
        return;
    }

    // Recalculate each dependent field
    for (const fieldKey of dependentFields) {
        await calculateMetadataField(ctx, returnId, formCode, year, fieldKey);
    }

    // Recursively find fields that depend on the recalculated fields
    for (const fieldKey of dependentFields) {
        await recalculateDependentFields(ctx, returnId, formCode, year, fieldKey);
    }
}

/**
 * Get field calculation status for a form
 * Returns which fields are calculated (blue) vs manual (white)
 */
export async function getFieldCalculationStatus(
    ctx: QueryCtx,
    formCode: string,
    year: number
): Promise<{
    calculatedFields: string[];
    manualFields: string[];
    allFields: Array<{ fieldKey: string; isCalculated: boolean; hasFormula: boolean }>;
}> {
    // Get field definitions for this form
    const definitions = await ctx.db
        .query("fieldDefinitions")
        .withIndex("by_formCode_year", (q) =>
            q.eq("formCode", formCode).eq("year", year)
        )
        .collect();

    const calculatedFields: string[] = [];
    const manualFields: string[] = [];
    const allFields: Array<{ fieldKey: string; isCalculated: boolean; hasFormula: boolean }> = [];

    for (const def of definitions) {
        const hasFormula = !!def.formula && def.isCalculated;
        
        allFields.push({
            fieldKey: def.fieldKey,
            isCalculated: def.isCalculated || false,
            hasFormula,
        });

        if (def.isCalculated) {
            calculatedFields.push(def.fieldKey);
        } else {
            manualFields.push(def.fieldKey);
        }
    }

    return {
        calculatedFields,
        manualFields,
        allFields,
    };
}

// =============================================================================
// MAIN CALCULATION FUNCTION (UPDATED FOR METADATA-DRIVEN APPROACH)
// =============================================================================

/**
 * Calculate all return dependencies using metadata-driven approach
 * This function performs tax aggregation and calculations for a return
 */
export async function calculateReturnDependencies(ctx: MutationCtx, returnId: Id<"returns">) {
    // 1. Fetch return metadata
    const returnData = await ctx.db.get(returnId);
    if (!returnData) return;
    const taxYear = returnData.taxYear;

    // 2. Fetch all form instances for this return
    const instances = await ctx.db
        .query("formInstances")
        .withIndex("by_return", (q) => q.eq("returnId", returnId))
        .collect();

    // 3. Fetch all fields for all instances
    const allFields: (any & { formType: string })[] = [];
    for (const inst of instances) {
        const fields = await ctx.db
            .query("fields")
            .withIndex("by_instance", (q) => q.eq("instanceId", inst._id))
            .collect();
        allFields.push(...fields.map(f => ({ ...f, formType: inst.formType })));
    }

    // 4. Find the primary 1040 instance
    let main1040 = instances.find(i => i.formType === "1040");
    if (!main1040) {
        return;
    }

    // Store main1040 ID for use in closures (TypeScript needs this since it can't track closure captures)
    const main1040Id = main1040._id;

    // Map for easy lookup [instanceId_fieldKey]
    const fieldMap = new Map(allFields.map((f) => [`${f.instanceId}_${f.fieldKey}`, f]));

    // =================================================================
    // STEP 1: Apply all flow-through mappings from mappingEngine
    // This replaces the manual W2/SchC aggregation with dynamic mappings
    // =================================================================
    try {
        await applyFlowThroughMappings(ctx, returnId, taxYear);
    } catch (error) {
        console.error("Flow-through mapping error:", error);
        // Continue with fallback calculations
    }

    // =================================================================
    // STEP 2: Try metadata-driven calculated fields
    // =================================================================
    try {
        await calculateAllMetadataFields(ctx, returnId, "1040", taxYear);
    } catch (error) {
        console.error("Metadata calculation error:", error);
        // Fall back to hardcoded calculations
    }

    // =================================================================
    // STEP 3: Fallback - Hardcoded calculations (backward compatibility)
    // These run if metadata-driven approach doesn't have definitions
    // =================================================================

    // Helper to sum a field across all instances of a form type (Flow-Through)
    const getSum = (formType: string, fieldKey: string): number => {
        return allFields
            .filter(f => f.formType === formType && f.fieldKey === fieldKey)
            .reduce((sum, f) => {
                const val = f.value;
                const num = typeof val === "number" ? val : parseFloat(val);
                return sum + (isNaN(num) ? 0 : num);
            }, 0);
    };

    // Helper to get value from primary 1040
    const get1040Value = (key: string): number => {
        const f = fieldMap.get(`${main1040Id}_${key}`);
        const val = f?.value;
        if (typeof val === "number") return val;
        if (typeof val === "string") {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    const get1040Bool = (key: string): boolean => {
        const f = fieldMap.get(`${main1040Id}_${key}`);
        return f?.value === true || f?.value === "true";
    };

    const get1040String = (key: string, defaultValue: string): string => {
        const f = fieldMap.get(`${main1040Id}_${key}`);
        return typeof f?.value === "string" ? f.value : defaultValue;
    };

    // Helper to set primary 1040 calculated values
    const set1040Value = async (key: string, value: number | string | boolean) => {
        const compositeKey = `${main1040Id}_${key}`;
        const existingField = fieldMap.get(compositeKey);

        if (existingField) {
            if (existingField.isManualOverride) return;
            if (existingField.value !== value) {
                await ctx.db.patch(existingField._id, {
                    value,
                    isCalculated: true
                });
                existingField.value = value;
            }
        } else {
            const newId = await ctx.db.insert("fields", {
                instanceId: main1040Id,
                fieldKey: key,
                value,
                isManualOverride: false,
                isCalculated: true,
            });
            fieldMap.set(compositeKey, { _id: newId, instanceId: main1040Id, fieldKey: key, value, isManualOverride: false, isCalculated: true } as any);
        }
    };

    // --- TAX MATH DEPENDENCIES (2023 LOGIC) ---

    // 1. Inputs from 1040 Metadata
    const status = get1040String("FilingStatus", "Single") as FilingStatus;
    const isBlind = get1040Bool("IsBlind");
    const isOver65 = get1040Bool("IsOver65");
    const numChildren = get1040Value("NumChildren");

    // 2. FLOW-THROUGH: Sum all W-2 Box 1 -> 1040 Line 1z (if not already done by mappingEngine)
    const totalWages = getSum("W2", "Box1");
    const totalW2Withholding = getSum("W2", "Box2");
    
    // Only set if not already set by flow-through mapping
    const existingLine1z = fieldMap.get(`${main1040Id}_Line1z`);
    if (!existingLine1z) {
        await set1040Value("1040_Line1z", totalWages);
    }

    // 3. Schedule C Aggregation & SE Tax
    const schCProfit = getSum("SchC", "Line31");
    const { totalTax: seTax, deduction: seDeduction } = calculateSETax(schCProfit, taxYear);
    await set1040Value("1040_Line23", seTax);

    // 4. Total Income (metadata-driven should already handle this)
    const taxableInterest = get1040Value("1040_Line2b");
    const ordinaryDividends = get1040Value("1040_Line3b");
    const capitalGain = get1040Value("1040_Line7");
    const otherIncome = get1040Value("1040_Line8");

    const totalIncome = totalWages + taxableInterest + ordinaryDividends + capitalGain + otherIncome + schCProfit;
    
    // Only set if metadata didn't handle it
    const existingLine9 = fieldMap.get(`${main1040Id}_Line9`);
    if (!existingLine9) {
        await set1040Value("1040_Line9", totalIncome);
    }

    // 5. Adjusted Gross Income (AGI)
    const adjustments = get1040Value("1040_Line10") + seDeduction;
    const agi = Math.max(0, totalIncome - adjustments);
    
    const existingLine11 = fieldMap.get(`${main1040Id}_Line11`);
    if (!existingLine11) {
        await set1040Value("1040_Line11", agi);
    }

    // 6. Deductions
    const itemizedTotal = getSum("SchA", "Line17");
    const standardDeductionVal = calculateStandardDeduction(status, taxYear, isBlind, isOver65);
    const deductionToUse = Math.max(standardDeductionVal, itemizedTotal);
    
    const existingLine12 = fieldMap.get(`${main1040Id}_Line12`);
    if (!existingLine12) {
        await set1040Value("1040_Line12", deductionToUse);
    }

    // 7. QBI Deduction (2025+)
    let qbiDeduction = 0;
    if (taxYear >= 2025) {
        qbiDeduction = calculateQBIDeduction(schCProfit, agi - deductionToUse);
        
        const existingLine13 = fieldMap.get(`${main1040Id}_Line13`);
        if (!existingLine13) {
            await set1040Value("1040_Line13", qbiDeduction);
        }
    }

    // 8. Taxable Income
    const taxableIncome = Math.max(0, agi - deductionToUse - qbiDeduction);
    
    const existingLine15 = fieldMap.get(`${main1040Id}_Line15`);
    if (!existingLine15) {
        await set1040Value("1040_Line15", taxableIncome);
    }

    // 9. Total Tax Liability
    const incomeTaxVal = calculateFederalTax(taxableIncome, status, taxYear);
    const childTaxCreditVal = calculateChildTaxCredit(numChildren, agi, status);

    const existingLine16 = fieldMap.get(`${main1040Id}_Line16`);
    if (!existingLine16) {
        await set1040Value("1040_Line16", incomeTaxVal);
    }

    const existingLine19 = fieldMap.get(`${main1040Id}_Line19`);
    if (!existingLine19) {
        await set1040Value("1040_Line19", childTaxCreditVal);
    }

    // Line 24: Total Tax = (Income Tax - Credits) + SE Tax
    const finalTaxLiability = Math.max(0, incomeTaxVal - childTaxCreditVal) + seTax;
    
    const existingLine24 = fieldMap.get(`${main1040Id}_Line24`);
    if (!existingLine24) {
        await set1040Value("1040_Line24", finalTaxLiability);
    }

    // Payments
    const existingLine25a = fieldMap.get(`${main1040Id}_Line25a`);
    if (!existingLine25a) {
        await set1040Value("1040_Line25a", totalW2Withholding);
    }

    // 10. Line 22: Sum of tax and credits
    const totalTaxAfterCredit = Math.max(0, incomeTaxVal - childTaxCreditVal);
    
    const existingLine22 = fieldMap.get(`${main1040Id}_Line22`);
    if (!existingLine22) {
        await set1040Value("1040_Line22", totalTaxAfterCredit);
    }

    // Live Refund Monitor Signal (for UI header)
    const totalPayments = totalW2Withholding;
    const refundOrBalance = totalPayments - finalTaxLiability;
    
    const existingRefundAmount = fieldMap.get(`${main1040Id}_RefundAmount`);
    if (!existingRefundAmount) {
        await set1040Value("1040_RefundAmount", refundOrBalance);
    }
}

// =============================================================================
// PUBLIC API - Internal mutation exposing the helper
// =============================================================================

/**
 * Main entry point to recalculate a return
 * This triggers the full calculation pipeline:
 * 1. Flow-through mappings from mappingEngine
 * 2. Metadata-driven calculations
 * 3. Fallback hardcoded calculations
 */
export const recalculateReturn = internalMutation({
    args: { returnId: v.id("returns") },
    handler: async (ctx, args) => {
        await calculateReturnDependencies(ctx, args.returnId);
    },
});

/**
 * Trigger recalculation for a specific form in a return
 */
export const recalculateForm = internalMutation({
    args: {
        returnId: v.id("returns"),
        formCode: v.string(),
        year: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const taxYear = args.year || new Date().getFullYear();
        
        // Apply flow-through mappings for this form
        await applyFlowThroughMappings(ctx, args.returnId, taxYear);
        
        // Calculate metadata-driven fields for this form
        await calculateAllMetadataFields(ctx, args.returnId, args.formCode, taxYear);
    },
});

/**
 * Trigger recalculation when a field value changes
 * This finds all dependent fields and recalculates them
 */
export const recalculateOnFieldChange = internalMutation({
    args: {
        returnId: v.id("returns"),
        formCode: v.string(),
        fieldKey: v.string(),
        year: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const taxYear = args.year || new Date().getFullYear();
        
        // Recalculate dependent fields
        await recalculateDependentFields(ctx, args.returnId, args.formCode, taxYear, args.fieldKey);
    },
});

// =============================================================================
// QUERY: Get calculation status for a form (for UI: blue vs white fields)
// =============================================================================

/**
 * Query to get field calculation status
 * Returns information about which fields are calculated vs manual
 */
export const getFormCalculationStatus = query({
    args: {
        formCode: v.string(),
        year: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const taxYear = args.year || new Date().getFullYear();
        return await getFieldCalculationStatus({ db: ctx.db } as any, args.formCode, taxYear);
    },
});
