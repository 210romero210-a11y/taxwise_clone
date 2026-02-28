import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  returns: defineTable({
    name: v.string(), // e.g., "John Doe 2023"
    taxYear: v.number(),
    status: v.string(), // e.g., "In Progress", "Completed"
  }),
  formInstances: defineTable({
    returnId: v.id("returns"),
    formType: v.string(), // e.g. "1040", "W2", "SchA"
    instanceName: v.string(), // e.g. "W-2 (Google Inc)"
    status: v.string(), // "In Progress", "Complete", "Error"
    errorCount: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    // Vault Explorer metadata
    documentSource: v.optional(v.string()), // "upload", "ai_ocr", "manual"
    uploadedAt: v.optional(v.number()),
    taxpayerRole: v.optional(v.string()), // "primary", "spouse" (for MFJ)
  }).index("by_return", ["returnId"]),
  fields: defineTable({
    instanceId: v.id("formInstances"),
    fieldKey: v.string(), // e.g., "Box1", "Line1z"
    value: v.any(),
    isManualOverride: v.boolean(),
    isEstimated: v.optional(v.boolean()), // F3 Toggle
    isCalculated: v.optional(v.boolean()), // For color-coding (Blue)
  }).index("by_instance", ["instanceId"]),

  auditLogs: defineTable({
    returnId: v.id("returns"),
    userId: v.string(),
    action: v.string(), // e.g. "Field Update", "Override", "OCR Scan"
    fieldKey: v.optional(v.string()),
    previousValue: v.any(),
    newValue: v.any(),
    source: v.optional(v.string()), // "manual", "ai_ocr", "calculated"
    timestamp: v.number(),
  }).index("by_return", ["returnId"]),

  diagnostics: defineTable({
    returnId: v.id("returns"),
    instanceId: v.id("formInstances"),
    fieldKey: v.string(),
    message: v.string(),
    severity: v.string(), // "Error", "Warning", "Info"
  }).index("by_return", ["returnId"]),
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.string(), // "Admin", "Preparer", "Client"
  }).index("by_token", ["tokenIdentifier"]),

  // Form field metadata for Interview Mode wizard
  formFields: defineTable({
    fieldKey: v.string(), // e.g., "1040_Line1z", "Box1"
    fieldLabel: v.string(), // e.g., "Wages, salaries, tips"
    taxTopic: v.string(), // e.g., "Income", "Deductions", "Credits"
    inputType: v.string(), // e.g., "currency", "number", "text", "boolean"
    validationRules: v.optional(v.object({
      required: v.optional(v.boolean()),
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      pattern: v.optional(v.string()),
    })),
    metadata: v.optional(v.object({
      helpText: v.optional(v.string()),
      placeholder: v.optional(v.string()),
      relatedFields: v.optional(v.array(v.string())),
      formType: v.optional(v.string()), // "1040", "W2", "SchA", "SchC"
      lineNumber: v.optional(v.string()),
    })),
  }).index("by_taxTopic", ["taxTopic"]).index("by_fieldKey", ["fieldKey"]),

  // Running totals for incremental sum tracking
  taxTotals: defineTable({
    returnId: v.id("returns"),
    fieldKey: v.string(), // The field this total represents
    accumulatedAmount: v.number(), // Running total for this field
    updatedAt: v.number(), // Timestamp of last update
  }).index("by_return", ["returnId"]).index("by_return_fieldKey", ["returnId", "fieldKey"]),
});
