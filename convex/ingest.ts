import { v } from "convex/values";
import { action } from "./_generated/server";
import { components } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
import { createOpenAI } from "@ai-sdk/openai";

// Configure embedding model using Ollama's OpenAI-compatible API
const ollamaEmbedding = createOpenAI({
    baseURL: process.env.OLLAMA_API_URL || "http://localhost:11434/v1",
    apiKey: "ollama",
});

const rag = new RAG(components.rag, {
    embeddingDimension: 768,
    textEmbeddingModel: ollamaEmbedding.embedding("nomic-embed-text"),
});

/**
 * Ingests tax law snippets into the Compliance Knowledge Base.
 * Usage: npx convex run ingest:ingestLawSnippet
 */
export const ingestLawSnippet = action({
    args: {
        namespace: v.string(), // e.g. "compliance-2025"
        text: v.string(),
        source: v.string(), // e.g. "IRS Pub 17, Page 24"
        category: v.string(), // e.g. "Standard Deduction"
    },
    handler: async (ctx, args) => {
        await rag.add(ctx, {
            namespace: args.namespace,
            text: args.text,
        });
        return { success: true };
    },
});

/**
 * Semantic search the Compliance Knowledge Base for tax rules.
 */
export const searchComplianceRules = action({
    args: {
        namespace: v.string(),
        query: v.string(),
    },
    handler: async (ctx, args) => {
        const results = await rag.search(ctx, {
            namespace: args.namespace,
            query: args.query,
            limit: 3,
        });
        return results;
    },
});
