import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const logEvent = internalMutation({
    args: {
        returnId: v.id("returns"),
        userId: v.string(),
        action: v.string(),
        fieldKey: v.optional(v.string()),
        previousValue: v.any(),
        newValue: v.any(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("auditLogs", {
            ...args,
            timestamp: Date.now(),
        });
    },
});

export const getAuditLogs = query({
    args: { returnId: v.id("returns") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("auditLogs")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .order("desc")
            .take(100);
    },
});
