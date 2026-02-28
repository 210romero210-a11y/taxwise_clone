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

        // Runtime validation for Convex ID formats
        const isValidStorageId = typeof storageId === 'string' && storageId.length > 0;
        const isValidReturnId = typeof returnId === 'string' && returnId.length > 0;
        
        if (!isValidStorageId || !isValidReturnId) {
            return NextResponse.json(
                { error: 'Invalid ID format: IDs must be non-empty strings' },
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
        
        // More descriptive error handling based on error type
        if (error.message?.includes('CONVEX_DEPLOYMENT')) {
            return NextResponse.json(
                { error: 'Convex deployment not configured. Please check CONVEX_DEPLOYMENT environment variable.' },
                { status: 500 }
            );
        }
        
        if (error.message?.includes('fetch') || error.cause?.code === 'ENOTFOUND') {
            return NextResponse.json(
                { error: 'Unable to connect to Convex. Please check your network connection.' },
                { status: 503 }
            );
        }
        
        if (error.message?.includes('rate limit') || error.message?.includes('RateLimiter')) {
            return NextResponse.json(
                { error: 'OCR processing rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }
        
        return NextResponse.json(
            { error: error?.message || 'Failed to process document via Convex OCR pipeline.' },
            { status: 500 }
        );
    }
}
