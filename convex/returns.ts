import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getReturn = query({
    args: { id: v.id("returns") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

export const listReturns = query({
    handler: async (ctx) => {
        return await ctx.db.query("returns").order("desc").collect();
    },
});

export const createReturn = mutation({
    args: { name: v.string(), taxYear: v.number() },
    handler: async (ctx, args) => {
        const returnId = await ctx.db.insert("returns", {
            name: args.name,
            taxYear: args.taxYear,
            status: "In Progress",
        });
        return returnId;
    },
});
