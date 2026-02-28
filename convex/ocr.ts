import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { ActionRetrier } from "@convex-dev/action-retrier";
import { RunId } from "@convex-dev/action-retrier";

const retrier = new ActionRetrier(components.actionRetrier, {
    initialBackoffMs: 1000,
    base: 2,
    maxFailures: 3,
});

/**
 * Public entry point for OCR document processing.
 * Schedules ocrInternal.processDocumentInternal with automatic
 * exponential-backoff retries via ActionRetrier (up to 3 attempts).
 */
export const processDocument = action({
    args: {
        storageId: v.id("_storage"),
        returnId: v.id("returns"),
    },
    handler: async (ctx, args): Promise<{ runId: RunId; scheduled: boolean }> => {
        const runId = await retrier.run(
            ctx,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (internal as any).ocrInternal.processDocumentInternal,
            { storageId: args.storageId, returnId: args.returnId },
        );
        return { runId, scheduled: true };
    },
});
