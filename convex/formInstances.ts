import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getInstance = query({
    args: { instanceId: v.id("formInstances") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.instanceId);
    },
});

export const getInstancesForReturn = query({
    args: { returnId: v.id("returns") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("formInstances")
            .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
            .collect();
    },
});

export const createInstance = mutation({
    args: {
        returnId: v.id("returns"),
        formType: v.string(),
        instanceName: v.string(),
        storageId: v.optional(v.id("_storage")),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("formInstances", {
            returnId: args.returnId,
            formType: args.formType,
            instanceName: args.instanceName,
            status: "In Progress",
            storageId: args.storageId,
        });
    },
});

export const deleteInstance = mutation({
    args: { instanceId: v.id("formInstances") },
    handler: async (ctx, args) => {
        const fields = await ctx.db
            .query("fields")
            .withIndex("by_instance", (q) => q.eq("instanceId", args.instanceId))
            .collect();

        for (const field of fields) {
            await ctx.db.delete(field._id);
        }

        await ctx.db.delete(args.instanceId);
    },
});
