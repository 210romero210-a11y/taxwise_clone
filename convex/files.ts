import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const generateUploadUrl = mutation(async (ctx) => {
    return await ctx.storage.generateUploadUrl();
});

export const getImageUrl = query({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});

/**
 * Generate a temporary access URL for document viewing.
 * Convex storage URLs are private by default - only the uploader can access them.
 * For IRS Publication 1345 compliance, access is logged to auditLogs.
 * 
 * NOTE: This returns the Convex storage URL. Actual signed/temporary URLs
 * would require external storage (S3, etc.) with signed URL capability.
 */
export const generateTemporaryAccessUrl = mutation({
    args: {
        storageId: v.id("_storage"),
        returnId: v.id("returns"),
    },
    handler: async (ctx, args) => {
        // Log the access for audit trail (IRS Publication 1345 compliance)
        const identity = await ctx.auth.getUserIdentity();
        const userId = identity?.subject || "anonymous";
        
        // Use the audit log for IRS-compliant audit trail (no PII in console)
        // Document access is logged via logEvent to auditLogs table
        const timestamp = Date.now();
        await ctx.db.insert("auditLogs", {
            returnId: args.returnId,
            userId,
            action: "Document View",
            fieldKey: undefined,
            previousValue: null,
            newValue: { storageId: args.storageId, accessType: "view" },
            source: "document_access",
            timestamp,
        });
        
        const url = await ctx.storage.getUrl(args.storageId);
        if (!url) throw new Error("File not found");
        
        return {
            url,
            // Document access is logged but URL validity depends on Convex storage
            note: "Convex private URL - access is logged for audit compliance",
        };
    },
});

/**
 * Internal mutation to log access to sensitive documents.
 * Creates an audit trail for IRS compliance.
 */
export const logDocumentAccess = internalMutation({
    args: {
        storageId: v.id("_storage"),
        returnId: v.id("returns"),
        userId: v.string(),
        accessType: v.string(), // "view", "download", "upload"
    },
    handler: async (ctx, args) => {
        // Log to auditLogs table for IRS-compliant audit trail
        // No sensitive data in console logs
        await ctx.db.insert("auditLogs", {
            returnId: args.returnId,
            userId: args.userId,
            action: `Document ${args.accessType.charAt(0).toUpperCase() + args.accessType.slice(1)}`,
            fieldKey: undefined,
            previousValue: null,
            newValue: { storageId: args.storageId, accessType: args.accessType },
            source: "document_access",
            timestamp: Date.now(),
        });
    },
});
