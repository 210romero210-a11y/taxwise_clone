import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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
