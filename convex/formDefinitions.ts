import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get a specific form definition by formCode and year
 */
export const getFormDefinition = query({
  args: {
    formCode: v.string(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const definitions = await ctx.db
      .query("formDefinitions")
      .withIndex("by_formCode_year", (q) =>
        q.eq("formCode", args.formCode).eq("year", args.year)
      )
      .collect();
    
    // Return the first active match, or the first match regardless of active status
    return definitions.find(d => d.isActive) || definitions[0] || null;
  },
});

/**
 * Get all forms for an entity type (Individual/Business/Specialty)
 */
export const getFormDefinitionsByEntityType = query({
  args: {
    entityType: v.union(v.literal("Individual"), v.literal("Business"), v.literal("Specialty")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("formDefinitions")
      .withIndex("by_entityType", (q) => q.eq("entityType", args.entityType))
      .collect();
  },
});

/**
 * Get all active forms for a tax year
 */
export const getActiveFormDefinitions = query({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("formDefinitions");
    
    const allDefinitions = await query.collect();
    
    // Filter by active status and optionally by year
    return allDefinitions.filter(d => {
      const isActive = d.isActive === true;
      const matchesYear = args.year ? d.year === args.year : true;
      return isActive && matchesYear;
    });
  },
});

/**
 * List all form definitions with pagination
 */
export const listFormDefinitions = query({
  args: {
    numResults: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const numResults = args.numResults || 50;
    
    const results = await ctx.db
      .query("formDefinitions")
      .order("desc")
      .take(numResults);
    
    return {
      results,
      totalCount: results.length,
    };
  },
});

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new form definition
 */
export const createFormDefinition = mutation({
  args: {
    formCode: v.string(),
    year: v.number(),
    entityType: v.union(v.literal("Individual"), v.literal("Business"), v.literal("Specialty")),
    formName: v.string(),
    sections: v.array(v.any()),
    metadata: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const definitionId = await ctx.db.insert("formDefinitions", {
      formCode: args.formCode,
      year: args.year,
      entityType: args.entityType,
      formName: args.formName,
      sections: args.sections,
      metadata: args.metadata || {},
      isActive: args.isActive !== undefined ? args.isActive : true,
    });
    
    return definitionId;
  },
});

/**
 * Update an existing form definition
 */
export const updateFormDefinition = mutation({
  args: {
    id: v.id("formDefinitions"),
    formCode: v.optional(v.string()),
    year: v.optional(v.number()),
    entityType: v.optional(v.union(v.literal("Individual"), v.literal("Business"), v.literal("Specialty"))),
    formName: v.optional(v.string()),
    sections: v.optional(v.array(v.any())),
    metadata: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Form definition not found");
    }
    
    await ctx.db.patch(id, updates);
    
    return id;
  },
});

/**
 * Soft-delete a form definition (deactivate)
 */
export const deactivateFormDefinition = mutation({
  args: {
    id: v.id("formDefinitions"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Form definition not found");
    }
    
    await ctx.db.patch(args.id, { isActive: false });
    
    return args.id;
  },
});

// =============================================================================
// SEED DATA - DEFAULT IRS FORM DEFINITIONS
// =============================================================================

/**
 * Seed default IRS form definitions for 1040, 1120S, 1065, 990
 */
