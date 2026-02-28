import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { calculateReturnDependencies } from "./calculations";
import { api, internal, components } from "./_generated/api";
import { Timeline } from "convex-timeline";
import { DirectAggregate } from "@convex-dev/aggregate";

const timeline = new Timeline(components.timeline);
const refundAggregate = new DirectAggregate<{
    Key: string; // returnId
    Id: string;  // fieldKey
    sumValue: number;
}>(components.aggregate);

export const getFieldsForInstance = query({
    args: { instanceId: v.id("formInstances") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("fields")
            .withIndex("by_instance", (q) => q.eq("instanceId", args.instanceId))
            .collect();
    },
});

export const updateField = mutation({
    args: {
        instanceId: v.id("formInstances"),
        fieldKey: v.string(),
        value: v.any(),
        isManualOverride: v.boolean(),
        isEstimated: v.optional(v.boolean()),
        isCalculated: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const existingField = await ctx.db
            .query("fields")
            .withIndex("by_instance", (q) => q.eq("instanceId", args.instanceId))
            .filter((q) => q.eq(q.field("fieldKey"), args.fieldKey))
            .first();

        const instance = await ctx.db.get(args.instanceId);
        if (!instance) throw new Error("Instance not found");

        let fieldId;
        const previousValue = existingField?.value;

        if (existingField) {
            await ctx.db.patch(existingField._id, {
                value: args.value,
                isManualOverride: args.isManualOverride,
                isEstimated: args.isEstimated,
                isCalculated: args.isCalculated,
            });
            fieldId = existingField._id;
        } else {
            fieldId = await ctx.db.insert("fields", {
                instanceId: args.instanceId,
                fieldKey: args.fieldKey,
                value: args.value,
                isManualOverride: args.isManualOverride,
                isEstimated: args.isEstimated,
                isCalculated: args.isCalculated,
            });
        }

        // 1. Timeline History (Undo/Redo & Audit Trail)
        // Scoped to the specific form instance for granular recovery
        await timeline.push(ctx, args.instanceId, {
            fieldKey: args.fieldKey,
            value: args.value,
            timestamp: Date.now(),
        });

        // 2. Aggregate Tracking (Live Refund Monitor)
        // If it's a numeric tax value, update the high-performance aggregate
        if (typeof args.value === "number") {
            if (existingField && typeof existingField.value === "number") {
                await refundAggregate.replace(ctx,
                    { key: instance.returnId, id: args.fieldKey },
                    { key: instance.returnId, sumValue: args.value }
                );
            } else {
                await refundAggregate.insert(ctx, {
                    key: instance.returnId,
                    id: args.fieldKey,
                    sumValue: args.value,
                });
            }
        }

        // 3. Audit Logging (IRS Compliance)
        const identity = await ctx.auth.getUserIdentity();
        const userId = identity?.subject || "Unauthenticated User";
        // TODO: In Phase 6, we will switch to WorkOS AuthKit role-based identity
        // const userId = await auth.userId(ctx);

        await ctx.runMutation(internal.auditLogs.logEvent, {
            returnId: instance.returnId,
            userId,
            action: existingField ? "Field Update" : "Field Insert",
            fieldKey: args.fieldKey,
            previousValue: previousValue,
            newValue: args.value,
        });

        // 4. Recalculate dependencies if not an internal calculation update
        if (!args.isCalculated) {
            await calculateReturnDependencies(ctx, instance.returnId);
        }

        return fieldId;
    },
});

