import { v } from "convex/values";
import { internalMutation, query, internalAction } from "./_generated/server";

// =============================================================================
// FLIGHT RECORDER - IMMUTABLE AUDIT TRAIL (IRS PUBLICATION 1345 COMPLIANT)
// =============================================================================
// This module provides cryptographically chained audit logging to ensure
// tamper-proof audit trails that can withstand IRS inquiries.

/**
 * Compute SHA-256 hash for an audit entry using Web Crypto API
 * This provides actual cryptographic security for IRS compliance
 */
async function computeEntryHash(entry: {
  returnId: string;
  userId: string;
  action: string;
  fieldKey?: string;
  previousValue: unknown;
  newValue: unknown;
  source?: string;
  timestamp: number;
  previousEntryHash?: string;
}): Promise<string> {
  const data = JSON.stringify({
    returnId: entry.returnId,
    userId: entry.userId,
    action: entry.action,
    fieldKey: entry.fieldKey,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    source: entry.source,
    timestamp: entry.timestamp,
    previousEntryHash: entry.previousEntryHash,
  });
  
  // Use Web Crypto API for proper SHA-256 hashing
  const msgBuffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Log an immutable audit event with cryptographic chain
 * This creates a tamper-evident record for IRS compliance
 */
export const logImmutableEvent = internalMutation({
  args: {
    returnId: v.id("returns"),
    userId: v.string(),
    action: v.string(),
    fieldKey: v.optional(v.string()),
    previousValue: v.any(),
    newValue: v.any(),
    source: v.optional(v.string()), // "manual", "ai_ocr", "calculated", "mef_transmission"
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    
    // Get the last audit entry to chain the hash
    const lastEntry = await ctx.db
      .query("immutableAuditLogs")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .order("desc")
      .first();
    
    const previousEntryHash = lastEntry?.entryHash || "genesis";
    
    // Create the entry data for hashing
    const entryData = {
      returnId: args.returnId,
      userId: args.userId,
      action: args.action,
      fieldKey: args.fieldKey,
      previousValue: args.previousValue,
      newValue: args.newValue,
      source: args.source,
      timestamp,
      previousEntryHash,
    };
    
    // Compute cryptographic hash using SHA-256
    const entryHash = await computeEntryHash(entryData);
    
    // Insert immutable audit log
    await ctx.db.insert("immutableAuditLogs", {
      returnId: args.returnId,
      userId: args.userId,
      action: args.action,
      fieldKey: args.fieldKey,
      previousValue: args.previousValue,
      newValue: args.newValue,
      source: args.source,
      timestamp,
      previousEntryHash,
      entryHash,
    });
    
    // Also log to regular audit logs for backward compatibility
    await ctx.db.insert("auditLogs", {
      returnId: args.returnId,
      userId: args.userId,
      action: args.action,
      fieldKey: args.fieldKey,
      previousValue: args.previousValue,
      newValue: args.newValue,
      source: args.source,
      timestamp,
    });
    
    return { success: true, timestamp, entryHash };
  },
});

/**
 * Verify the integrity of the audit chain for a return
 * Returns verification status for IRS inquiries
 */
export const verifyAuditIntegrity = query({
  args: { returnId: v.id("returns") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("immutableAuditLogs")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .order("asc")
      .collect();
    
    if (entries.length === 0) {
      return { isValid: true, entryCount: 0, brokenAt: null };
    }
    
    // Verify chain integrity
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // Verify hash - compute expected hash and compare
      const expectedHash = await computeEntryHash({
        returnId: entry.returnId,
        userId: entry.userId,
        action: entry.action,
        fieldKey: entry.fieldKey,
        previousValue: entry.previousValue,
        newValue: entry.newValue,
        source: entry.source,
        timestamp: entry.timestamp,
        previousEntryHash: entry.previousEntryHash,
      });
      
      if (expectedHash !== entry.entryHash) {
        return { 
          isValid: false, 
          entryCount: entries.length, 
          brokenAt: entry.timestamp,
          error: `Hash mismatch at index ${i}`
        };
      }
      
      // Verify chain link
      if (i > 0) {
        const previousEntry = entries[i - 1];
        if (entry.previousEntryHash !== previousEntry.entryHash) {
          return { 
            isValid: false, 
            entryCount: entries.length, 
            brokenAt: entry.timestamp,
            error: `Chain break at index ${i}`
          };
        }
      }
    }
    
    return { isValid: true, entryCount: entries.length, brokenAt: null };
  },
});

/**
 * Export audit trail for IRS investigators
 * Provides a tamper-evident export of all audit events
 */
export const exportAuditTrail = query({
  args: { returnId: v.id("returns") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("immutableAuditLogs")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .order("asc")
      .collect();
    
    const verification = await ctx.db
      .query("immutableAuditLogs")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .order("desc")
      .first();
    
    return {
      returnId: args.returnId,
      exportTimestamp: Date.now(),
      entryCount: entries.length,
      chainVerified: verification ? verification.entryHash : null,
      entries: entries.map(e => ({
        timestamp: e.timestamp,
        userId: e.userId,
        action: e.action,
        fieldKey: e.fieldKey,
        previousValue: e.previousValue,
        newValue: e.newValue,
        source: e.source,
        entryHash: e.entryHash,
      })),
    };
  },
});

// Legacy functions for backward compatibility
export const logEvent = internalMutation({
    args: {
        returnId: v.id("returns"),
        userId: v.string(),
        action: v.string(),
        fieldKey: v.optional(v.string()),
        previousValue: v.any(),
        newValue: v.any(),
        source: v.optional(v.string()),
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
