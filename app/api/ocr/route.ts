import { NextResponse } from 'next/server';
import { fetchAction } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

/**
 * Thin proxy: receives a storageId + returnId from the client,
 * delegates all OCR logic to convex/ocrInternal.ts via the
 * public ocr.processDocument action (which uses ActionRetrier +
 * RateLimiter and writes results through fields.updateField,
 * triggering the full dependency engine including 1040_RefundAmount).
 *
 * No OCR logic lives here — this route is purely a Next.js server-side
 * bridge so that server components / API consumers can trigger the
 * Convex pipeline without exposing the Convex URL to the browser.
 */
export async function POST(req: Request) {
    try {
        const { storageId, returnId } = await req.json();

        if (!storageId || !returnId) {
            return NextResponse.json(
                { error: 'storageId and returnId are required' },
                { status: 400 }
            );
        }

        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!convexUrl) {
            return NextResponse.json(
                { error: 'NEXT_PUBLIC_CONVEX_URL is not configured.' },
                { status: 500 }
            );
        }

        const result = await fetchAction(
            api.ocr.processDocument,
            {
                storageId: storageId as Id<'_storage'>,
                returnId: returnId as Id<'returns'>,
            },
            { url: convexUrl }
        );

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('OCR proxy error:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to process document via Convex OCR pipeline.' },
            { status: 500 }
        );
    }
}
