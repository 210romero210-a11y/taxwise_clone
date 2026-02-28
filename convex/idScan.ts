import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal, components } from "./_generated/api";
import { ActionRetrier } from "@convex-dev/action-retrier";
import { RunId } from "@convex-dev/action-retrier";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { Id } from "./_generated/dataModel";

const retrier = new ActionRetrier(components.actionRetrier, {
    initialBackoffMs: 1000,
    base: 2,
    maxFailures: 3,
});

const rateLimiter = new RateLimiter(components.rateLimiter, {
    id_scan_processing: { kind: "token bucket", rate: 3, period: MINUTE, capacity: 5 },
});

/**
 * Public entry point for ID document scanning.
 * Processes Driver's Licenses, SSN Cards, and other ID documents
 * using specialized vision models (Gemma 3) for demographic extraction.
 */
export const scanIdDocument = action({
    args: {
        storageId: v.id("_storage"),
        returnId: v.id("returns"),
        idType: v.optional(v.string()), // "drivers_license", "ssn_card", "passport"
        taxpayerRole: v.optional(v.string()), // "primary" or "spouse" for MFJ
    },
    handler: async (ctx, args): Promise<{ runId: RunId; scheduled: boolean }> => {
        // Get user identity for audit trail
        const identity = await ctx.auth.getUserIdentity();
        const userId = identity?.subject || "anonymous";
        
        const runId = await retrier.run(
            ctx,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (internal as any).idScanInternal.processIdDocumentInternal,
            { 
                storageId: args.storageId, 
                returnId: args.returnId,
                idType: args.idType,
                taxpayerRole: args.taxpayerRole,
                userId,
            },
        );
        return { runId, scheduled: true };
    },
});

/**
 * Internal: actual ID document processing logic.
 * Uses Gemma 3 or similar vision model specialized for ID extraction.
 * 
 * @param userId - The user performing the action (passed from public action)
 */
export const processIdDocumentInternal = internalAction({
    args: {
        storageId: v.id("_storage"),
        returnId: v.id("returns"),
        idType: v.optional(v.string()),
        taxpayerRole: v.optional(v.string()),
        userId: v.string(), // Required - passed from public action
    },
    handler: async (ctx, args): Promise<{ instanceId: string; success: boolean; extractedFields: Record<string, string> }> => {
        // 1. Rate Limiting
        await rateLimiter.limit(ctx, "id_scan_processing", {
            key: args.storageId,
            throws: true,
        });

        // 2. Fetch image
        const imageUrl = await ctx.storage.getUrl(args.storageId);
        if (!imageUrl) throw new Error("Image not found");

        const response = await fetch(imageUrl);
        const imageBuffer = await response.arrayBuffer();
        // Use Web API for base64 encoding (compatible with serverless environment)
        const bytes = new Uint8Array(imageBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64Image = btoa(binary);

        // 3. Call Ollama Cloud Vision Model (Gemma 3 for ID)
        const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434/api/generate";
        const model = process.env.OLLAMA_ID_MODEL || "gemma3"; // Specialized ID model

        // Specialized prompt for ID documents
        const idPrompt = args.idType === "ssn_card" 
            ? `Analyze this Social Security Card image.
            Extract the following fields and return ONLY valid JSON:
            - ssn_holder_name: string (full name as shown on card)
            - ssn_number: string (full SSN in XXX-XX-XXXX format)
            - birth_date: string (if visible, in YYYY-MM-DD format)
            - issue_date: string (if visible, in YYYY-MM-DD format)
            Return ONLY a JSON object, no other text.`
            : args.idType === "passport"
            ? `Analyze this Passport image.
            Extract the following fields and return ONLY valid JSON:
            - full_name: string (as shown in passport)
            - date_of_birth: string (in YYYY-MM-DD format)
            - nationality: string
            - passport_number: string
            - expiration_date: string (in YYYY-MM-DD format)
            - sex: string (M/F)
            Return ONLY a JSON object, no other text.`
            : `Analyze this Driver's License or State ID image.
            Extract the following fields and return ONLY valid JSON:
            - full_name: string (full name as shown on license)
            - date_of_birth: string (in YYYY-MM-DD format)
            - address: string (full street address)
            - license_number: string
            - expiration_date: string (in YYYY-MM-DD format)
            - state: string (2-letter state code)
            - sex: string (M/F/X)
            - class: string (license class if visible)
            Return ONLY a JSON object, no other text.`;

        const ollamaResponse = await fetch(ollamaUrl, {
            method: "POST",
            body: JSON.stringify({
                model,
                prompt: idPrompt,
                images: [base64Image],
                stream: false,
                format: "json"
            }),
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama ID Scan API error: ${ollamaResponse.statusText}`);
        }

        const result = (await ollamaResponse.json()) as { response: string };
        let extractedData: Record<string, string>;
        
        try {
            extractedData = JSON.parse(result.response);
        } catch {
            throw new Error("Failed to parse ID extraction response. Ensure the model returns valid JSON.");
        }

        // 4. Create a "Demographics" form instance to store ID data
        const instanceId: Id<"formInstances"> = await ctx.runMutation(api.formInstances.createInstance, {
            returnId: args.returnId,
            formType: "ID_SCAN",
            instanceName: `${args.idType || "ID"} Document (${args.taxpayerRole === "spouse" ? "Spouse" : "Primary"})`,
            storageId: args.storageId,
            documentSource: "ai_ocr",
            taxpayerRole: args.taxpayerRole,
        });

        // 5. Populate ID fields
        const fieldMappings: Record<string, string> = {
            drivers_license: "DL",
            ssn_card: "SSN",
            passport: "PASSPORT",
        };
        
        for (const [key, value] of Object.entries(extractedData)) {
            await ctx.runMutation(api.fields.updateField, {
                instanceId,
                fieldKey: `${fieldMappings[args.idType || ""] || "ID"}_${key}`,
                value: value,
                isManualOverride: false,
                isCalculated: false,
            });
        }

        // 6. Log the ID scan action for audit (using userId passed from public action)
        await ctx.runMutation(internal.auditLogs.logEvent, {
            returnId: args.returnId,
            userId: args.userId,
            action: "ID Scan",
            fieldKey: "ID_DOCUMENT",
            previousValue: null,
            newValue: { idType: args.idType, extractedFields: Object.keys(extractedData) },
            source: "ai_ocr",
        });

        return { instanceId, success: true, extractedFields: extractedData };
    },
});
