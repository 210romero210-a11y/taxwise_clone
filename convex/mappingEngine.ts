import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// =============================================================================
// MAPPING ENGINE - CROSS-FORM FIELD MAPPING, FLOW-THROUGH & K-1 SYNC
// =============================================================================
// This module handles:
// - Cross-form field mapping (W2.Box1 → 1040.Line1z)
// - Flow-through calculations for tax form aggregation
// - K-1 pass-through synchronization from partnerships to individuals
// - Dynamic transformation formulas (sum(), multiply, etc.)

// Type definitions for mapping operations
type MappingType = "flow_through" | "k1_sync" | "calculation";

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get a specific mapping rule by ID
 */
export const getMappingRule = query({
    args: { mappingId: v.id("mappingEngine") },
    handler: async (ctx, args) => {
        const mapping = await ctx.db.get(args.mappingId);
        return mapping;
    },
});

/**
 * Get all mappings from a source form/field
 * Useful for finding all targets that receive a specific source value
 */
export const getMappingsBySource = query({
    args: {
        sourceFormCode: v.string(),
        sourceYear: v.number(),
        sourceFieldKey: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("mappingEngine")
            .withIndex("by_source", (q) =>
                q.eq("sourceFormCode", args.sourceFormCode)
                    .eq("sourceYear", args.sourceYear)
                    .eq("sourceFieldKey", args.sourceFieldKey)
            )
            .collect();
    },
});

/**
 * Get all mappings to a target form/field
 * Useful for finding all sources that feed into a specific target
 */
export const getMappingsByTarget = query({
    args: {
        targetFormCode: v.string(),
        targetYear: v.number(),
        targetFieldKey: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("mappingEngine")
            .withIndex("by_target", (q) =>
                q.eq("targetFormCode", args.targetFormCode)
                    .eq("targetYear", args.targetYear)
                    .eq("targetFieldKey", args.targetFieldKey)
            )
            .collect();
    },
});

/**
 * Get mappings filtered by type (flow_through, k1_sync, calculation)
 */
export const getMappingsByType = query({
    args: {
        mappingType: v.string(),
    },
    handler: async (ctx, args) => {
        const allMappings = await ctx.db
            .query("mappingEngine")
            .filter((q) => q.eq(q.field("mappingType"), args.mappingType))
            .collect();
        return allMappings;
    },
});

/**
 * Get all flow-through mappings for a form
 * Used by calculations.ts for tax aggregation
 */
export const getFlowThroughMappings = query({
    args: {
        formCode: v.string(),
        year: v.number(),
    },
    handler: async (ctx, args) => {
        // Get mappings where this form is the source
        const sourceMappings = await ctx.db
            .query("mappingEngine")
            .withIndex("by_source", (q) =>
                q.eq("sourceFormCode", args.formCode)
                    .eq("sourceYear", args.year)
            )
            .filter((q) =>
                q.and(
                    q.eq(q.field("mappingType"), "flow_through"),
                    q.eq(q.field("isActive"), true)
                )
            )
            .collect();

        // Get mappings where this form is the target (for reverse lookups)
        const targetMappings = await ctx.db
            .query("mappingEngine")
            .withIndex("by_target", (q) =>
                q.eq("targetFormCode", args.formCode)
                    .eq("targetYear", args.year)
            )
            .filter((q) =>
                q.and(
                    q.eq(q.field("mappingType"), "flow_through"),
                    q.eq(q.field("isActive"), true)
                )
            )
            .collect();

        return {
            asSource: sourceMappings,
            asTarget: targetMappings,
        };
    },
});

/**
 * Get all K-1 sync mappings
 * Used for partnership to individual return synchronization
 */
export const getK1Mappings = query({
    args: {
        year: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const year = args.year || new Date().getFullYear();
        return await ctx.db
            .query("mappingEngine")
            .filter((q) =>
                q.and(
                    q.eq(q.field("mappingType"), "k1_sync"),
                    q.eq(q.field("sourceYear"), year),
                    q.eq(q.field("isActive"), true)
                )
            )
            .collect();
    },
});

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new mapping rule
 */
export const createMappingRule = mutation({
    args: {
        sourceFormCode: v.string(),
        sourceYear: v.number(),
        sourceFieldKey: v.string(),
        targetFormCode: v.string(),
        targetYear: v.number(),
        targetFieldKey: v.string(),
        mappingType: v.string(),
        transform: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const mappingId = await ctx.db.insert("mappingEngine", {
            sourceFormCode: args.sourceFormCode,
            sourceYear: args.sourceYear,
            sourceFieldKey: args.sourceFieldKey,
            targetFormCode: args.targetFormCode,
            targetYear: args.targetYear,
            targetFieldKey: args.targetFieldKey,
            mappingType: args.mappingType,
            transform: args.transform,
            isActive: args.isActive ?? true,
        });
        return mappingId;
    },
});

