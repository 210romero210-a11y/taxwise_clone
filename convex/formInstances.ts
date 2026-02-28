import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getInstance = query({
    args: { instanceId: v.id("formInstances") },
    handler: async (ctx, args) => {
        const instance = await ctx.db.get(args.instanceId);
        if (!instance) return null;
        
        // Verify user owns the return
        const return_ = await ctx.db.get(instance.returnId);
        if (!return_) throw new Error("Return not found");
        
        // TODO: In production, verify user ownership via auth
        // For now, just return the instance
        return instance;
    },
});

export const getInstancesForReturn = query({
    args: { returnId: v.id("returns") },
    handler: async (ctx, args) => {
        // Verify return exists and user has access
        const return_ = await ctx.db.get(args.returnId);
        if (!return_) throw new Error("Return not found");
        
        // TODO: In production, verify user ownership via auth
        // For now, return instances for the return
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
        documentSource: v.optional(v.string()),
        taxpayerRole: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("formInstances", {
            returnId: args.returnId,
            formType: args.formType,
            instanceName: args.instanceName,
            status: "In Progress",
            storageId: args.storageId,
            documentSource: args.documentSource || "manual",
            uploadedAt: args.storageId ? Date.now() : undefined,
            taxpayerRole: args.taxpayerRole,
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