export const seedDefaultForms = mutation({
  args: {},
  handler: async (ctx, args) => {
    const currentYear = new Date().getFullYear();
    const seedYear = currentYear - 1; // Last year's forms
    
    // Check if forms already exist for this year
    const allDefinitions = await ctx.db.query("formDefinitions").collect();
    const existingForms = allDefinitions.filter(d => d.year === seedYear);
    
    if (existingForms.length > 0) {
      return { message: "Forms already seeded for year " + seedYear, seeded: 0 };
    }
    
    const seededForms = [];
    
    // Form 1040 (Individual) - U.S. Individual Income Tax Return
    const form1040Id = await ctx.db.insert("formDefinitions", {
      formCode: "1040",
      year: seedYear,
      entityType: "Individual",
      formName: "U.S. Individual Income Tax Return",
      isActive: true,
      metadata: {
        irsFormNumber: "1040",
        taxYear: seedYear,
        description: "Main individual income tax return form",
        dueDate: "April 15",
        formType: "primary",
      },
      sections: [
        {
          sectionId: "header",
          title: "Filing Information",
          fields: [
            { fieldKey: "FilingStatus", label: "Filing Status", type: "select", required: true },
            { fieldKey: "FirstName", label: "First Name", type: "text", required: true },
            { fieldKey: "LastName", label: "Last Name", type: "text", required: true },
            { fieldKey: "SSN", label: "Social Security Number", type: "text", required: true },
          ],
        },
        {
          sectionId: "income",
          title: "Income",
          description: "Lines 1-11",
          subsections: [
            {
              title: "Wages and Salary",
              fields: [
                { fieldKey: "Line1", label: "Wages, salaries, tips (Box 1 of W-2)", type: "currency", required: true, irsLine: "1" },
              ],
            },
            {
              title: "Tax Exempt Interest and Dividends",
              fields: [
                { fieldKey: "Line2a", label: "Tax-exempt interest", type: "currency", irsLine: "2a" },
                { fieldKey: "Line2b", label: "Taxable interest", type: "currency", irsLine: "2b" },
                { fieldKey: "Line3a", label: "Qualified dividends", type: "currency", irsLine: "3a" },
                { fieldKey: "Line3b", label: "Ordinary dividends", type: "currency", irsLine: "3b" },
              ],
            },
            {
              title: "IRA Distributions",
              fields: [
                { fieldKey: "Line4a", label: "Total distributions", type: "currency", irsLine: "4a" },
                { fieldKey: "Line4b", label: "Taxable amount", type: "currency", irsLine: "4b" },
              ],
            },
            {
              title: "Pensions and Annuities",
              fields: [
                { fieldKey: "Line5a", label: "Total pensions and annuities", type: "currency", irsLine: "5a" },
                { fieldKey: "Line5b", label: "Taxable amount", type: "currency", irsLine: "5b" },
              ],
            },
            {
              title: "Social Security Benefits",
              fields: [
                { fieldKey: "Line6a", label: "Social security benefits", type: "currency", irsLine: "6a" },
                { fieldKey: "Line6b", label: "Taxable amount", type: "currency", irsLine: "6b" },
              ],
            },
            {
              title: "Capital Gains",
              fields: [
                { fieldKey: "Line7", label: "Capital gain or (loss)", type: "currency", irsLine: "7" },
              ],
            },
            {
              title: "Other Income",
              fields: [
                { fieldKey: "Line8", label: "Other income", type: "currency", irsLine: "8" },
                { fieldKey: "Line9", label: "Total income", type: "currency", calculated: true, irsLine: "9" },
              ],
            },
          ],
        },
        {
          sectionId: "adjustments",
          title: "Adjustments to Income",
          description: "Lines 12-26",
          subsections: [
            {
              title: "Adjustments",
              fields: [
                { fieldKey: "Line12", label: "Educator expenses", type: "currency", irsLine: "12" },
                { fieldKey: "Line13", label: "HSA deduction", type: "currency", irsLine: "13" },
                { fieldKey: "Line14", label: "Self-employment tax", type: "currency", irsLine: "14" },
                { fieldKey: "Line15", label: "IRA deduction", type: "currency", irsLine: "15" },
                { fieldKey: "Line16", label: "Student loan interest", type: "currency", irsLine: "16" },
                { fieldKey: "Line26", label: "Total adjustments", type: "currency", calculated: true, irsLine: "26" },
              ],
            },
          ],
        },
        {
          sectionId: "deductions",
          title: "Deductions",
          description: "Lines 27-29",
          subsections: [
            {
              title: "Standard Deduction",
              fields: [
                { fieldKey: "Line27", label: "Standard deduction", type: "currency", required: true, irsLine: "27" },
              ],
            },
            {
              title: "Itemized Deductions",
              fields: [
                { fieldKey: "SchA_Line4", label: "Medical and dental expenses", type: "currency", irsLine: "SchA-4" },
                { fieldKey: "SchA_Line17", label: "Total itemized deductions", type: "currency", irsLine: "SchA-17" },
              ],
            },
            {
              title: "Qualified Business Income",
              fields: [
                { fieldKey: "Line29", label: "Qualified business income deduction", type: "currency", irsLine: "29" },
              ],
            },
          ],
        },
        {
          sectionId: "credits",
          title: "Tax Credits",
          description: "Lines 31-35",
          subsections: [
            {
              title: "Nonrefundable Credits",
              fields: [
                { fieldKey: "Line31", label: "Child tax credit", type: "currency", irsLine: "31" },
                { fieldKey: "Line32", label: "Earned income credit", type: "currency", irsLine: "32" },
                { fieldKey: "Line33", label: "Other payments and credits", type: "currency", irsLine: "33" },
              ],
            },
            {
              title: "Refundable Credits",
              fields: [
                { fieldKey: "Line35", label: "Total credits", type: "currency", calculated: true, irsLine: "35" },
              ],
            },
          ],
        },
        {
          sectionId: "payments",
          title: "Payments",
          description: "Lines 36-38",
          subsections: [
            {
              title: "Tax Payments",
              fields: [
                { fieldKey: "Line36", label: "Federal income tax withheld", type: "currency", required: true, irsLine: "36" },
                { fieldKey: "Line37", label: "Other payments", type: "currency", irsLine: "37" },
                { fieldKey: "Line38", label: "Total payments", type: "currency", calculated: true, irsLine: "38" },
              ],
            },
          ],
        },
        {
          sectionId: "refund",
          title: "Refund",
          description: "Lines 39-41",
          subsections: [
            {
              title: "Refund Amount",
              fields: [
                { fieldKey: "Line39", label: "Amount overpaid", type: "currency", calculated: true, irsLine: "39" },
                { fieldKey: "Line40", label: "Amount to be refunded", type: "currency", calculated: true, irsLine: "40" },
                { fieldKey: "Line41", label: "Amount you owe", type: "currency", calculated: true, irsLine: "41" },
              ],
            },
          ],
        },
      ],
    });
    seededForms.push({ formCode: "1040", id: form1040Id });

    // Form 1120S (Business) - U.S. Income Tax Return for an S Corporation
    const form1120SId = await ctx.db.insert("formDefinitions", {
      formCode: "1120S",
      year: seedYear,
      entityType: "Business",
      formName: "U.S. Income Tax Return for an S Corporation",
      isActive: true,
      metadata: {
        irsFormNumber: "1120S",
        taxYear: seedYear,
        description: "S Corporation income tax return",
        dueDate: "March 15",
        formType: "business",
      },
      sections: [
        {
          sectionId: "header",
          title: "Corporation Information",
          fields: [
            { fieldKey: "Name", label: "Corporation name", type: "text", required: true },
            { fieldKey: "EIN", label: "Employer Identification Number", type: "text", required: true },
            { fieldKey: "StateOfIncorporation", label: "State of Incorporation", type: "text" },
          ],
        },
        {
          sectionId: "income",
          title: "Gross Receipts or Sales",
          description: "Line 1",
          subsections: [
            {
              title: "Income",
              fields: [
                { fieldKey: "Line1", label: "Gross receipts or sales", type: "currency", required: true, irsLine: "1" },
                { fieldKey: "Line2", label: "Cost of goods sold", type: "currency", irsLine: "2" },
                { fieldKey: "Line3", label: "Gross profit", type: "currency", calculated: true, irsLine: "3" },
                { fieldKey: "Line4", label: "Net gain (loss)", type: "currency", irsLine: "4" },
                { fieldKey: "Line5", label: "Other income (loss)", type: "currency", irsLine: "5" },
                { fieldKey: "Line6", label: "Total income", type: "currency", calculated: true, irsLine: "6" },
              ],
            },
          ],
        },
        {
          sectionId: "deductions",
          title: "Deductions",
          description: "Lines 7-20",
          subsections: [
            {
              title: "Operating Expenses",
              fields: [
                { fieldKey: "Line7", label: "Compensation of officers", type: "currency", irsLine: "7" },
                { fieldKey: "Line8", label: "Salaries and wages", type: "currency", irsLine: "8" },
                { fieldKey: "Line9", label: "Repairs and maintenance", type: "currency", irsLine: "9" },
                { fieldKey: "Line10", label: "Bad debts", type: "currency", irsLine: "10" },
                { fieldKey: "Line11", label: "Rents", type: "currency", irsLine: "11" },
                { fieldKey: "Line12", label: "Taxes and licenses", type: "currency", irsLine: "12" },
                { fieldKey: "Line13", label: "Interest", type: "currency", irsLine: "13" },
                { fieldKey: "Line14", label: "Depreciation", type: "currency", irsLine: "14" },
                { fieldKey: "Line17", label: "Other deductions", type: "currency", irsLine: "17" },
                { fieldKey: "Line20", label: "Total deductions", type: "currency", calculated: true, irsLine: "20" },
              ],
            },
          ],
        },
        {
          sectionId: "tax_computation",
          title: "Tax and Payments",
          description: "Lines 21-23",
          subsections: [
            {
              title: "Tax Computation",
              fields: [
                { fieldKey: "Line21", label: "Taxable income", type: "currency", calculated: true, irsLine: "21" },
                { fieldKey: "Line22", label: "Income tax", type: "currency", irsLine: "22" },
                { fieldKey: "Line23", label: "Total payments", type: "currency", irsLine: "23" },
              ],
            },
          ],
        },
        {
          sectionId: "shareholders",
          title: "Shareholders' Stock and Debt Basis",
          description: "Schedule M-3 and K-1",
          subsections: [
            {
              title: "K-1 Information",
              fields: [
                { fieldKey: "K1_OrdinaryBusinessIncome", label: "Ordinary business income", type: "currency", irsLine: "K1" },
                { fieldKey: "K1_InterestIncome", label: "Interest income", type: "currency", irsLine: "K1" },
                { fieldKey: "K1_Dividends", label: "Dividends", type: "currency", irsLine: "K1" },
                { fieldKey: "K1_RentalIncome", label: "Rental income", type: "currency", irsLine: "K1" },
              ],
            },
          ],
        },
      ],
    });
    seededForms.push({ formCode: "1120S", id: form1120SId });

    // Form 1065 (Business) - U.S. Return of Partnership Income
    const form1065Id = await ctx.db.insert("formDefinitions", {
      formCode: "1065",
      year: seedYear,
      entityType: "Business",
      formName: "U.S. Return of Partnership Income",
      isActive: true,
      metadata: {
        irsFormNumber: "1065",
        taxYear: seedYear,
        description: "Partnership income tax return",
        dueDate: "March 15",
        formType: "business",
      },
      sections: [
        {
          sectionId: "header",
          title: "Partnership Information",
          fields: [
            { fieldKey: "Name", label: "Partnership name", type: "text", required: true },
            { fieldKey: "EIN", label: "Employer Identification Number", type: "text", required: true },
            { fieldKey: "PrincipalBusinessActivity", label: "Principal business activity", type: "text" },
          ],
        },
        {
          sectionId: "income",
          title: "Income",
          description: "Lines 1-8",
          subsections: [
            {
              title: "Gross Receipts",
              fields: [
                { fieldKey: "Line1", label: "Gross receipts or sales", type: "currency", required: true, irsLine: "1" },
                { fieldKey: "Line2", label: "Cost of goods sold", type: "currency", irsLine: "2" },
                { fieldKey: "Line3", label: "Gross profit", type: "currency", calculated: true, irsLine: "3" },
                { fieldKey: "Line4", label: "Gross income from other sources", type: "currency", irsLine: "4" },
                { fieldKey: "Line5", label: "Total income", type: "currency", calculated: true, irsLine: "5" },
              ],
            },
          ],
        },
        {
          sectionId: "deductions",
          title: "Deductions",
          description: "Lines 8-21",
          subsections: [
            {
              title: "Partnership Deductions",
              fields: [
                { fieldKey: "Line8", label: "Salaries and wages", type: "currency", irsLine: "8" },
                { fieldKey: "Line9", label: "Guaranteed payments", type: "currency", irsLine: "9" },
                { fieldKey: "Line10", label: "Repairs and maintenance", type: "currency", irsLine: "10" },
                { fieldKey: "Line11", label: "Bad debts", type: "currency", irsLine: "11" },
                { fieldKey: "Line12", label: "Rents", type: "currency", irsLine: "12" },
                { fieldKey: "Line13", label: "Taxes and licenses", type: "currency", irsLine: "13" },
                { fieldKey: "Line14", label: "Interest", type: "currency", irsLine: "14" },
                { fieldKey: "Line15", label: "Depreciation", type: "currency", irsLine: "15" },
                { fieldKey: "Line16", label: "Employee benefit programs", type: "currency", irsLine: "16" },
                { fieldKey: "Line17", label: "Other deductions", type: "currency", irsLine: "17" },
                { fieldKey: "Line21", label: "Total deductions", type: "currency", calculated: true, irsLine: "21" },
              ],
            },
          ],
        },
        {
          sectionId: "tax_computation",
          title: "Tax and Credits",
          description: "Lines 22-25",
          subsections: [
            {
              title: "Net Earnings",
              fields: [
                { fieldKey: "Line22", label: "Ordinary business income", type: "currency", calculated: true, irsLine: "22" },
                { fieldKey: "Line24", label: "Total credits", type: "currency", irsLine: "24" },
                { fieldKey: "Line25", label: "Net earnings from self-employment", type: "currency", calculated: true, irsLine: "25" },
              ],
            },
          ],
        },
        {
          sectionId: "partners",
          title: "Partner Information",
          description: "Schedule K-1",
          subsections: [
            {
              title: "K-1 Allocations",
              fields: [
                { fieldKey: "K1_OrdinaryIncome", label: "Ordinary business income", type: "currency", irsLine: "K1" },
                { fieldKey: "K1_InterestIncome", label: "Interest income", type: "currency", irsLine: "K1" },
                { fieldKey: "K1_DividendIncome", label: "Dividend income", type: "currency", irsLine: "K1" },
                { fieldKey: "K1_RentalIncome", label: "Rental real estate income", type: "currency", irsLine: "K1" },
                { fieldKey: "K1_GuaranteedPayments", label: "Guaranteed payments", type: "currency", irsLine: "K1" },
              ],
            },
          ],
        },
      ],
    });
    seededForms.push({ formCode: "1065", id: form1065Id });

    // Form 990 (Specialty) - Return of Organization Exempt From Income Tax
    const form990Id = await ctx.db.insert("formDefinitions", {
      formCode: "990",
      year: seedYear,
      entityType: "Specialty",
      formName: "Return of Organization Exempt From Income Tax",
      isActive: true,
      metadata: {
        irsFormNumber: "990",
        taxYear: seedYear,
        description: "Annual information return for tax-exempt organizations",
        dueDate: "15th day of 5th month",
        formType: "specialty",
      },
      sections: [
        {
          sectionId: "header",
          title: "Organization Information",
          fields: [
            { fieldKey: "Name", label: "Organization name", type: "text", required: true },
            { fieldKey: "EIN", label: "Employer Identification Number", type: "text", required: true },
            { fieldKey: "TaxYear", label: "Tax Year", type: "number", required: true },
            { fieldKey: "Website", label: "Website", type: "text" },
          ],
        },
        {
          sectionId: "mission",
          title: "Mission and Programs",
          description: "Program Service Accomplishments",
          subsections: [
            {
              title: "Mission",
              fields: [
                { fieldKey: "Mission", label: "Organization's mission", type: "text", required: true },
              ],
            },
            {
              title: "Program Service Revenue",
              fields: [
                { fieldKey: "ProgramServiceRevenue", label: "Program service revenue", type: "currency", irsLine: "2" },
              ],
            },
          ],
        },
        {
          sectionId: "revenue",
          title: "Revenue",
          description: "Lines 1-12",
          subsections: [
            {
              title: "Contributions and Grants",
              fields: [
                { fieldKey: "Line1", label: "Contributions, gifts, grants", type: "currency", irsLine: "1" },
                { fieldKey: "Line2", label: "Program service revenue", type: "currency", irsLine: "2" },
                { fieldKey: "Line3", label: "Membership dues and assessments", type: "currency", irsLine: "3" },
                { fieldKey: "Line4", label: "Gross amount from sale of inventory", type: "currency", irsLine: "4" },
                { fieldKey: "Line5", label: "Gross amount from sale of assets", type: "currency", irsLine: "5" },
                { fieldKey: "Line6", label: "Gross profit from business", type: "currency", irsLine: "6" },
                { fieldKey: "Line7", label: "Other revenue", type: "currency", irsLine: "7" },
                { fieldKey: "Line8", label: "Total revenue", type: "currency", calculated: true, irsLine: "8" },
              ],
            },
          ],
        },
        {
          sectionId: "expenses",
          title: "Expenses",
          description: "Lines 9-24",
          subsections: [
            {
              title: "Program Expenses",
              fields: [
                { fieldKey: "Line9", label: "Grants and other assistance", type: "currency", irsLine: "9" },
                { fieldKey: "Line10", label: "Benefits paid to members", type: "currency", irsLine: "10" },
                { fieldKey: "Line11", label: "Salaries and wages", type: "currency", irsLine: "11" },
                { fieldKey: "Line12", label: "Professional fees", type: "currency", irsLine: "12" },
                { fieldKey: "Line13", label: "Occupancy", type: "currency", irsLine: "13" },
                { fieldKey: "Line14", label: "Depreciation", type: "currency", irsLine: "14" },
                { fieldKey: "Line24", label: "Total expenses", type: "currency", calculated: true, irsLine: "24" },
              ],
            },
          ],
        },
        {
          sectionId: "balance_sheet",
          title: "Balance Sheet",
          description: "Lines 25-34",
          subsections: [
            {
              title: "Assets",
              fields: [
                { fieldKey: "Line25", label: "Total assets", type: "currency", irsLine: "25" },
                { fieldKey: "Line26", label: "Total liabilities", type: "currency", irsLine: "26" },
                { fieldKey: "Line27", label: "Net assets or fund balances", type: "currency", irsLine: "27" },
              ],
            },
          ],
        },
        {
          sectionId: "compliance",
          title: "Tax Compliance",
          description: "Filing requirements and tax status",
          subsections: [
            {
              title: "Exempt Status",
              fields: [
                { fieldKey: "TaxExemptStatus", label: "Section 501(c) type", type: "text", required: true },
                { fieldKey: "Filing990Required", label: "990 filing required", type: "boolean", required: true },
                { fieldKey: "UnrelatedBusinessIncome", label: "Unrelated business income", type: "currency" },
              ],
            },
          ],
        },
      ],
    });
    seededForms.push({ formCode: "990", id: form990Id });

    return {
      message: `Successfully seeded ${seededForms.length} default form definitions for tax year ${seedYear}`,
      seeded: seededForms.length,
      forms: seededForms,
    };
  },
});
