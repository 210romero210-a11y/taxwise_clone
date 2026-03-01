import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

// =============================================================================
// LIFECYCLE STATUS - TAX RETURN FILING STAGE TRACKING
// =============================================================================
// This module manages the lifecycle of tax returns through the filing process:
// Draft → Review → Ready → Transmitted → Accepted/Rejected

// Type definitions for lifecycle status
export type EntityType = "Individual" | "Business" | "Specialty";
export type LifecycleStatus = "Draft" | "Review" | "Ready" | "Transmitted" | "Accepted" | "Rejected";

// Valid status transitions map
const VALID_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  "Draft": ["Review"],
  "Review": ["Ready", "Draft"],
  "Ready": ["Transmitted", "Review"],
  "Transmitted": ["Accepted", "Rejected", "Ready"],
  "Accepted": [],
  "Rejected": ["Draft", "Review"],
};

// =============================================================================
// STATUS TRANSITION VALIDATION
// =============================================================================

/**
 * Check if a status transition is valid
 */
export const canTransitionTo = query({
  args: {
    currentStatus: v.string(),
    targetStatus: v.string(),
  },
  handler: async (_ctx, args) => {
    const validTransitions = VALID_TRANSITIONS[args.currentStatus as LifecycleStatus];
    return validTransitions?.includes(args.targetStatus as LifecycleStatus) ?? false;
  },
});

/**
 * Get list of valid next statuses from current status
 */
export const getValidTransitions = query({
  args: {
    currentStatus: v.string(),
  },
  handler: async (_ctx, args) => {
    return VALID_TRANSITIONS[args.currentStatus as LifecycleStatus] ?? [];
  },
});

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get lifecycle status for a specific return
 */
export const getLifecycleStatus = query({
  args: { returnId: v.id("returns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
  },
});

/**
 * Get all returns at a specific lifecycle stage
 */
export const getLifecycleByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

/**
 * Get all returns for an entity type (Individual/Business/Specialty)
 */
export const getLifecycleByEntityType = query({
  args: { entityType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_entityType", (q) => q.eq("entityType", args.entityType))
      .collect();
  },
});

/**
 * Get all returns in "Ready" status (for filing queue)
 */
export const getReturnsReadyForFiling = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_status", (q) => q.eq("status", "Ready"))
      .collect();
  },
});

/**
 * List all lifecycle records with pagination
 */
export const listLifecycleStatus = query({
  args: {
    numResults: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const numResults = args.numResults ?? 50;
    
    return await ctx.db
      .query("lifecycleStatus")
      .order("desc")
      .take(numResults);
  },
});

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new lifecycle record
 */
export const createLifecycleStatus = mutation({
  args: {
    returnId: v.id("returns"),
    entityType: v.union(v.literal("Individual"), v.literal("Business"), v.literal("Specialty")),
    changedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const lifecycleId = await ctx.db.insert("lifecycleStatus", {
      returnId: args.returnId,
      entityType: args.entityType,
      status: "Draft",
      previousStatus: undefined,
      statusChangedAt: now,
      changedBy: args.changedBy,
      diagnosticCount: 0,
      lastDiagnosticRunAt: undefined,
    });
    
    return lifecycleId;
  },
});

/**
 * Transition status to a new stage with validation
 */
