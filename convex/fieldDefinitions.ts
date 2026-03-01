import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get a specific field definition by formCode, year, and fieldKey
 */
export const getFieldDefinition = query({
  args: {
    formCode: v.string(),
    year: v.number(),
    fieldKey: v.string(),
  },
  handler: async (ctx, args) => {
    const definitions = await ctx.db
      .query("fieldDefinitions")
      .withIndex("by_formCode_year", (q) =>
        q.eq("formCode", args.formCode).eq("year", args.year)
      )
      .collect();

    return definitions.find((d) => d.fieldKey === args.fieldKey) || null;
  },
});

/**
 * Get all field definitions for a specific form
 */
export const getFieldsByForm = query({
  args: {
    formCode: v.string(),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("fieldDefinitions");

    if (args.year !== undefined) {
      return await ctx.db
        .query("fieldDefinitions")
        .withIndex("by_formCode_year", (q) =>
          q.eq("formCode", args.formCode).eq("year", args.year)
        )
        .collect();
    }

    // If no year specified, get all versions of the form
    const allDefinitions = await query.collect();
    return allDefinitions.filter((d) => d.formCode === args.formCode);
  },
});

/**
 * Get all calculated fields for a form (fields with isCalculated=true)
 */
export const getCalculatedFields = query({
  args: {
    formCode: v.string(),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let definitions: any[];

    if (args.year !== undefined) {
      definitions = await ctx.db
        .query("fieldDefinitions")
        .withIndex("by_formCode_year", (q) =>
          q.eq("formCode", args.formCode).eq("year", args.year)
        )
        .collect();
    } else {
      definitions = await ctx.db.query("fieldDefinitions").collect();
      definitions = definitions.filter((d) => d.formCode === args.formCode);
    }

    return definitions.filter((d) => d.isCalculated === true);
  },
});

/**
 * Get fields filtered by category (income, deduction, credit, info)
 */
export const getFieldsByCategory = query({
  args: {
    formCode: v.string(),
    year: v.optional(v.number()),
    category: v.union(
      v.literal("income"),
      v.literal("deduction"),
      v.literal("credit"),
      v.literal("info")
    ),
  },
  handler: async (ctx, args) => {
    let definitions: any[];

    if (args.year !== undefined) {
      definitions = await ctx.db
        .query("fieldDefinitions")
        .withIndex("by_formCode_year", (q) =>
          q.eq("formCode", args.formCode).eq("year", args.year)
        )
        .collect();
    } else {
      definitions = await ctx.db.query("fieldDefinitions").collect();
      definitions = definitions.filter((d) => d.formCode === args.formCode);
    }

    return definitions.filter((d) => d.category === args.category);
  },
});

/**
 * Get all required fields for a form
 */
export const getRequiredFields = query({
  args: {
    formCode: v.string(),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let definitions: any[];

    if (args.year !== undefined) {
      definitions = await ctx.db
        .query("fieldDefinitions")
        .withIndex("by_formCode_year", (q) =>
          q.eq("formCode", args.formCode).eq("year", args.year)
        )
        .collect();
    } else {
      definitions = await ctx.db.query("fieldDefinitions").collect();
      definitions = definitions.filter((d) => d.formCode === args.formCode);
    }

    return definitions.filter((d) => d.isRequired === true);
  },
});

/**
 * Get all field definitions with pagination
 */