/**
 * Update an existing mapping rule
 */
export const updateMappingRule = mutation({
    args: {
        mappingId: v.id("mappingEngine"),
        sourceFormCode: v.optional(v.string()),
        sourceYear: v.optional(v.number()),
        sourceFieldKey: v.optional(v.string()),
        targetFormCode: v.optional(v.string()),
        targetYear: v.optional(v.number()),
        targetFieldKey: v.optional(v.string()),
        mappingType: v.optional(v.string()),
        transform: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { mappingId, ...updates } = args;
        
        // Filter out undefined values
        const filteredUpdates: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                filteredUpdates[key] = value;
            }
        }
        
        if (Object.keys(filteredUpdates).length > 0) {
            await ctx.db.patch(mappingId, filteredUpdates);
        }
        
        return { success: true };
    },
});

/**
 * Soft-delete a mapping rule (deactivate)
 */
export const deactivateMappingRule = mutation({
    args: { mappingId: v.id("mappingEngine") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.mappingId, { isActive: false });
        return { success: true };
    },
});

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

/**
 * Seed default Form 1040 flow-through mappings
 * These are the core mappings that aggregate W2, SchC, SchA data to 1040
 */
export const seedDefaultMappings = mutation({
    args: {
        year: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const year = args.year || new Date().getFullYear();
        
        const defaultMappings = [
            // W2 Flow-Through Mappings
            {
                sourceFormCode: "W2",
                sourceYear: year,
                sourceFieldKey: "Box1",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line1z",
                mappingType: "flow_through",
                transform: "sum()",
                isActive: true,
            },
            {
                sourceFormCode: "W2",
                sourceYear: year,
                sourceFieldKey: "Box2",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line25a",
                mappingType: "flow_through",
                transform: "sum()",
                isActive: true,
            },
            {
                sourceFormCode: "W2",
                sourceYear: year,
                sourceFieldKey: "Box3",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line7",
                mappingType: "flow_through",
                transform: "sum()",
                isActive: true,
            },
            {
                sourceFormCode: "W2",
                sourceYear: year,
                sourceFieldKey: "Box4",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line8",
                mappingType: "flow_through",
                transform: "sum()",
                isActive: true,
            },
            {
                sourceFormCode: "W2",
                sourceYear: year,
                sourceFieldKey: "Box5",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line10",
                mappingType: "flow_through",
                transform: "sum()",
                isActive: true,
            },
            {
                sourceFormCode: "W2",
                sourceYear: year,
                sourceFieldKey: "Box6",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line11",
                mappingType: "flow_through",
                transform: "sum()",
                isActive: true,
            },
            // Schedule C Flow-Through Mappings
            {
                sourceFormCode: "SchC",
                sourceYear: year,
                sourceFieldKey: "Line31",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line3",
                mappingType: "flow_through",
                transform: "sum()",
                isActive: true,
            },
            {
                sourceFormCode: "SchC",
                sourceYear: year,
                sourceFieldKey: "Line15",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line6",
                mappingType: "flow_through",
                transform: "sum()",
                isActive: true,
            },
            // Schedule A Flow-Through Mappings (medical expenses - after 7.5% AGI)
            {
                sourceFormCode: "SchA",
                sourceYear: year,
                sourceFieldKey: "Line4",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line12a",
                mappingType: "flow_through",
                transform: "sum()",
                isActive: true,
            },
            // Calculation mappings (inter-form calculations)
            {
                sourceFormCode: "1040",
                sourceYear: year,
                sourceFieldKey: "Line9",
                targetFormCode: "Sch1",
                targetYear: year,
                targetFieldKey: "Line1",
                mappingType: "calculation",
                transform: "pass()",
                isActive: true,
            },
            {
                sourceFormCode: "Sch1",
                sourceYear: year,
                sourceFieldKey: "Line15",
                targetFormCode: "1040",
                targetYear: year,
                targetFieldKey: "Line11",
                mappingType: "calculation",
                transform: "sum()",
                isActive: true,
            },
        ];

        const insertedIds: Id<"mappingEngine">[] = [];
        
        for (const mapping of defaultMappings) {
            // Check if mapping already exists
            const existing = await ctx.db
                .query("mappingEngine")
                .withIndex("by_source", (q) =>
                    q.eq("sourceFormCode", mapping.sourceFormCode)
                        .eq("sourceYear", mapping.sourceYear)
                        .eq("sourceFieldKey", mapping.sourceFieldKey)
                )
                .filter((q) =>
                    q.and(
                        q.eq(q.field("targetFormCode"), mapping.targetFormCode),
                        q.eq(q.field("targetFieldKey"), mapping.targetFieldKey)
                    )
                )
                .first();

            if (!existing) {
                const id = await ctx.db.insert("mappingEngine", mapping);
                insertedIds.push(id);
            }
        }

        return {
            success: true,
            seededCount: insertedIds.length,
            totalMappings: defaultMappings.length,
        };
    },
});