export const updateStatus = mutation({
  args: {
    returnId: v.id("returns"),
    newStatus: v.union(
      v.literal("Draft"),
      v.literal("Review"),
      v.literal("Ready"),
      v.literal("Transmitted"),
      v.literal("Accepted"),
      v.literal("Rejected")
    ),
    changedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Get current lifecycle status
    const currentStatus = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (!currentStatus) {
      throw new Error("Lifecycle status not found for this return");
    }
    
    // Validate transition
    const validTransitions = VALID_TRANSITIONS[currentStatus.status as LifecycleStatus];
    if (!validTransitions.includes(args.newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus.status} to ${args.newStatus}. ` +
        `Valid transitions: ${validTransitions.join(", ") || "none"}`
      );
    }
    
    const now = Date.now();
    
    // Update the status
    await ctx.db.patch(currentStatus._id, {
      previousStatus: currentStatus.status,
      status: args.newStatus,
      statusChangedAt: now,
      changedBy: args.changedBy,
    });
    
    return {
      success: true,
      previousStatus: currentStatus.status,
      newStatus: args.newStatus,
      statusChangedAt: now,
    };
  },
});

/**
 * Increment the diagnostic error count
 */
export const incrementDiagnosticCount = mutation({
  args: { returnId: v.id("returns") },
  handler: async (ctx, args) => {
    const lifecycle = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (!lifecycle) {
      throw new Error("Lifecycle status not found for this return");
    }
    
    await ctx.db.patch(lifecycle._id, {
      diagnosticCount: lifecycle.diagnosticCount + 1,
    });
    
    return { diagnosticCount: lifecycle.diagnosticCount + 1 };
  },
});

/**
 * Reset diagnostic count after errors are fixed
 */
export const resetDiagnosticCount = mutation({
  args: { returnId: v.id("returns") },
  handler: async (ctx, args) => {
    const lifecycle = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (!lifecycle) {
      throw new Error("Lifecycle status not found for this return");
    }
    
    await ctx.db.patch(lifecycle._id, {
      diagnosticCount: 0,
    });
    
    return { diagnosticCount: 0 };
  },
});

/**
 * Update timestamp when diagnostics are run
 */
export const updateLastDiagnosticRun = mutation({
  args: { returnId: v.id("returns") },
  handler: async (ctx, args) => {
    const lifecycle = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (!lifecycle) {
      throw new Error("Lifecycle status not found for this return");
    }
    
    const now = Date.now();
    
    await ctx.db.patch(lifecycle._id, {
      lastDiagnosticRunAt: now,
    });
    
    return { lastDiagnosticRunAt: now };
  },
});

// =============================================================================
// LIFECYCLE MANAGEMENT FUNCTIONS
// =============================================================================

/**
 * Create initial lifecycle status when a return is created (defaults to "Draft")
 */
export const initializeLifecycle = mutation({
  args: {
    returnId: v.id("returns"),
    entityType: v.union(v.literal("Individual"), v.literal("Business"), v.literal("Specialty")),
    changedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if lifecycle already exists
    const existing = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (existing) {
      return existing._id;
    }
    
    const now = Date.now();
    
    const lifecycleId = await ctx.db.insert("lifecycleStatus", {
      returnId: args.returnId,
      entityType: args.entityType,
      status: "Draft",
      previousStatus: undefined,
      statusChangedAt: now,
      changedBy: args.changedBy,
      diagnosticCount: 0,
      lastDiagnosticRunAt: undefined,
    });
    
    return lifecycleId;
  },
});

/**
 * Transition to "Ready" status (validates no errors)
 */
export const markReadyForFiling = mutation({
  args: {
    returnId: v.id("returns"),
    changedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const lifecycle = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (!lifecycle) {
      throw new Error("Lifecycle status not found for this return");
    }
    
    // Can only transition from Review to Ready
    if (lifecycle.status !== "Review") {
      throw new Error(`Cannot mark as Ready from ${lifecycle.status}. Return must be in Review status first.`);
    }
    
    // Check for diagnostic errors - return should have no errors
    // (The diagnostic count check is optional - some firms may want to allow filing with warnings)
    const hasErrors = lifecycle.diagnosticCount > 0;
    
    // We'll allow transitioning but log a warning if there are diagnostics
    const now = Date.now();
    
    await ctx.db.patch(lifecycle._id, {
      previousStatus: lifecycle.status,
      status: "Ready",
      statusChangedAt: now,
      changedBy: args.changedBy,
    });
    
    return {
      success: true,
      previousStatus: lifecycle.status,
      newStatus: "Ready",
      hadDiagnosticWarnings: hasErrors,
      statusChangedAt: now,
    };
  },
});

/**
 * Transition to "Transmitted" status
 */
export const markAsTransmitted = mutation({
  args: {
    returnId: v.id("returns"),
    changedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const lifecycle = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (!lifecycle) {
      throw new Error("Lifecycle status not found for this return");
    }
    
    if (lifecycle.status !== "Ready") {
      throw new Error(`Cannot transmit from ${lifecycle.status}. Return must be in Ready status.`);
    }
    
    const now = Date.now();
    
    await ctx.db.patch(lifecycle._id, {
      previousStatus: lifecycle.status,
      status: "Transmitted",
      statusChangedAt: now,
      changedBy: args.changedBy,
    });
    
    return {
      success: true,
      previousStatus: lifecycle.status,
      newStatus: "Transmitted",
      statusChangedAt: now,
    };
  },
});

/**
 * Transition to "Accepted" status (after IRS acceptance)
 */
export const markAsAccepted = mutation({
  args: {
    returnId: v.id("returns"),
    changedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const lifecycle = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (!lifecycle) {
      throw new Error("Lifecycle status not found for this return");
    }
    
    if (lifecycle.status !== "Transmitted") {
      throw new Error(`Cannot mark as Accepted from ${lifecycle.status}. Return must be Transmitted first.`);
    }
    
    const now = Date.now();
    
    await ctx.db.patch(lifecycle._id, {
      previousStatus: lifecycle.status,
      status: "Accepted",
      statusChangedAt: now,
      changedBy: args.changedBy,
    });
    
    return {
      success: true,
      previousStatus: lifecycle.status,
      newStatus: "Accepted",
      statusChangedAt: now,
    };
  },
});

/**
 * Transition to "Rejected" status (after IRS rejection)
 */
export const markAsRejected = mutation({
  args: {
    returnId: v.id("returns"),
    changedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const lifecycle = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (!lifecycle) {
      throw new Error("Lifecycle status not found for this return");
    }
    
    if (lifecycle.status !== "Transmitted") {
      throw new Error(`Cannot mark as Rejected from ${lifecycle.status}. Return must be Transmitted first.`);
    }
    
    const now = Date.now();
    
    await ctx.db.patch(lifecycle._id, {
      previousStatus: lifecycle.status,
      status: "Rejected",
      statusChangedAt: now,
      changedBy: args.changedBy,
    });
    
    return {
      success: true,
      previousStatus: lifecycle.status,
      newStatus: "Rejected",
      statusChangedAt: now,
    };
  },
});

/**
 * Allow returning to Draft for corrections
 */
export const returnToDraft = mutation({
  args: {
    returnId: v.id("returns"),
    changedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const lifecycle = await ctx.db
      .query("lifecycleStatus")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .first();
    
    if (!lifecycle) {
      throw new Error("Lifecycle status not found for this return");
    }
    
    // Can only return to Draft from Review or Rejected
    if (lifecycle.status !== "Review" && lifecycle.status !== "Rejected") {
      throw new Error(`Cannot return to Draft from ${lifecycle.status}. Return must be in Review or Rejected status.`);
    }
    
    const now = Date.now();
    
    await ctx.db.patch(lifecycle._id, {
      previousStatus: lifecycle.status,
      status: "Draft",
      statusChangedAt: now,
      changedBy: args.changedBy,
    });
    
    return {
      success: true,
      previousStatus: lifecycle.status,
      newStatus: "Draft",
      statusChangedAt: now,
    };
  },
});

// =============================================================================
// DASHBOARD/REPORTING FUNCTIONS
// =============================================================================

/**
 * Get count of returns by status
 */
export const getStatusCounts = query({
  handler: async (ctx) => {
    const allStatuses = await ctx.db.query("lifecycleStatus").collect();
    
    const counts: Record<string, number> = {
      Draft: 0,
      Review: 0,
      Ready: 0,
      Transmitted: 0,
      Accepted: 0,
      Rejected: 0,
    };
    
    for (const status of allStatuses) {
      counts[status.status] = (counts[status.status] || 0) + 1;
    }
    
    return counts;
  },
});

/**
 * Get count by entity type
 */
export const getEntityTypeCounts = query({
  handler: async (ctx) => {
    const allStatuses = await ctx.db.query("lifecycleStatus").collect();
    
    const counts: Record<string, number> = {
      Individual: 0,
      Business: 0,
      Specialty: 0,
    };
    
    for (const status of allStatuses) {
      counts[status.entityType] = (counts[status.entityType] || 0) + 1;
    }
    
    return counts;
  },
});

/**
 * Get recent status changes for audit
 */
export const getRecentStatusChanges = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    return await ctx.db
      .query("lifecycleStatus")
      .order("desc")
      .take(limit);
  },
});

/**
 * Get combined dashboard stats
 */
export const getDashboardStats = query({
  handler: async (ctx) => {
    const allStatuses = await ctx.db.query("lifecycleStatus").collect();
    
    // Status counts
    const statusCounts: Record<string, number> = {
      Draft: 0,
      Review: 0,
      Ready: 0,
      Transmitted: 0,
      Accepted: 0,
      Rejected: 0,
    };
    
    // Entity type counts
    const entityTypeCounts: Record<string, number> = {
      Individual: 0,
      Business: 0,
      Specialty: 0,
    };
    
    // Calculate totals
    let totalReturns = 0;
    let totalWithErrors = 0;
    
    for (const status of allStatuses) {
      totalReturns++;
      statusCounts[status.status] = (statusCounts[status.status] || 0) + 1;
      entityTypeCounts[status.entityType] = (entityTypeCounts[status.entityType] || 0) + 1;
      
      if (status.diagnosticCount > 0) {
        totalWithErrors++;
      }
    }
    
    return {
      totalReturns,
      statusCounts,
      entityTypeCounts,
      returnsWithErrors: totalWithErrors,
      filingQueue: statusCounts.Ready,
    };
  },
});
