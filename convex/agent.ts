import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, components } from "./_generated/api";
import { Agent, createTool, type ToolCtx } from "@convex-dev/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

// 1. Configure the Ollama Provider (OpenAI Compatible)
const ollama = createOpenAI({
    baseURL: process.env.OLLAMA_API_URL || "http://localhost:11434/v1",
    apiKey: "ollama",
});

// 2. Tool handler functions with explicit types to break circular inference

async function handleUpdateTaxField(
    ctx: ToolCtx,
    args: { instanceId: string; fieldKey: string; newValue: string | number }
): Promise<string> {
    await ctx.runMutation(api.fields.updateField, {
        instanceId: args.instanceId as any,
        fieldKey: args.fieldKey,
        value: args.newValue,
        isManualOverride: false,
        isCalculated: true,
    });
    return `Updated ${args.fieldKey} to ${args.newValue}`;
}

async function handleGetDiagnostics(
    ctx: ToolCtx,
    args: { returnId: string }
): Promise<string> {
    const errors = await ctx.runQuery(api.diagnostics.getForReturn, {
        returnId: args.returnId as any,
    });
    return JSON.stringify(errors);
}

// 3. Define Tools using extracted handlers
const updateTaxField = createTool({
    description: "Updates a specific tax field value by its key (e.g. '1040_Line1z').",
    args: z.object({
        instanceId: z.string(),
        fieldKey: z.string(),
        newValue: z.number().or(z.string()),
    }),
    handler: handleUpdateTaxField,
});

const getDiagnostics = createTool({
    description: "Retrieves any tax compliance errors or warnings for the current return.",
    args: z.object({
        returnId: z.string(),
    }),
    handler: handleGetDiagnostics,
});

// 4. Initialize the Phoenix Assistant
const phoenixAssistant = new Agent(components.agent, {
    name: "Phoenix Tax Assistant",
    languageModel: ollama(process.env.OLLAMA_MODEL || "llama3"),
    instructions: `You are the Phoenix Tax Assistant, a professional tax prep expert.
    You help preparers fill out IRS forms accurately.
    Use the tools provided to update fields or check for errors.
    Always use a professional, helpful tone.`,
    tools: {
        updateTaxField,
        getDiagnostics,
    },
});

/**
 * Main entry point for chatting with the AI Assistant.
 */
export const chat = action({
    args: {
        message: v.string(),
        threadId: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<string> => {
        const { text } = await phoenixAssistant.generateText(
            ctx,
            { threadId: args.threadId },
            { prompt: args.message }
        );
        return text as string;
    },
});