export const listFieldDefinitions = query({
  args: {
    numResults: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const numResults = args.numResults || 50;

    const results = await ctx.db
      .query("fieldDefinitions")
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
 * Create a new field definition
 */
export const createFieldDefinition = mutation({
  args: {
    formCode: v.string(),
    year: v.number(),
    fieldKey: v.string(),
    label: v.string(),
    labelEs: v.optional(v.string()),
    fieldType: v.union(
      v.literal("currency"),
      v.literal("number"),
      v.literal("text"),
      v.literal("boolean"),
      v.literal("date")
    ),
    isCalculated: v.optional(v.boolean()),
    formula: v.optional(v.string()),
    dependsOn: v.optional(v.array(v.string())),
    isRequired: v.optional(v.boolean()),
    category: v.union(
      v.literal("income"),
      v.literal("deduction"),
      v.literal("credit"),
      v.literal("info")
    ),
    irsLineReference: v.optional(v.string()),
    helpText: v.optional(v.string()),
    helpTextEs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if field definition already exists
    const existing = await ctx.db
      .query("fieldDefinitions")
      .withIndex("by_formCode_year", (q) =>
        q.eq("formCode", args.formCode).eq("year", args.year)
      )
      .collect();

    const duplicate = existing.find((d) => d.fieldKey === args.fieldKey);
    if (duplicate) {
      throw new Error(
        `Field definition already exists: ${args.formCode} ${args.year} ${args.fieldKey}`
      );
    }

    const fieldDefinitionId = await ctx.db.insert("fieldDefinitions", {
      formCode: args.formCode,
      year: args.year,
      fieldKey: args.fieldKey,
      label: args.label,
      labelEs: args.labelEs || "",
      fieldType: args.fieldType,
      isCalculated: args.isCalculated || false,
      formula: args.formula,
      dependsOn: args.dependsOn || [],
      isRequired: args.isRequired || false,
      category: args.category,
      irsLineReference: args.irsLineReference || "",
      helpText: args.helpText || "",
      helpTextEs: args.helpTextEs || "",
    });

    return fieldDefinitionId;
  },
});

/**
 * Update an existing field definition
 */
export const updateFieldDefinition = mutation({
  args: {
    id: v.id("fieldDefinitions"),
    label: v.optional(v.string()),
    labelEs: v.optional(v.string()),
    fieldType: v.optional(
      v.union(
        v.literal("currency"),
        v.literal("number"),
        v.literal("text"),
        v.literal("boolean"),
        v.literal("date")
      )
    ),
    isCalculated: v.optional(v.boolean()),
    formula: v.optional(v.string()),
    dependsOn: v.optional(v.array(v.string())),
    isRequired: v.optional(v.boolean()),
    category: v.optional(
      v.union(
        v.literal("income"),
        v.literal("deduction"),
        v.literal("credit"),
        v.literal("info")
      )
    ),
    irsLineReference: v.optional(v.string()),
    helpText: v.optional(v.string()),
    helpTextEs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Field definition not found");
    }

    await ctx.db.patch(id, updates);

    return id;
  },
});

/**
 * Delete a field definition
 */
export const deleteFieldDefinition = mutation({
  args: {
    id: v.id("fieldDefinitions"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Field definition not found");
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});

// =============================================================================
// SEED DATA - DEFAULT FORM 1040 FIELD DEFINITIONS
// =============================================================================

/**
 * Seed default field definitions for Form 1040
 */
export const seedDefaultFields = mutation({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const seedYear = args.year || new Date().getFullYear() - 1;

    // Check if fields already exist for this year
    const existingFields = await ctx.db
      .query("fieldDefinitions")
      .withIndex("by_formCode_year", (q) =>
        q.eq("formCode", "1040").eq("year", seedYear)
      )
      .collect();

    if (existingFields.length > 0) {
      return {
        message: `Field definitions already seeded for Form 1040, year ${seedYear}`,
        seeded: 0,
      };
    }

    const seededFields = [];

    // Line 1z (Wages) - currency, required, income
    const line1zId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line1z",
      label: "Wages, salaries, tips, etc.",
      labelEs: "Salarios, Propinas, etc.",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: true,
      category: "income",
      irsLineReference: "1",
      helpText: "Enter the total wages shown on your W-2 forms in Box 1.",
      helpTextEs: "Ingrese los salarios totales mostrados en sus formularios W-2 en la Casilla 1.",
    });
    seededFields.push({ fieldKey: "Line1z", id: line1zId });

    // Line 2a (Tax-exempt interest) - currency, income
    const line2aId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line2a",
      label: "Tax-exempt interest",
      labelEs: "Interés exento de impuestos",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "2a",
      helpText: "Enter tax-exempt interest received.",
      helpTextEs: "Ingrese el interés exento de impuestos recibido.",
    });
    seededFields.push({ fieldKey: "Line2a", id: line2aId });

    // Line 2b (Taxable interest) - currency, income
    const line2bId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line2b",
      label: "Taxable interest",
      labelEs: "Interés gravable",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "2b",
      helpText: "Enter taxable interest received.",
      helpTextEs: "Ingrese el interés gravable recibido.",
    });
    seededFields.push({ fieldKey: "Line2b", id: line2bId });

    // Line 3a (Qualified dividends) - currency, income
    const line3aId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line3a",
      label: "Qualified dividends",
      labelEs: "Dividendos calificados",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "3a",
      helpText: "Enter qualified dividends received.",
      helpTextEs: "Ingrese los dividendos calificados recibidos.",
    });
    seededFields.push({ fieldKey: "Line3a", id: line3aId });

    // Line 3b (Ordinary dividends) - currency, income
    const line3bId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line3b",
      label: "Ordinary dividends",
      labelEs: "Dividendos ordinarios",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "3b",
      helpText: "Enter ordinary dividends received.",
      helpTextEs: "Ingrese los dividendos ordinarios recibidos.",
    });
    seededFields.push({ fieldKey: "Line3b", id: line3bId });

    // Line 4a (IRA distributions) - currency, income
    const line4aId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line4a",
      label: "Total distributions from IRAs",
      labelEs: "Distribuciones totales de IRAs",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "4a",
      helpText: "Enter total distributions from all IRAs.",
      helpTextEs: "Ingrese las distribuciones totales de todos los IRAs.",
    });
    seededFields.push({ fieldKey: "Line4a", id: line4aId });

    // Line 4b (Taxable IRA distributions) - currency, income
    const line4bId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line4b",
      label: "Taxable amount",
      labelEs: "Monto gravable",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "4b",
      helpText: "Enter taxable portion of IRA distributions.",
      helpTextEs: "Ingrese la porción gravable de las distribuciones de IRA.",
    });
    seededFields.push({ fieldKey: "Line4b", id: line4bId });

    // Line 5a (Pensions) - currency, income
    const line5aId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line5a",
      label: "Total pensions and annuities",
      labelEs: "Pensiones y anualidades totales",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "5a",
      helpText: "Enter total pensions and annuities received.",
      helpTextEs: "Ingrese las pensiones y anualidades totales recibidas.",
    });
    seededFields.push({ fieldKey: "Line5a", id: line5aId });

    // Line 5b (Taxable pensions) - currency, income
    const line5bId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line5b",
      label: "Taxable amount",
      labelEs: "Monto gravable",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "5b",
      helpText: "Enter taxable portion of pensions and annuities.",
      helpTextEs: "Ingrese la porción gravable de pensiones y anualidades.",
    });
    seededFields.push({ fieldKey: "Line5b", id: line5bId });

    // Line 6a (Social security benefits) - currency, income
    const line6aId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line6a",
      label: "Social security benefits",
      labelEs: "Beneficios del Seguro Social",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "6a",
      helpText: "Enter social security benefits received.",
      helpTextEs: "Ingrese los beneficios del Seguro Social recibidos.",
    });
    seededFields.push({ fieldKey: "Line6a", id: line6aId });

    // Line 6b (Taxable social security) - currency, income
    const line6bId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line6b",
      label: "Taxable amount",
      labelEs: "Monto gravable",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "6b",
      helpText: "Enter taxable portion of social security benefits.",
      helpTextEs: "Ingrese la porción gravable de los beneficios del Seguro Social.",
    });
    seededFields.push({ fieldKey: "Line6b", id: line6bId });

    // Line 7 (Capital gains) - currency, income
    const line7Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line7",
      label: "Capital gain or (loss)",
      labelEs: "Ganancia o (pérdida) de capital",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "7",
      helpText: "Enter net capital gain or loss.",
      helpTextEs: "Ingrese la ganancia o pérdida neta de capital.",
    });
    seededFields.push({ fieldKey: "Line7", id: line7Id });

    // Line 8 (Other income) - currency, income
    const line8Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line8",
      label: "Other income",
      labelEs: "Otros ingresos",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "income",
      irsLineReference: "8",
      helpText: "Enter any other income not reported elsewhere.",
      helpTextEs: "Ingrese cualquier otro ingreso no reportado en otro lugar.",
    });
    seededFields.push({ fieldKey: "Line8", id: line8Id });

    // Line 9 (Total income) - currency, calculated, formula: "sum(1:8)"
    const line9Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line9",
      label: "Total income",
      labelEs: "Ingreso total",
      fieldType: "currency",
      isCalculated: true,
      formula: "sum(Line1z,Line2b,Line3b,Line4b,Line5b,Line6b,Line7,Line8)",
      dependsOn: ["Line1z", "Line2b", "Line3b", "Line4b", "Line5b", "Line6b", "Line7", "Line8"],
      isRequired: true,
      category: "income",
      irsLineReference: "9",
      helpText: "This is automatically calculated as the sum of lines 1-8.",
      helpTextEs: "Esto se calcula automáticamente como la suma de las líneas 1-8.",
    });
    seededFields.push({ fieldKey: "Line9", id: line9Id });

    // Line 11 (AGI) - currency, calculated
    const line11Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line11",
      label: "Adjusted Gross Income (AGI)",
      labelEs: "Ingreso Bruto Ajustado (AGI)",
      fieldType: "currency",
      isCalculated: true,
      formula: "Line9 - Line10",
      dependsOn: ["Line9", "Line10"],
      isRequired: true,
      category: "income",
      irsLineReference: "11",
      helpText: "AGI is total income minus certain deductions.",
      helpTextEs: "El AGI es el ingreso total menos ciertas deducciones.",
    });
    seededFields.push({ fieldKey: "Line11", id: line11Id });

    // Line 12 (Standard deduction) - currency, calculated
    const line12Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line12",
      label: "Standard deduction",
      labelEs: "Deducción estándar",
      fieldType: "currency",
      isCalculated: true,
      formula: "standard_deduction(filingStatus, age, blind)",
      dependsOn: [],
      isRequired: true,
      category: "deduction",
      irsLineReference: "12",
      helpText: "Enter standard deduction or itemize on Schedule A.",
      helpTextEs: "Ingrese la deducción estándar o especifique en el Anexo A.",
    });
    seededFields.push({ fieldKey: "Line12", id: line12Id });

    // Line 13 (Qualified business income) - currency, deduction
    const line13Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line13",
      label: "Qualified business income deduction",
      labelEs: "Deducción de ingreso de negocio calificado",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "deduction",
      irsLineReference: "13",
      helpText: "Enter qualified business income (QBI) deduction from Schedule C or F.",
      helpTextEs: "Ingrese la deducción de ingreso de negocio calificado (QBI) del Anexo C o F.",
    });
    seededFields.push({ fieldKey: "Line13", id: line13Id });

    // Line 15 (Taxable income) - currency, calculated
    const line15Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line15",
      label: "Taxable income",
      labelEs: "Ingreso gravable",
      fieldType: "currency",
      isCalculated: true,
      formula: "Line11 - Line12 - Line13",
      dependsOn: ["Line11", "Line12", "Line13"],
      isRequired: true,
      category: "income",
      irsLineReference: "15",
      helpText: "This is your taxable income after deductions.",
      helpTextEs: "Este es su ingreso gravable después de las deducciones.",
    });
    seededFields.push({ fieldKey: "Line15", id: line15Id });

    // Line 16 (Tax) - currency, calculated
    const line16Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line16",
      label: "Tax",
      labelEs: "Impuesto",
      fieldType: "currency",
      isCalculated: true,
      formula: "tax_table(Line15, filingStatus)",
      dependsOn: ["Line15"],
      isRequired: true,
      category: "info",
      irsLineReference: "16",
      helpText: "Tax is calculated based on taxable income and filing status.",
      helpTextEs: "El impuesto se calcula según el ingreso gravable y el estado civil.",
    });
    seededFields.push({ fieldKey: "Line16", id: line16Id });

    // Line 25a (Federal income tax withheld) - currency
    const line25aId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line25a",
      label: "Federal income tax withheld",
      labelEs: "Impuesto federal sobre el ingreso retenido",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: true,
      category: "info",
      irsLineReference: "25a",
      helpText: "Enter federal income tax withheld from all W-2 forms.",
      helpTextEs: "Ingrese el impuesto federal sobre el ingreso retenido de todos los formularios W-2.",
    });
    seededFields.push({ fieldKey: "Line25a", id: line25aId });

    // Line 25b (Other federal income tax withheld) - currency
    const line25bId = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line25b",
      label: "Other federal income tax withheld",
      labelEs: "Otro impuesto federal sobre el ingreso retenido",
      fieldType: "currency",
      isCalculated: false,
      formula: undefined,
      dependsOn: [],
      isRequired: false,
      category: "info",
      irsLineReference: "25b",
      helpText: "Enter other federal income tax withheld.",
      helpTextEs: "Ingrese otro impuesto federal sobre el ingreso retenido.",
    });
    seededFields.push({ fieldKey: "Line25b", id: line25bId });

    // Line 33 (Total payments) - currency, calculated
    const line33Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line33",
      label: "Total payments",
      labelEs: "Pagos totales",
      fieldType: "currency",
      isCalculated: true,
      formula: "sum(Line25a,Line25b,Line26,Line27,Line28,Line30,Line31,Line32)",
      dependsOn: ["Line25a", "Line25b", "Line26", "Line27", "Line28", "Line30", "Line31", "Line32"],
      isRequired: true,
      category: "info",
      irsLineReference: "33",
      helpText: "This is automatically calculated as the sum of all payment lines.",
      helpTextEs: "Esto se calcula automáticamente como la suma de todas las líneas de pago.",
    });
    seededFields.push({ fieldKey: "Line33", id: line33Id });

    // Line 34 (Refund) - currency, calculated
    const line34Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line34",
      label: "Amount you overpaid",
      labelEs: "Monto que pagó de más",
      fieldType: "currency",
      isCalculated: true,
      formula: "Line33 - Line24",
      dependsOn: ["Line33", "Line24"],
      isRequired: false,
      category: "info",
      irsLineReference: "34",
      helpText: "This is the amount you overpaid and will be refunded.",
      helpTextEs: "Este es el monto que pagó de más y será reembolsado.",
    });
    seededFields.push({ fieldKey: "Line34", id: line34Id });

    // Line 35 (Refund to be sent) - currency, calculated
    const line35Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line35",
      label: "Amount to be refunded",
      labelEs: "Monto a ser reembolsado",
      fieldType: "currency",
      isCalculated: true,
      formula: "Line34 - Line36",
      dependsOn: ["Line34", "Line36"],
      isRequired: false,
      category: "info",
      irsLineReference: "35",
      helpText: "This is the amount of your refund.",
      helpTextEs: "Este es el monto de su reembolso.",
    });
    seededFields.push({ fieldKey: "Line35", id: line35Id });

    // Line 37 (Amount owed) - currency, calculated
    const line37Id = await ctx.db.insert("fieldDefinitions", {
      formCode: "1040",
      year: seedYear,
      fieldKey: "Line37",
      label: "Amount you owe",
      labelEs: "Monto que debe",
      fieldType: "currency",
      isCalculated: true,
      formula: "Line24 - Line33",
      dependsOn: ["Line24", "Line33"],
      isRequired: false,
      category: "info",
      irsLineReference: "37",
      helpText: "This is the amount you owe if payments are less than tax.",
      helpTextEs: "Este es el monto que debe si los pagos son menores que el impuesto.",
    });
    seededFields.push({ fieldKey: "Line37", id: line37Id });

    return {
      message: `Successfully seeded ${seededFields.length} default field definitions for Form 1040, tax year ${seedYear}`,
      seeded: seededFields.length,
      fields: seededFields,
    };
  },
});

