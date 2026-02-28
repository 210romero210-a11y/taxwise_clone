import { api } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const rateLimiter = new RateLimiter(components.rateLimiter, {
    ocr_processing: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 10 },
});

/**
 * Internal: actual OCR processing logic.
 * Separated from ocr.ts to avoid circular type inference when ocr.ts references
 * internal.ocrInternal.processDocumentInternal via ActionRetrier.
 */
export const processDocumentInternal = internalAction({
    args: {
        storageId: v.id("_storage"),
        returnId: v.id("returns"),
        taxpayerRole: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ instanceId: string; success: boolean }> => {
        // 1. Rate Limiting
        await rateLimiter.limit(ctx, "ocr_processing", {
            key: args.storageId,
            throws: true,
        });

        // 2. Fetch image
        const imageUrl = await ctx.storage.getUrl(args.storageId);
        if (!imageUrl) throw new Error("Image not found");

        const response = await fetch(imageUrl);
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString("base64");

        // 3. Call Ollama Cloud Vision Model
        const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434/api/generate";
        const model = process.env.OLLAMA_MODEL || "llama3-vision";

        const ollamaResponse = await fetch(ollamaUrl, {
            method: "POST",
            body: JSON.stringify({
                model,
                prompt: `Analyze this tax document image (W-2, 1099, or Schedule C).
                Extract all relevant fields.
                Return strictly a JSON object with:
                - formType: string (e.g., 'W2', 'SchC')
                - fields: Array<{fieldKey: string, value: string}>
                - employer: string (name of company or payer)`,
                images: [base64Image],
                stream: false,
                format: "json"
            }),
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
        }

        const result = (await ollamaResponse.json()) as { response: string };
        const extractedData = JSON.parse(result.response) as {
            formType: string;
            employer?: string;
            fields: Array<{ fieldKey: string; value: string }>;
        };

        // 4. Create form instance with OCR source tracking
        const instanceId: Id<"formInstances"> = await ctx.runMutation(api.formInstances.createInstance, {
            returnId: args.returnId,
            formType: extractedData.formType,
            instanceName: `${extractedData.formType} (${extractedData.employer || "New"})`,
            storageId: args.storageId,
            documentSource: "ai_ocr",
            taxpayerRole: args.taxpayerRole,
        });

        // 5. Populate fields
        for (const field of extractedData.fields) {
            await ctx.runMutation(api.fields.updateField, {
                instanceId,
                fieldKey: field.fieldKey,
                value: field.value,
                isManualOverride: false,
                isCalculated: false,
            });
        }

        return { instanceId, success: true };
    },
});