// =============================================================================
// EXECUTION FUNCTIONS - Apply mappings to transfer values
// =============================================================================

/**
 * Helper: Apply a transform function to a value
 */
function applyTransform(value: number, transform?: string): number {
    if (!transform || transform === "pass()") {
        return value;
    }

    // Handle sum() - just return the value (aggregation happens elsewhere)
    if (transform === "sum()") {
        return value;
    }

    // Handle percentage multiplication (e.g., "*0.5" for half)
    if (transform.startsWith("*")) {
        const multiplier = parseFloat(transform.substring(1));
        if (!isNaN(multiplier)) {
            return value * multiplier;
        }
    }

    // Handle division (e.g., "/2")
    if (transform.startsWith("/")) {
        const divisor = parseFloat(transform.substring(1));
        if (!isNaN(divisor) && divisor !== 0) {
            return value / divisor;
        }
    }

    // Default: return as-is
    return value;
}

/**
 * Apply a single mapping to transfer value from source to target
 * This is the core function that transfers a value based on a mapping rule
 */
export const applyMapping = internalMutation({
    args: {
        returnId: v.id("returns"),
        mappingId: v.id("mappingEngine"),
    },
    handler: async (ctx, args) => {
        // Get the mapping rule
        const mapping = await ctx.db.get(args.mappingId);
        if (!mapping || !mapping.isActive) {
            return { success: false, error: "Mapping not found or inactive" };
        }

        // Find source form instance(s)
        const sourceInstances = await ctx.db
            .query("formInstances")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .filter((q) => q.eq(q.field("formType"), mapping.sourceFormCode))
            .collect();

        if (sourceInstances.length === 0) {
            return { success: false, error: "Source form not found" };
        }

        // Collect values from all source instances
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

        // Find target form instance
        let targetInstance = sourceInstances.find(i => i.formType === mapping.targetFormCode);
        
        if (!targetInstance) {
            // Look for any instance of the target form
            const allInstances = await ctx.db
                .query("formInstances")
                .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
                .filter((q) => q.eq(q.field("formType"), mapping.targetFormCode))
                .collect();
            
            targetInstance = allInstances[0];
        }

        if (!targetInstance) {
            return { success: false, error: "Target form not found" };
        }

        // Check if target field exists
        const existingTargetFields = await ctx.db
            .query("fields")
            .withIndex("by_instance", (q) => q.eq("instanceId", targetInstance._id))
            .filter((q) => q.eq(q.field("fieldKey"), mapping.targetFieldKey))
            .collect();

        const existingField = existingTargetFields[0];

        if (existingField) {
            // Update existing field (skip if manual override)
            if (!existingField.isManualOverride) {
                await ctx.db.patch(existingField._id, {
                    value: transformedValue,
                    isCalculated: true,
                });
            }
        } else {
            // Create new field
            await ctx.db.insert("fields", {
                instanceId: targetInstance._id,
                fieldKey: mapping.targetFieldKey,
                value: transformedValue,
                isManualOverride: false,
                isCalculated: true,
            });
        }

        return {
            success: true,
            sourceValue: totalValue,
            transformedValue,
            mappingType: mapping.mappingType,
        };
    },
});

/**
 * Apply all flow-through mappings for a return
 * This is called by calculations.ts to perform dynamic flow-through
 */
export const applyFlowThrough = internalMutation({
    args: {
        returnId: v.id("returns"),
        year: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const taxYear = args.year || new Date().getFullYear();

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

        const results: { mapping: any; result: any }[] = [];

        for (const mapping of allMappings) {
            // Only apply mappings for the specified year
            if (mapping.sourceYear !== taxYear || mapping.targetYear !== taxYear) {
                continue;
            }

            // Get source form instances
            const sourceInstances = await ctx.db
                .query("formInstances")
                .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
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
                .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
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

            results.push({
                mapping: {
                    source: `${mapping.sourceFormCode}.${mapping.sourceFieldKey}`,
                    target: `${mapping.targetFormCode}.${mapping.targetFieldKey}`,
                },
                result: { sourceValue: totalValue, transformedValue },
            });
        }

        return {
            success: true,
            appliedCount: results.length,
            results,
        };
    },
});