/**
 * Seed additional Form 1040 fields for Schedule C, SE tax, etc.
 */
export const seedAdditional1040Fields = mutation({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const seedYear = args.year || new Date().getFullYear() - 1;

    // Check if fields already exist
    const existingFields = await ctx.db
      .query("fieldDefinitions")
      .withIndex("by_formCode_year", (q) =>
        q.eq("formCode", "1040").eq("year", seedYear)
      )
      .collect();

    const existingKeys = new Set(existingFields.map((f) => f.fieldKey));
    const seededFields = [];

    // Schedule C - Profit or Loss from Business
    const scheduleCFields = [
      { key: "SchC_Line1", label: "Gross receipts or sales", labelEs: "Ingresos brutos o ventas", category: "income" as const },
      { key: "SchC_Line2", label: "Returns and allowances", labelEs: "Devoluciones y asignaciones", category: "income" as const },
      { key: "SchC_Line3", label: "Gross profit", labelEs: "Ganancia bruta", category: "income" as const, calculated: true },
      { key: "SchC_Line4", label: "Other income", labelEs: "Otros ingresos", category: "income" as const },
      { key: "SchC_Line5", label: "Gross income", labelEs: "Ingreso bruto", category: "income" as const, calculated: true },
      { key: "SchC_Line6", label: "Advertising", labelEs: "Publicidad", category: "deduction" as const },
      { key: "SchC_Line7", label: "Car and truck expenses", labelEs: "Gastos de vehículo", category: "deduction" as const },
      { key: "SchC_Line8", label: "Contract labor", labelEs: "Trabajo por contrato", category: "deduction" as const },
      { key: "SchC_Line9", label: "Depletion", labelEs: "Agotamiento", category: "deduction" as const },
      { key: "SchC_Line10", label: "Depreciation", labelEs: "Depreciación", category: "deduction" as const },
      { key: "SchC_Line11", label: "Employee benefit programs", labelEs: "Programas de beneficios para empleados", category: "deduction" as const },
      { key: "SchC_Line12", label: "Insurance", labelEs: "Seguro", category: "deduction" as const },
      { key: "SchC_Line13", label: "Legal and professional services", labelEs: "Servicios legales y profesionales", category: "deduction" as const },
      { key: "SchC_Line14", label: "Office expense", labelEs: "Gastos de oficina", category: "deduction" as const },
      { key: "SchC_Line15", label: "Rent or lease", labelEs: "Alquiler o arrendamiento", category: "deduction" as const },
      { key: "SchC_Line16", label: "Repairs and maintenance", labelEs: "Reparaciones y mantenimiento", category: "deduction" as const },
      { key: "SchC_Line17", label: "Supplies", labelEs: "Suministros", category: "deduction" as const },
      { key: "SchC_Line18", label: "Taxes and licenses", labelEs: "Impuestos y licencias", category: "deduction" as const },
      { key: "SchC_Line19", label: "Travel", labelEs: "Viajes", category: "deduction" as const },
      { key: "SchC_Line20", label: "Meals", labelEs: "Comidas", category: "deduction" as const },
      { key: "SchC_Line21", label: "Utilities", labelEs: "Servicios públicos", category: "deduction" as const },
      { key: "SchC_Line22", label: "Wages", labelEs: "Salarios", category: "deduction" as const },
      { key: "SchC_Line24", label: "Business expense", labelEs: "Gastos de negocio", category: "deduction" as const },
      { key: "SchC_Line30", label: "Business depreciation", labelEs: "Depreciación del negocio", category: "deduction" as const },
      { key: "SchC_Line31", label: "Net profit or loss", labelEs: "Ganancia o pérdida neta", category: "income" as const, calculated: true },
    ];

    for (const field of scheduleCFields) {
      if (!existingKeys.has(field.key)) {
        const id = await ctx.db.insert("fieldDefinitions", {
          formCode: "1040",
          year: seedYear,
          fieldKey: field.key,
          label: field.label,
          labelEs: field.labelEs,
          fieldType: "currency",
          isCalculated: field.calculated || false,
          formula: field.calculated ? `calculated(${field.key})` : undefined,
          dependsOn: [],
          isRequired: false,
          category: field.category,
          irsLineReference: field.key.replace("SchC_", "SchC-"),
          helpText: "",
          helpTextEs: "",
        });
        seededFields.push({ fieldKey: field.key, id });
      }
    }

    // Self-Employment Tax fields (Schedule SE)
    const seTaxFields = [
      { key: "SELine3", label: "Net profit", labelEs: "Ganancia neta", category: "income" as const },
      { key: "SELine4", label: "Net earnings from self-employment", labelEs: "Ganancias netas de trabajo por cuenta propia", category: "income" as const, calculated: true },
      { key: "SELine5", label: "Self-employment tax", labelEs: "Impuesto de trabajo por cuenta propia", category: "info" as const, calculated: true },
      { key: "SELine6", label: "Self-employment tax deduction", labelEs: "Deducción del impuesto de trabajo por cuenta propia", category: "deduction" as const, calculated: true },
    ];

    for (const field of seTaxFields) {
      if (!existingKeys.has(field.key)) {
        const id = await ctx.db.insert("fieldDefinitions", {
          formCode: "1040",
          year: seedYear,
          fieldKey: field.key,
          label: field.label,
          labelEs: field.labelEs,
          fieldType: "currency",
          isCalculated: field.calculated || false,
          formula: field.calculated ? `calculated(${field.key})` : undefined,
          dependsOn: [],
          isRequired: false,
          category: field.category,
          irsLineReference: field.key.replace("SE", "SE-"),
          helpText: "",
          helpTextEs: "",
        });
        seededFields.push({ fieldKey: field.key, id });
      }
    }

    // Additional common fields
    const additionalFields = [
      { key: "FilingStatus", label: "Filing Status", labelEs: "Estado Civil", fieldType: "text" as const, category: "info" as const },
      { key: "FirstName", label: "First Name", labelEs: "Nombre", fieldType: "text" as const, category: "info" as const },
      { key: "LastName", label: "Last Name", labelEs: "Apellido", fieldType: "text" as const, category: "info" as const },
      { key: "SSN", label: "Social Security Number", labelEs: "Número de Seguro Social", fieldType: "text" as const, category: "info" as const },
      { key: "SpouseSSN", label: "Spouse's Social Security Number", labelEs: "Número de Seguro Social del cónyuge", fieldType: "text" as const, category: "info" as const },
      { key: "DateOfBirth", label: "Date of Birth", labelEs: "Fecha de nacimiento", fieldType: "date" as const, category: "info" as const },
    ];

    for (const field of additionalFields) {
      if (!existingKeys.has(field.key)) {
        const id = await ctx.db.insert("fieldDefinitions", {
          formCode: "1040",
          year: seedYear,
          fieldKey: field.key,
          label: field.label,
          labelEs: field.labelEs,
          fieldType: field.fieldType,
          isCalculated: false,
          formula: undefined,
          dependsOn: [],
          isRequired: field.key === "FilingStatus",
          category: field.category,
          irsLineReference: "",
          helpText: "",
          helpTextEs: "",
        });
        seededFields.push({ fieldKey: field.key, id });
      }
    }

    return {
      message: `Successfully seeded ${seededFields.length} additional Form 1040 field definitions for tax year ${seedYear}`,
      seeded: seededFields.length,
      fields: seededFields,
    };
  },
});
