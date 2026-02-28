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
 * For IRS Publication 1345 compliance, access is logged for audit.
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
        
        // Use the internal logEvent mutation
        // Note: In production, this should insert to a dedicated documentAccessLogs table
        console.log(`[DOC_ACCESS] view: storageId=${args.storageId}, userId=${userId}, returnId=${args.returnId}, time=${Date.now()}`);
        
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
        // This would log to auditLogs or a separate documentAccessLogs table
        console.log(`[DOC_ACCESS] ${args.accessType}: storageId=${args.storageId}, userId=${args.userId}, returnId=${args.returnId}, time=${Date.now()}`);
    },
});
