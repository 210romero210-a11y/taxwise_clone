import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

// This file is kept for reference only.
// The app now uses the dedicated convex/returns.ts, convex/fields.ts, etc.

// Unused legacy stubs - retained but non-functional due to 'numbers' table removal
export const listNumbers = query({
  args: { count: v.number() },
  handler: async (_ctx, _args) => {
    return { viewer: null, numbers: [] };
  },
});

export const addNumber = mutation({
  args: { value: v.number() },
  handler: async (_ctx, _args) => {
    // no-op: 'numbers' table no longer exists
  },
});

export const myAction = action({
  args: { first: v.number(), second: v.string() },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(api.myFunctions.listNumbers, { count: 10 });
    console.log(data);
    await ctx.runMutation(api.myFunctions.addNumber, { value: args.first });
  },
});