/**
 * Apply K-1 sync mappings to push partnership data to individual returns
 * This syncs K-1 data from partnership returns (1065/1120S) to individual returns
 */
export const applyK1Sync = internalMutation({
    args: {
        partnershipReturnId: v.id("returns"),
        individualReturnId: v.id("returns"),
        year: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const taxYear = args.year || new Date().getFullYear();

        // Get all K-1 sync mappings for the year
        const k1Mappings = await ctx.db
            .query("mappingEngine")
            .filter((q) =>
                q.and(
                    q.eq(q.field("mappingType"), "k1_sync"),
                    q.eq(q.field("sourceYear"), taxYear),
                    q.eq(q.field("isActive"), true)
                )
            )
            .collect();

        // Get K-1 records for this partnership
        const k1Records = await ctx.db
            .query("k1Records")
            .withIndex("by_return", (q) => q.eq("returnId", args.partnershipReturnId))
            .filter((q) => q.eq(q.field("syncStatus"), "pending"))
            .collect();

        const results: { k1RecordId: string; mappingsApplied: number }[] = [];

        for (const k1Record of k1Records) {
            // Find the individual return's 1040
            const individualInstances = await ctx.db
                .query("formInstances")
                .withIndex("by_return", (q) => q.eq("returnId", args.individualReturnId))
                .filter((q) => q.eq(q.field("formType"), "1040"))
                .collect();

            if (individualInstances.length === 0) continue;

            const instance1040 = individualInstances[0];
            let mappingsApplied = 0;

            // Apply each K-1 mapping
            for (const mapping of k1Mappings) {
                // Get value from K-1 data
                const k1Data = k1Record.k1Data as Record<string, any>;
                const sourceValue = k1Data[mapping.sourceFieldKey];

                if (sourceValue === undefined || sourceValue === null) continue;

                const numValue = typeof sourceValue === "number" 
                    ? sourceValue 
                    : parseFloat(sourceValue as string);

                if (isNaN(numValue)) continue;

                // Apply transform
                const transformedValue = applyTransform(numValue, mapping.transform);

                // Update target field on individual 1040
                const existingFields = await ctx.db
                    .query("fields")
                    .withIndex("by_instance", (q) => q.eq("instanceId", instance1040._id))
                    .filter((q) => q.eq(q.field("fieldKey"), mapping.targetFieldKey))
                    .collect();

                const existingField = existingFields[0];

                if (existingField) {
                    if (!existingField.isManualOverride) {
                        await ctx.db.patch(existingField._id, {
                            value: transformedValue,
                            isCalculated: true,
                        });
                    }
                } else {
                    await ctx.db.insert("fields", {
                        instanceId: instance1040._id,
                        fieldKey: mapping.targetFieldKey,
                        value: transformedValue,
                        isManualOverride: false,
                        isCalculated: true,
                    });
                }

                mappingsApplied++;
            }

            // Mark K-1 as synced
            if (mappingsApplied > 0) {
                await ctx.db.patch(k1Record._id, {
                    syncStatus: "synced",
                    syncedAt: Date.now(),
                });
            }

            results.push({
                k1RecordId: k1Record._id,
                mappingsApplied,
            });
        }

        return {
            success: true,
            k1RecordsProcessed: results.length,
            results,
        };
    },
});

// =============================================================================
// UTILITY QUERIES
// =============================================================================

/**
 * Get all active mappings for a tax year
 */
export const getAllMappingsForYear = query({
    args: { year: v.number() },
    handler: async (ctx, args) => {
        const mappings = await ctx.db
            .query("mappingEngine")
            .filter((q) =>
                q.and(
                    q.eq(q.field("sourceYear"), args.year),
                    q.eq(q.field("isActive"), true)
                )
            )
            .collect();
        return mappings;
    },
});

/**
 * Check if a mapping exists between two fields
 */
export const mappingExists = query({
    args: {
        sourceFormCode: v.string(),
        sourceFieldKey: v.string(),
        targetFormCode: v.string(),
        targetFieldKey: v.string(),
        year: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const year = args.year || new Date().getFullYear();
        
        const mapping = await ctx.db
            .query("mappingEngine")
            .withIndex("by_source", (q) =>
                q.eq("sourceFormCode", args.sourceFormCode)
                    .eq("sourceYear", year)
                    .eq("sourceFieldKey", args.sourceFieldKey)
            )
            .filter((q) =>
                q.and(
                    q.eq(q.field("targetFormCode"), args.targetFormCode),
                    q.eq(q.field("targetFieldKey"), args.targetFieldKey),
                    q.eq(q.field("isActive"), true)
                )
            )
            .first();

        return mapping !== null;
    },
});
