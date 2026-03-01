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

  // =============================================================================
  // IRS PUBLICATION 1345 - COMPLIANT USER AUTHENTICATION
  // =============================================================================
  // Extended users table with IRS-required security fields
  usersExtended: defineTable({
    userId: v.id("users"),
    // IRS Publication 1345 - MFA Requirements
    mfaEnabled: v.boolean(),
    mfaMethod: v.optional(v.string()), // "authenticator", "sms", "email"
    mfaSecret: v.optional(v.string()), // Encrypted TOTP secret
    // Professional Preparer Credentials (IRS EFIN/PTIN)
    preparerTIN: v.optional(v.string()), // PTIN or EIN
    efin: v.optional(v.string()), // Electronic Filing Identification Number
    // Session Security (15-min timeout, 12-hr re-auth)
    lastAuthTime: v.optional(v.number()),
    sessionExpiry: v.optional(v.number()),
    lastActivityTime: v.optional(v.number()),
    isPreparer: v.boolean(), // Professional preparer flag
  }).index("by_user", ["userId"]),

  // =============================================================================
  // FLIGHT RECORDER - IMMUTABLE AUDIT TRAIL (IRS COMPLIANT)
  // =============================================================================
  // Cryptographically chained audit log entries for tamper detection
  immutableAuditLogs: defineTable({
    returnId: v.id("returns"),
    userId: v.string(),
    action: v.string(), // "Field Update", "Override", "OCR Scan", "Submission"
    fieldKey: v.optional(v.string()),
    previousValue: v.any(),
    newValue: v.any(),
    source: v.optional(v.string()), // "manual", "ai_ocr", "calculated", "mef_transmission"
    timestamp: v.number(),
    // Cryptographic chain for tamper detection
    previousEntryHash: v.optional(v.string()), // SHA-256 hash of previous entry
    entryHash: v.string(), // SHA-256 hash of this entry
  }).index("by_return", ["returnId"]).index("by_timestamp", ["timestamp"]),

  // Chain blocks for periodic hash verification
  auditChainBlocks: defineTable({
    startTimestamp: v.number(),
    endTimestamp: v.number(),
    blockHash: v.string(), // Combined hash of all entries in block
    previousBlockHash: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_timestamp", ["startTimestamp"]),

  // =============================================================================
  // MEF ENGINE - MODERNIZED E-FILE TRANSMISSION
  // =============================================================================
  // MeF submission tracking
  mefSubmissions: defineTable({
    returnId: v.id("returns"),
    submissionType: v.string(), // "1040", "1120", "941", etc.
    taxYear: v.number(),
    // XML Payload
    xmlPayloadId: v.optional(v.id("_storage")),
    xmlStatus: v.string(), // "generated", "validated", "transmitted", "accepted", "rejected"
    // IRS Transmission
    irsSubmissionId: v.optional(v.string()), // IRS assigned submission ID
    irsReceiptTimestamp: v.optional(v.number()),
    irsAcknowledgmentCode: v.optional(v.string()), // "ACCEPTED", "REJECTED"
    irsErrorCodes: v.optional(v.array(v.string())),
    // Transmission details
    transmissionAttempts: v.optional(v.number()),
    lastTransmissionError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_return", ["returnId"]).index("by_irs_submission", ["irsSubmissionId"]),

  // MeF validation rules results
  mefValidationResults: defineTable({
    submissionId: v.id("mefSubmissions"),
    ruleId: v.string(), // MeF business rule identifier
    ruleName: v.string(),
    severity: v.string(), // "error", "warning"
    message: v.string(),
    fieldKey: v.optional(v.string()),
    isPassed: v.boolean(),
  }).index("by_submission", ["submissionId"]),

  // =============================================================================
  // BILINGUAL SUPPORT ENGINE - EN/ES LOCALIZATION
  // =============================================================================
  // Translation strings for EN/ES
  translations: defineTable({
    locale: v.string(), // "en" or "es"
    category: v.string(), // "diagnostics", "forms", "help", "ui"
    key: v.string(), // Unique key within category
    value: v.string(), // Translated text
  }).index("by_locale_category", ["locale", "category"]).index("by_key", ["key"]),

  // Spanish form metadata for print engine
  spanishForms: defineTable({
    formType: v.string(), // "1040", "SchA", "SchC", etc.
    spanishTitle: v.string(),
    availableForPrint: v.boolean(),
    taxYears: v.array(v.number()),
  }).index("by_form", ["formType"]),

  // User locale preferences
  userPreferences: defineTable({
    userId: v.id("users"),
    locale: v.string(), // "en" or "es"
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // =============================================================================
  // METADATA-DRIVEN FORM ENGINE - DYNAMIC FORM DEFINITIONS
  // =============================================================================
  // JSON schema blueprints for IRS forms
  formDefinitions: defineTable({
    formCode: v.string(), // e.g., "1040", "1120S", "990"
    year: v.number(),
    entityType: v.string(), // "Individual" | "Business" | "Specialty"
    formName: v.string(),
    sections: v.any(), // JSON structure for form sections
    metadata: v.any(), // Additional form-specific data
    isActive: v.boolean(),
  }).index("by_formCode_year", ["formCode", "year"]).index("by_entityType", ["entityType"]),

  // Field metadata with formulas and dependencies
  fieldDefinitions: defineTable({
    formCode: v.string(),
    year: v.number(),
    fieldKey: v.string(), // e.g., "Line1z", "Box1"
    label: v.string(),
    labelEs: v.string(), // Spanish label
    fieldType: v.string(), // "currency" | "number" | "text" | "boolean" | "date"
    isCalculated: v.boolean(),
    formula: v.optional(v.string()),
    dependsOn: v.array(v.string()), // Array of field keys this depends on
    isRequired: v.boolean(),
    category: v.string(), // "income" | "deduction" | "credit" | "info"
    irsLineReference: v.string(),
    helpText: v.string(),
    helpTextEs: v.string(),
  }).index("by_formCode_year", ["formCode", "year"]).index("by_fieldKey", ["fieldKey"]),

  // Reusable IRS business rules
  validationRules: defineTable({
    ruleId: v.string(), // e.g., "WAGES_POSITIVE"
    formCode: v.string(),
    year: v.number(),
    fieldKey: v.string(),
    condition: v.string(), // JSON logic for when rule applies
    errorMessageEn: v.string(),
    errorMessageEs: v.string(),
    severity: v.string(), // "error" | "warning"
    isActive: v.boolean(),
  }).index("by_formCode_year", ["formCode", "year"]).index("by_ruleId", ["ruleId"]),

  // Cross-form field mapping
  mappingEngine: defineTable({
    sourceFormCode: v.string(),
    sourceYear: v.number(),
    sourceFieldKey: v.string(),
    targetFormCode: v.string(),
    targetYear: v.number(),
    targetFieldKey: v.string(),
    mappingType: v.string(), // "flow_through" | "k1_sync" | "calculation"
    transform: v.optional(v.string()), // Optional transformation formula
    isActive: v.boolean(),
  }).index("by_source", ["sourceFormCode", "sourceYear", "sourceFieldKey"]).index("by_target", ["targetFormCode", "targetYear", "targetFieldKey"]),

  // K-1 pass-through data
  k1Records: defineTable({
    returnId: v.id("returns"), // The business return - 1065/1120S
    partnerId: v.string(), // Recipient's individual return ID
    ein: v.string(),
    recipientName: v.string(),
    recipientTin: v.string(),
    k1Data: v.any(), // JSON with all K-1 fields
    syncStatus: v.string(), // "pending" | "synced" | "error"
    syncedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_return", ["returnId"]).index("by_partnerId", ["partnerId"]).index("by_syncStatus", ["syncStatus"]),

  // Entity lifecycle tracking
  lifecycleStatus: defineTable({
    returnId: v.id("returns"),
    entityType: v.string(), // "Individual" | "Business" | "Specialty"
    status: v.string(), // "Draft" | "Review" | "Ready" | "Transmitted" | "Accepted" | "Rejected"
    previousStatus: v.optional(v.string()),
    statusChangedAt: v.number(),
    changedBy: v.string(),
    diagnosticCount: v.number(),
    lastDiagnosticRunAt: v.optional(v.number()),
  }).index("by_return", ["returnId"]).index("by_status", ["status"]).index("by_entityType", ["entityType"]),
});
