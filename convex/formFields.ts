import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all form fields for a specific tax topic (for Interview Mode wizard)
export const getFieldsByTaxTopic = query({
  args: { taxTopic: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("formFields")
      .withIndex("by_taxTopic", (q) => q.eq("taxTopic", args.taxTopic))
      .collect();
  },
});

// Get all available tax topics
export const getAllTaxTopics = query({
  handler: async (ctx) => {
    const fields = await ctx.db.query("formFields").collect();
    const topics = [...new Set(fields.map((f) => f.taxTopic))];
    return topics.sort();
  },
});

// Get a single field by key
export const getFieldByKey = query({
  args: { fieldKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("formFields")
      .filter((q) => q.eq(q.field("fieldKey"), args.fieldKey))
      .first();
  },
});

// Seed initial form field metadata
export const seedFormFields = mutation({
  handler: async (ctx) => {
    // Check if fields already exist
    const existing = await ctx.db.query("formFields").first();
    if (existing) return;

    const fields = [
      // Income Topic
      { fieldKey: "1040_Line1z", fieldLabel: "Wages, salaries, tips, etc.", taxTopic: "Income", inputType: "currency", metadata: { helpText: "Enter wages from W-2", placeholder: "0.00", relatedFields: ["W2_Box1"], formType: "1040", lineNumber: "1z" } },
      { fieldKey: "1040_Line2b", fieldLabel: "Taxable interest", taxTopic: "Income", inputType: "currency", metadata: { helpText: "Interest over $1,500 is taxable", placeholder: "0.00", formType: "1040", lineNumber: "2b" } },
      { fieldKey: "1040_Line3b", fieldLabel: "Ordinary dividends", taxTopic: "Income", inputType: "currency", metadata: { helpText: "Qualified dividends may be taxed at lower rate", placeholder: "0.00", formType: "1040", lineNumber: "3b" } },
      { fieldKey: "1040_Line7", fieldLabel: "Capital gain or (loss)", taxTopic: "Income", inputType: "currency", metadata: { helpText: "Net capital gains", placeholder: "0.00", formType: "1040", lineNumber: "7" } },
      
      // Deductions Topic
      { fieldKey: "1040_Line12", fieldLabel: "Standard or Itemized Deduction", taxTopic: "Deductions", inputType: "currency", metadata: { helpText: "Standard deduction or Schedule A total", placeholder: "0.00", relatedFields: ["SchA_Line17"], formType: "1040", lineNumber: "12" } },
      { fieldKey: "SchA_Line17", fieldLabel: "Total Itemized Deductions", taxTopic: "Deductions", inputType: "currency", metadata: { helpText: "Sum of Schedule A deductions", placeholder: "0.00", formType: "SchA", lineNumber: "17" } },
      
      // Credits Topic
      { fieldKey: "1040_Line19", fieldLabel: "Child Tax Credit", taxTopic: "Credits", inputType: "currency", metadata: { helpText: "Up to $2,000 per qualifying child", placeholder: "0.00", formType: "1040", lineNumber: "19" } },
      
      // Payments Topic
      { fieldKey: "1040_Line25a", fieldLabel: "Federal income tax withheld", taxTopic: "Payments", inputType: "currency", metadata: { helpText: "Total from all W-2s Box 2", placeholder: "0.00", relatedFields: ["W2_Box2"], formType: "1040", lineNumber: "25a" } },
      
      // Filing Status Topic
      { fieldKey: "FilingStatus", fieldLabel: "Filing Status", taxTopic: "Personal Info", inputType: "text", metadata: { helpText: "Single, Married Filing Jointly, etc.", placeholder: "Single", formType: "1040" } },
      { fieldKey: "IsBlind", fieldLabel: "Are you blind?", taxTopic: "Personal Info", inputType: "boolean", metadata: { helpText: "Check if you are blind", formType: "1040" } },
      { fieldKey: "IsOver65", fieldLabel: "Are you over 65?", taxTopic: "Personal Info", inputType: "boolean", metadata: { helpText: "Check if you are over 65", formType: "1040" } },
    ];

    for (const field of fields) {
      await ctx.db.insert("formFields", field);
    }
  },
});

// Update running total for a field (exposed as mutation for client use)
export const updateTaxTotal = mutation({
  args: {
    returnId: v.id("returns"),
    fieldKey: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("taxTotals")
      .withIndex("by_return_fieldKey", (q) => 
        q.eq("returnId", args.returnId).eq("fieldKey", args.fieldKey)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accumulatedAmount: args.amount,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("taxTotals", {
        returnId: args.returnId,
        fieldKey: args.fieldKey,
        accumulatedAmount: args.amount,
        updatedAt: Date.now(),
      });
    }
  },
});

// Get running totals for a return
export const getTaxTotals = query({
  args: { returnId: v.id("returns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taxTotals")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
      .collect();
  },
});

// Get a specific running total
export const getTaxTotal = query({
  args: { returnId: v.id("returns"), fieldKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taxTotals")
      .withIndex("by_return_fieldKey", (q) => 
        q.eq("returnId", args.returnId).eq("fieldKey", args.fieldKey)
      )
      .first();
  },
});
