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
});
