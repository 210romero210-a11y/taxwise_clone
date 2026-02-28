import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

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
