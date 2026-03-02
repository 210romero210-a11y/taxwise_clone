import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// =============================================================================
// VALIDATION RULES ENGINE - IRS FORM FIELD VALIDATION
// =============================================================================
// This module provides CRUD operations for validation rules that enforce
// data integrity and compliance for tax form fields.

// =============================================================================
// CONDITION EVALUATION ENGINE
// =============================================================================

/**
 * Validate condition string to prevent injection attacks
 * Only allows specific comparison patterns
 */
function isValidCondition(condition: string): boolean {
  // Whitelist of allowed patterns
  const allowedPatterns = [
    /^value\s*(>=|>|===|!==|<|<=|=)\s*(-?\d+\.?\d*)$/,
    /^value\.length\s*(===|!==|>|>=|<|<=)\s*(\d+)$/,
    /^value\s+matches\s+\/.+\/([gimsuy]*)$/,
    /^value\s*(===|!==)\s*['"](.*)['"]$/,
    /^value\s*(===|!==)\s*null$/,
    /^value\s*(===|!==)\s*''$/,
  ];
  
  // Block dangerous patterns
  const dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /`.*\$\{/,
    /;/,
    /\bawait\b/,
    /\bnew\s+\w+\s*\(/,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(condition)) {
      console.warn(`Blocked dangerous pattern in condition: ${condition}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Evaluate a condition string against a value
 * Supports common validation patterns for tax fields
 * 
 * Supported conditions:
 * - "value >= 0" - Must be non-negative
 * - "value > 0" - Must be positive
 * - "value < 1000000" - Must be less than threshold
 * - "value.length === 9" - Exact length check
 * - "value matches /pattern/" - Regex pattern matching
 * - "value !== ''" - Not empty
 * - "value !== null" - Not null/undefined
 */
export function evaluateCondition(value: unknown, condition: string): boolean {
  // Validate condition string for security
  if (!isValidCondition(condition)) {
    console.error("Invalid condition string rejected:", condition);
    return false;
  }
  
  try {
    // Handle empty/null values
    if (value === null || value === undefined || value === "") {
      // For required checks, empty fails
      if (condition.includes("!== ''") || condition.includes("!== null")) {
        return false;
      }
      // For positive/non-negative checks, empty fails
      if (condition.includes("> 0") || (condition.includes(">= 0") && condition !== "value >= 0")) {
        return false;
      }
      // For length checks, empty fails
      if (condition.includes(".length")) {
        return false;
      }
    }

    // Handle regex matches: "value matches /^\d{3}-\d{2}-\d{4}$/"
    const matchRegex = condition.match(/value\s+matches\s+\/(.+)\/([gimsuy]*)/);
    if (matchRegex) {
      const pattern = new RegExp(matchRegex[1], matchRegex[2]);
      return pattern.test(String(value));
    }

    // Handle length checks: "value.length === 9"
    const lengthMatch = condition.match(/value\.length\s*(===|!==|>|>=|<|<=)\s*(\d+)/);
    if (lengthMatch && value !== null && value !== undefined) {
      const operator = lengthMatch[1];
      const target = parseInt(lengthMatch[2], 10);
      const actualLength = String(value).length;
      
      switch (operator) {
        case "===": return actualLength === target;
        case "!==": return actualLength !== target;
        case ">": return actualLength > target;
        case ">=": return actualLength >= target;
        case "<": return actualLength < target;
        case "<=": return actualLength <= target;
        default: return false;
      }
    }

    // Handle numeric comparisons: "value >= 0", "value > 0", "value < 1000000"
    const numericMatch = condition.match(/value\s*(>=|>|===|!==|<|<=|=)\s*(-?\d+\.?\d*)/);
    if (numericMatch) {
      const operator = numericMatch[1];
      const target = parseFloat(numericMatch[2]);
      const numValue = typeof value === "number" ? value : parseFloat(String(value));
      
      if (isNaN(numValue)) return false;
      
      switch (operator) {
        case ">=": return numValue >= target;
        case ">": return numValue > target;
        case "===": return numValue === target;
        case "!==": return numValue !== target;
        case "<=": return numValue <= target;
        case "<": return numValue < target;
        case "=": return numValue === target;
        default: return false;
      }
    }

    // Handle not empty: "value !== ''"
    if (condition === "value !== ''") {
      return value !== null && value !== undefined && value !== "";
    }

    // Handle not null: "value !== null"
    if (condition === "value !== null") {
      return value !== null && value !== undefined;
    }

    // Handle simple equality: "value === 'something'"
    const equalityMatch = condition.match(/value\s*(===|!==)\s*['"](.+)['"]/);
    if (equalityMatch) {
      const operator = equalityMatch[1];
      const target = equalityMatch[2];
      const strValue = String(value);
      
      if (operator === "===") return strValue === target;
      if (operator === "!==") return strValue !== target;
    }

    // Default: fail if condition not recognized
    console.warn(`Unrecognized condition: ${condition}`);
    return false;
  } catch (error) {
    console.error("Error evaluating condition:", error);
    return false;
  }
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get a specific validation rule by ruleId
 */
export const getValidationRule = query({
  args: { 
    ruleId: v.string() 
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db
      .query("validationRules")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", args.ruleId))
      .first();
    
    return rule;
  },
});

/**
 * Get all validation rules for a specific form and year
 */
export const getRulesByForm = query({
  args: { 
    formCode: v.string(),
    year: v.number()
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("validationRules")
      .withIndex("by_formCode_year", (q) => 
        q.eq("formCode", args.formCode).eq("year", args.year)
      )
      .collect();
    
    return rules;
  },
});

/**
 * Get all active validation rules for a form/year
 */
export const getActiveRules = query({
  args: { 
    formCode: v.string(),
    year: v.number()
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("validationRules")
      .withIndex("by_formCode_year", (q) => 
        q.eq("formCode", args.formCode).eq("year", args.year)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    return rules;
  },
});

/**
 * Get rules filtered by severity (error/warning)
 */
export const getRulesBySeverity = query({
  args: { 
    formCode: v.string(),
    year: v.number(),
    severity: v.union(v.literal("error"), v.literal("warning"))
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("validationRules")
      .withIndex("by_formCode_year", (q) => 
        q.eq("formCode", args.formCode).eq("year", args.year)
      )
      .filter((q) => q.eq(q.field("severity"), args.severity))
      .collect();
    
    return rules;
  },
});

/**
 * List all validation rules with pagination
 */
export const listValidationRules = query({
  args: { 
    skip: v.optional(v.number()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const skip = args.skip ?? 0;
    const limit = args.limit ?? 50;
    
    // Get total count
    const allRules = await ctx.db.query("validationRules").collect();
    const total = allRules.length;
    
    // Get paginated results - Convex doesn't support skip, use take and manual slice
    const rules = await ctx.db
      .query("validationRules")
      .order("desc")
      .take(skip + limit);
    
    const paginatedRules = rules.slice(skip, skip + limit);
    
    return {
      rules: paginatedRules,
      total,
      hasMore: skip + paginatedRules.length < total,
    };
  },
});

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new validation rule
 */
export const createValidationRule = mutation({
  args: {
    ruleId: v.string(),
    formCode: v.string(),
    year: v.number(),
    fieldKey: v.string(),
    condition: v.string(),
    errorMessageEn: v.string(),
    errorMessageEs: v.string(),
    severity: v.union(v.literal("error"), v.literal("warning")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check if rule already exists
    const existing = await ctx.db
      .query("validationRules")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", args.ruleId))
      .first();
    
    if (existing) {
      throw new Error(`Validation rule with ruleId "${args.ruleId}" already exists`);
    }
    
    const ruleId = await ctx.db.insert("validationRules", {
      ...args,
      isActive: args.isActive ?? true,
    });
    
    return ruleId;
  },
});

/**
 * Update an existing validation rule
 */
export const updateValidationRule = mutation({
  args: {
    ruleId: v.string(),
    formCode: v.optional(v.string()),
    year: v.optional(v.number()),
    fieldKey: v.optional(v.string()),
    condition: v.optional(v.string()),
    errorMessageEn: v.optional(v.string()),
    errorMessageEs: v.optional(v.string()),
    severity: v.optional(v.union(v.literal("error"), v.literal("warning"))),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { ruleId, ...updates } = args;
    
    // Find the rule
    const existing = await ctx.db
      .query("validationRules")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", ruleId))
      .first();
    
    if (!existing) {
      throw new Error(`Validation rule with ruleId "${ruleId}" not found`);
    }
    
    // Apply updates
    await ctx.db.patch(existing._id, updates);
    
    return existing._id;
  },
});

/**
 * Soft-delete (deactivate) a validation rule
 */
export const deactivateValidationRule = mutation({
  args: {
    ruleId: v.string(),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db
      .query("validationRules")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", args.ruleId))
      .first();
    
    if (!rule) {
      throw new Error(`Validation rule with ruleId "${args.ruleId}" not found`);
    }
    
    await ctx.db.patch(rule._id, { isActive: false });
    
    return rule._id;
  },
});

/**
 * Seed default validation rules for Form 1040
 * These are the core validation rules for individual tax returns
 */
export const seedDefaultRules = mutation({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const year = args.year ?? 2024;
    
    const defaultRules = [
      {
        ruleId: "WAGES_POSITIVE",
        formCode: "1040",
        year,
        fieldKey: "Line1z",
        condition: "value >= 0",
        errorMessageEn: "Wages, salaries, tips must be zero or greater",
        errorMessageEs: "Los salarios, sueldos y propinas deben ser cero o mayores",
        severity: "error" as const,
      },
      {
        ruleId: "SSN_FORMAT",
        formCode: "1040",
        year,
        fieldKey: "TaxpayerSSN",
        condition: "value matches /^\\d{3}-\\d{2}-\\d{4}$/",
        errorMessageEn: "Taxpayer Social Security Number must be in format XXX-XX-XXXX",
        errorMessageEs: "El número de Seguro Social del contribuyente debe estar en formato XXX-XX-XXXX",
        severity: "error" as const,
      },
      {
        ruleId: "SPOUSE_SSN_FORMAT",
        formCode: "1040",
        year,
        fieldKey: "SpouseSSN",
        condition: "value matches /^\\d{3}-\\d{2}-\\d{4}$/",
        errorMessageEn: "Spouse Social Security Number must be in format XXX-XX-XXXX",
        errorMessageEs: "El número de Seguro Social del cónyuge debe estar en formato XXX-XX-XXXX",
        severity: "error" as const,
      },
      {
        ruleId: "EIN_FORMAT",
        formCode: "1040",
        year,
        fieldKey: "EmployerEIN",
        condition: "value matches /^\\d{2}-\\d{7}$/",
        errorMessageEn: "Employer EIN should be in format XX-XXXXXXX",
        errorMessageEs: "El EIN del empleador debe estar en formato XX-XXXXXXX",
        severity: "warning" as const,
      },
      {
        ruleId: "WITHHOLDING_POSITIVE",
        formCode: "1040",
        year,
        fieldKey: "Line25a",
        condition: "value >= 0",
        errorMessageEn: "Federal income tax withheld must be zero or greater",
        errorMessageEs: "El impuesto federal sobre la renta retenido debe ser cero o mayor",
        severity: "error" as const,
      },
      {
        ruleId: "WITHHOLDING_POSITIVE_B",
        formCode: "1040",
        year,
        fieldKey: "Line25b",
        condition: "value >= 0",
        errorMessageEn: "Social security taxes withheld must be zero or greater",
        errorMessageEs: "Los impuestos de Seguro Social retenidos deben ser cero o mayores",
        severity: "error" as const,
      },
      {
        ruleId: "NAME_REQUIRED",
        formCode: "1040",
        year,
        fieldKey: "FirstName",
        condition: "value !== ''",
        errorMessageEn: "First name is required",
        errorMessageEs: "El nombre es requerido",
        severity: "error" as const,
      },
      {
        ruleId: "LASTNAME_REQUIRED",
        formCode: "1040",
        year,
        fieldKey: "LastName",
        condition: "value !== ''",
        errorMessageEn: "Last name is required",
        errorMessageEs: "El apellido es requerido",
        severity: "error" as const,
      },
      {
        ruleId: "INCOME_POSITIVE",
        formCode: "1040",
        year,
        fieldKey: "Line9",
        condition: "value >= 0",
        errorMessageEn: "Total income cannot be negative",
        errorMessageEs: "El ingreso total no puede ser negativo",
        severity: "error" as const,
      },
      {
        ruleId: "FILING_STATUS_REQUIRED",
        formCode: "1040",
        year,
        fieldKey: "FilingStatus",
        condition: "value !== ''",
        errorMessageEn: "Filing status must be selected",
        errorMessageEs: "Debe seleccionar un estado civil",
        severity: "error" as const,
      },
      {
        ruleId: "ACCOUNT_ROUTING_LENGTH",
        formCode: "1040",
        year,
        fieldKey: "BankRoutingNumber",
        condition: "value.length === 9",
        errorMessageEn: "Bank routing number must be exactly 9 digits",
        errorMessageEs: "El número de ruta bancaria debe tener exactamente 9 dígitos",
        severity: "warning" as const,
      },
      {
        ruleId: "ACCOUNT_NUMBER_LENGTH",
        formCode: "1040",
        year,
        fieldKey: "BankAccountNumber",
        condition: "value.length >= 4",
        errorMessageEn: "Bank account number must be between 4 and 17 digits",
        errorMessageEs: "El número de cuenta bancaria debe tener entre 4 y 17 dígitos",
        severity: "warning" as const,
      },
      {
        ruleId: "TAXABLE_SOCIAL_SECURITY",
        formCode: "1040",
        year,
        fieldKey: "Line6a",
        condition: "value >= 0",
        errorMessageEn: "Social security benefits must be zero or greater",
        errorMessageEs: "Los beneficios del Seguro Social deben ser cero o mayores",
        severity: "error" as const,
      },
      {
        ruleId: "IRA_CONTRIBUTION_LIMIT",
        formCode: "1040",
        year,
        fieldKey: "Line20",
        condition: "value <= 7000",
        errorMessageEn: "IRA contribution cannot exceed $7,000",
        errorMessageEs: "La contribución IRA no puede exceder $7,000",
        severity: "warning" as const,
      },
      {
        ruleId: "STANDARD_DEDUCTION_REQUIRED",
        formCode: "1040",
        year,
        fieldKey: "Line12",
        condition: "value > 0",
        errorMessageEn: "Standard or itemized deduction must be greater than zero",
        errorMessageEs: "La deducción estándar o detallada debe ser mayor que cero",
        severity: "error" as const,
      },
    ];
    
    const createdRules: string[] = [];
    
    for (const rule of defaultRules) {
      // Check if rule already exists
      const existing = await ctx.db
        .query("validationRules")
        .withIndex("by_ruleId", (q) => q.eq("ruleId", rule.ruleId))
        .filter((q) => q.eq(q.field("year"), year))
        .first();
      
      if (!existing) {
        await ctx.db.insert("validationRules", {
          ...rule,
          isActive: true,
        });
        createdRules.push(rule.ruleId);
      }
    }
    
    return {
      seeded: createdRules.length,
      rules: createdRules,
    };
  },
});

// =============================================================================
// RULE EVALUATION API
// =============================================================================

/**
 * Evaluate a single validation rule against a value
 * Returns true if the rule passes (value is valid)
 */
export const evaluateRule = query({
  args: {
    ruleId: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db
      .query("validationRules")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", args.ruleId))
      .first();
    
    if (!rule) {
      return {
        valid: false,
        error: `Rule "${args.ruleId}" not found`,
        ruleId: args.ruleId,
      };
    }
    
    if (!rule.isActive) {
      return {
        valid: true,
        message: "Rule is inactive, skipping validation",
        ruleId: args.ruleId,
      };
    }
    
    const isValid = evaluateCondition(args.value, rule.condition);
    
    return {
      valid: isValid,
      ruleId: args.ruleId,
      fieldKey: rule.fieldKey,
      severity: rule.severity,
      message: isValid ? null : rule.errorMessageEn,
      messageEs: isValid ? null : rule.errorMessageEs,
    };
  },
});

/**
 * Evaluate all active rules for a form and return violations
 */
export const evaluateFormRules = query({
  args: {
    formCode: v.string(),
    year: v.number(),
    fieldValues: v.record(v.string(), v.any()),
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("validationRules")
      .withIndex("by_formCode_year", (q) => 
        q.eq("formCode", args.formCode).eq("year", args.year)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const violations: Array<{
      ruleId: string;
      fieldKey: string;
      severity: string;
      message: string;
      messageEs: string;
    }> = [];
    
    for (const rule of rules) {
      const value = args.fieldValues[rule.fieldKey];
      const isValid = evaluateCondition(value, rule.condition);
      
      if (!isValid) {
        violations.push({
          ruleId: rule.ruleId,
          fieldKey: rule.fieldKey,
          severity: rule.severity,
          message: rule.errorMessageEn,
          messageEs: rule.errorMessageEs,
        });
      }
    }
    
    return {
      totalRules: rules.length,
      violations,
      errorCount: violations.filter(v => v.severity === "error").length,
      warningCount: violations.filter(v => v.severity === "warning").length,
    };
  },
});
