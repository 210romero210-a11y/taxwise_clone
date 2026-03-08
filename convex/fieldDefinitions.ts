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
    if (args.year !== undefined) {
      return await ctx.db
        .query("fieldDefinitions")
        .withIndex("by_formCode_year", (q) =>
          q.eq("formCode", args.formCode).eq("year", args.year!)
        )
        .collect();
    }

    // If no year specified, get all versions of the form
    const allDefinitions = await ctx.db.query("fieldDefinitions").collect();
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
          q.eq("formCode", args.formCode).eq("year", args.year!)
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
          q.eq("formCode", args.formCode).eq("year", args.year!)
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
          q.eq("formCode", args.formCode).eq("year", args.year!)
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

    const seededFields: { fieldKey: string; id: Id<"fieldDefinitions"> }[] = [];

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
    const seededFields: { fieldKey: string; id: Id<"fieldDefinitions"> }[] = [];

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

/**
 * Seed field definitions for W-2, W-4, 1099-NEC, 1099-MISC, and State Withholding forms
 */
export const seedWageIncomeFields = mutation({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const seedYear = args.year || new Date().getFullYear() - 1;
    
    // W-2 Field Definitions
    const w2Fields = [
      // Employee Information
      { key: "EmployeeSSN", label: "Employee's Social Security Number", labelEs: "Número de Seguro Social del empleado", fieldType: "text", category: "info", irsLine: "", required: true, helpText: "Enter SSN in format XXX-XX-XXXX", placeholder: "XXX-XX-XXXX" },
      { key: "EmployeeFirstName", label: "Employee's First Name", labelEs: "Nombre del empleado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeMiddleInitial", label: "Employee's Middle Initial", labelEs: "Inicial del segundo nombre", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "EmployeeLastName", label: "Employee's Last Name", labelEs: "Apellido del empleado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeSuffix", label: "Suffix", labelEs: "Sufijo", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "EmployeeAddress", label: "Employee's Address", labelEs: "Dirección del empleado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeCity", label: "City", labelEs: "Ciudad", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeState", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeZIP", label: "ZIP Code", labelEs: "Código postal", fieldType: "text", category: "info", irsLine: "", required: true },
      // Employer Information
      { key: "EmployerEIN", label: "Employer's EIN", labelEs: "EIN del empleador", fieldType: "text", category: "info", irsLine: "", required: true, helpText: "Enter EIN in format XX-XXXXXXX", placeholder: "XX-XXXXXXX" },
      { key: "EmployerName", label: "Employer's Name", labelEs: "Nombre del empleador", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerAddress", label: "Employer's Address", labelEs: "Dirección del empleador", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerCity", label: "City", labelEs: "Ciudad", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerState", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerZIP", label: "ZIP Code", labelEs: "Código postal", fieldType: "text", category: "info", irsLine: "", required: true },
      // Box fields
      { key: "Box1", label: "Wages, tips, other compensation", labelEs: "Salarios, propinas, otras compensaciones", fieldType: "currency", category: "income", irsLine: "1", required: true, helpText: "Total wages, tips, and other compensation paid to employee" },
      { key: "Box2", label: "Federal income tax withheld", labelEs: "Impuesto federal sobre el ingreso retenido", fieldType: "currency", category: "info", irsLine: "2", required: true, helpText: "Federal income tax withheld from wages" },
      { key: "Box3", label: "Social Security wages", labelEs: "Salarios del Seguro Social", fieldType: "currency", category: "income", irsLine: "3", required: true, helpText: "Wages subject to Social Security tax" },
      { key: "Box4", label: "Social Security tax withheld", labelEs: "Impuesto del Seguro Social retenido", fieldType: "currency", category: "info", irsLine: "4", required: true },
      { key: "Box5", label: "Medicare wages and tips", labelEs: "Salarios y propinas de Medicare", fieldType: "currency", category: "income", irsLine: "5", required: true, helpText: "Wages subject to Medicare tax" },
      { key: "Box6", label: "Medicare tax withheld", labelEs: "Impuesto de Medicare retenido", fieldType: "currency", category: "info", irsLine: "6", required: true },
      { key: "Box7", label: "Social Security tips", labelEs: "Propinas del Seguro Social", fieldType: "currency", category: "income", irsLine: "7", required: false },
      { key: "Box8", label: "Allocated tips", labelEs: "Propinas asignadas", fieldType: "currency", category: "income", irsLine: "8", required: false },
      { key: "Box10", label: "Dependent care benefits", labelEs: "Beneficios de cuidado de dependientes", fieldType: "currency", category: "income", irsLine: "10", required: false },
      { key: "Box11", label: "Nonqualified plans", labelEs: "Planes no calificados", fieldType: "currency", category: "income", irsLine: "11", required: false },
      { key: "Box12a", label: "Code A - 401(k) contributions", labelEs: "Código A - Contribuciones 401(k)", fieldType: "currency", category: "income", irsLine: "12a", required: false, helpText: "Elective deferrals to 401(k) plan" },
      { key: "Box12b", label: "Code B - Section 457 contributions", labelEs: "Código B - Contribuciones Sección 457", fieldType: "currency", category: "income", irsLine: "12b", required: false },
      { key: "Box12c", label: "Code C - Social Security tax on tips", labelEs: "Código C - Impuesto del Seguro Social sobre propinas", fieldType: "currency", category: "info", irsLine: "12c", required: false },
      { key: "Box12d", label: "Code D - Cafeteria plan", labelEs: "Código D - Plan de cafetería", fieldType: "currency", category: "income", irsLine: "12d", required: false },
      { key: "Box15", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "15", required: false },
      { key: "Box16", label: "State wages", labelEs: "Salarios estatales", fieldType: "currency", category: "income", irsLine: "16", required: false },
      { key: "Box17", label: "State income tax", labelEs: "Impuesto estatal sobre el ingreso", fieldType: "currency", category: "info", irsLine: "17", required: false },
      { key: "Box18", label: "Local wages", labelEs: "Salarios locales", fieldType: "currency", category: "income", irsLine: "18", required: false },
      { key: "Box19", label: "Local income tax", labelEs: "Impuesto local sobre el ingreso", fieldType: "currency", category: "info", irsLine: "19", required: false },
      { key: "Box20", label: "Locality name", labelEs: "Nombre de la localidad", fieldType: "text", category: "info", irsLine: "20", required: false },
    ];

    // W-4 Field Definitions
    const w4Fields = [
      { key: "FirstName", label: "First Name", labelEs: "Nombre", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "MiddleInitial", label: "Middle Initial", labelEs: "Inicial del segundo nombre", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "LastName", label: "Last Name", labelEs: "Apellido", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "SSN", label: "Social Security Number", labelEs: "Número de Seguro Social", fieldType: "text", category: "info", irsLine: "", required: true, placeholder: "XXX-XX-XXXX" },
      { key: "Address", label: "Address", labelEs: "Dirección", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "City", label: "City", labelEs: "Ciudad", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "State", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "ZIP", label: "ZIP Code", labelEs: "Código postal", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "FilingStatusSingle", label: "Single or Married filing separately", labelEs: "Soltero o Casado presentando por separado", fieldType: "boolean", category: "info", irsLine: "", required: false },
      { key: "FilingStatusMFJ", label: "Married filing jointly", labelEs: "Casado presentando conjuntamente", fieldType: "boolean", category: "info", irsLine: "", required: false },
      { key: "FilingStatusHOH", label: "Head of household", labelEs: "Cabeza de familia", fieldType: "boolean", category: "info", irsLine: "", required: false },
      { key: "Step3Children", label: "Number of qualifying children under 17", labelEs: "Número de hijos calificados menores de 17", fieldType: "number", category: "info", irsLine: "3", required: false, helpText: "Enter number of qualifying children" },
      { key: "Step3Other", label: "Number of other dependents", labelEs: "Número de otros dependientes", fieldType: "number", category: "info", irsLine: "3", required: false, helpText: "Enter number of other dependents" },
      { key: "Step3Total", label: "Total claiming dependent credit", labelEs: "Total para reclamar crédito por dependientes", fieldType: "currency", category: "info", irsLine: "3", required: false, helpText: "Multiply total by $2,000" },
      { key: "Step4aOtherIncome", label: "Other income (not from jobs)", labelEs: "Otros ingresos (no de empleos)", fieldType: "currency", category: "income", irsLine: "4a", required: false },
      { key: "Step4bDeductions", label: "Deductions", labelEs: "Deducciones", fieldType: "currency", category: "deduction", irsLine: "4b", required: false },
      { key: "Step4cExtraWithholding", label: "Extra withholding", labelEs: "Retención extra", fieldType: "currency", category: "info", irsLine: "4c", required: false },
      { key: "Step2a", label: "Complete if you have multiple jobs or spouse works", labelEs: "Complete si tiene múltiples empleos o el cónyuge trabaja", fieldType: "boolean", category: "info", irsLine: "2", required: false },
      { key: "Step2b", label: "Complete if you use the Higher Rate Method", labelEs: "Complete si usa el Método de Tasa Mayor", fieldType: "boolean", category: "info", irsLine: "2", required: false },
      { key: "EmployeeSignature", label: "Employee's signature", labelEs: "Firma del empleado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "DateSigned", label: "Date", labelEs: "Fecha", fieldType: "date", category: "info", irsLine: "", required: true },
    ];

    // 1099-NEC Field Definitions
    const necFields = [
      { key: "PayerTIN", label: "Payer's TIN (EIN)", labelEs: "TIN del pagador (EIN)", fieldType: "text", category: "info", irsLine: "", required: true, placeholder: "XX-XXXXXXX" },
      { key: "PayerName", label: "Payer's Name", labelEs: "Nombre del pagador", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "PayerAddress", label: "Payer's Address", labelEs: "Dirección del pagador", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "PayerCity", label: "City", labelEs: "Ciudad", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "PayerState", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "PayerZIP", label: "ZIP Code", labelEs: "Código postal", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "PayerPhone", label: "Payer's Phone", labelEs: "Teléfono del pagador", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "RecipientTIN", label: "Recipient's TIN (SSN or EIN)", labelEs: "TIN del receptor (SSN o EIN)", fieldType: "text", category: "info", irsLine: "", required: true, placeholder: "XXX-XX-XXXX or XX-XXXXXXX" },
      { key: "RecipientName", label: "Recipient's Name", labelEs: "Nombre del receptor", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "RecipientBusinessName", label: "Recipient's Business Name", labelEs: "Nombre comercial del receptor", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "RecipientAddress", label: "Recipient's Address", labelEs: "Dirección del receptor", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "RecipientCity", label: "City", labelEs: "Ciudad", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "RecipientState", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "RecipientZIP", label: "ZIP Code", labelEs: "Código postal", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "Box1", label: "Nonemployee compensation", labelEs: "Compensación no empleado", fieldType: "currency", category: "income", irsLine: "1", required: true, helpText: "Total payments for services rendered as nonemployee" },
      { key: "Box2", label: "Federal income tax withheld", labelEs: "Impuesto federal sobre el ingreso retenido", fieldType: "currency", category: "info", irsLine: "2", required: false },
      { key: "Box3", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "Box4", label: "State income tax", labelEs: "Impuesto estatal sobre el ingreso", fieldType: "currency", category: "info", irsLine: "", required: false },
      { key: "Box5", label: "Locality name", labelEs: "Nombre de la localidad", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "Box6", label: "Local income tax", labelEs: "Impuesto local sobre el ingreso", fieldType: "currency", category: "info", irsLine: "", required: false },
    ];

    // 1099-MISC Field Definitions
    const miscFields = [
      { key: "Box1", label: "Rents", labelEs: "Alquileres", fieldType: "currency", category: "income", irsLine: "1", required: false, helpText: "Rent payments received" },
      { key: "Box2", label: "Royalties", labelEs: "Regalías", fieldType: "currency", category: "income", irsLine: "2", required: false },
      { key: "Box3", label: "Other income", labelEs: "Otros ingresos", fieldType: "currency", category: "income", irsLine: "3", required: false },
      { key: "Box4", label: "Federal income tax withheld", labelEs: "Impuesto federal sobre el ingreso retenido", fieldType: "currency", category: "info", irsLine: "4", required: false },
      { key: "Box5", label: "Fishing boat proceeds", labelEs: "Ganancias de barco de pesca", fieldType: "currency", category: "income", irsLine: "5", required: false },
      { key: "Box6", label: "Medical and health care payments", labelEs: "Pagos médicos y de atención médica", fieldType: "currency", category: "income", irsLine: "6", required: false },
      { key: "Box7", label: "Nonemployee compensation", labelEs: "Compensación no empleado", fieldType: "currency", category: "income", irsLine: "7", required: false, helpText: "Used instead of 1099-NEC for prior years" },
      { key: "Box8", label: "Substitute payments in lieu of dividends", labelEs: "Pagos sustitutos en lugar de dividendos", fieldType: "currency", category: "income", irsLine: "8", required: false },
      { key: "Box9", label: "Crop insurance proceeds", labelEs: "Ganancias de seguro de cultivos", fieldType: "currency", category: "income", irsLine: "9", required: false },
      { key: "Box10", label: "Check if applicable", labelEs: "Marque si aplica", fieldType: "boolean", category: "info", irsLine: "10", required: false, helpText: "Direct sales of $5,000 or more" },
      { key: "Box13", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "Box14", label: "State income tax", labelEs: "Impuesto estatal sobre el ingreso", fieldType: "currency", category: "info", irsLine: "", required: false },
      { key: "Box15", label: "Locality name", labelEs: "Nombre de la localidad", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "Box16", label: "Local income tax", labelEs: "Impuesto local sobre el ingreso", fieldType: "currency", category: "info", irsLine: "", required: false },
    ];

    // State Withholding Field Definitions
    const stateWHFields = [
      { key: "StateCode", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: true, helpText: "Two-letter state code (e.g., CA, NY, TX)" },
      { key: "StateFormNumber", label: "State Form Number", labelEs: "Número de formulario estatal", fieldType: "text", category: "info", irsLine: "", required: false },
      { key: "EmployeeSSN", label: "Social Security Number", labelEs: "Número de Seguro Social", fieldType: "text", category: "info", irsLine: "", required: true, placeholder: "XXX-XX-XXXX" },
      { key: "EmployeeFirstName", label: "First Name", labelEs: "Nombre", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeLastName", label: "Last Name", labelEs: "Apellido", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeAddress", label: "Address", labelEs: "Dirección", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeCity", label: "City", labelEs: "Ciudad", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeState", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployeeZIP", label: "ZIP Code", labelEs: "Código postal", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerEIN", label: "Employer ID (EIN or State ID)", labelEs: "ID del empleador (EIN o ID estatal)", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerName", label: "Employer Name", labelEs: "Nombre del empleador", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerAddress", label: "Address", labelEs: "Dirección", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerCity", label: "City", labelEs: "Ciudad", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerState", label: "State", labelEs: "Estado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "EmployerZIP", label: "ZIP Code", labelEs: "Código postal", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "WithholdingType", label: "Withholding Type", labelEs: "Tipo de retención", fieldType: "text", category: "info", irsLine: "", required: true, helpText: "Select Regular, Supplemental, or Exempt" },
      { key: "Allowances", label: "Number of Allowances", labelEs: "Número de asignaciones", fieldType: "number", category: "info", irsLine: "", required: false },
      { key: "AdditionalWithholding", label: "Additional Amount to Withhold", labelEs: "Monto adicional a retener", fieldType: "currency", category: "info", irsLine: "", required: false },
      { key: "ExemptFromWithholding", label: "Claim Exemption from Withholding", labelEs: "Reclamar exención de retención", fieldType: "boolean", category: "info", irsLine: "", required: false },
      { key: "EmployeeSignature", label: "Employee Signature", labelEs: "Firma del empleado", fieldType: "text", category: "info", irsLine: "", required: true },
      { key: "DateSigned", label: "Date", labelEs: "Fecha", fieldType: "date", category: "info", irsLine: "", required: true },
    ];

    const seededFields: { formCode: string; fieldKey: string; id: Id<"fieldDefinitions"> }[] = [];
    
    // Helper function to seed fields for a form
    const seedFieldsForForm = async (formCode: string, fields: any[]) => {
      for (const field of fields) {
        // Check if field already exists
        const existing = await ctx.db
          .query("fieldDefinitions")
          .withIndex("by_formCode_year", (q) => q.eq("formCode", formCode).eq("year", seedYear))
          .collect();
        
        const exists = existing.find((f) => f.fieldKey === field.key);
        if (!exists) {
          const id = await ctx.db.insert("fieldDefinitions", {
            formCode,
            year: seedYear,
            fieldKey: field.key,
            label: field.label,
            labelEs: field.labelEs,
            fieldType: field.fieldType,
            isCalculated: false,
            formula: undefined,
            dependsOn: [],
            isRequired: field.required || false,
            category: field.category,
            irsLineReference: field.irsLine,
            helpText: field.helpText || "",
            helpTextEs: field.helpText || "",
          });
          seededFields.push({ formCode, fieldKey: field.key, id });
        }
      }
    };

    // Seed all field definitions
    await seedFieldsForForm("W2", w2Fields);
    await seedFieldsForForm("W4", w4Fields);
    await seedFieldsForForm("1099NEC", necFields);
    await seedFieldsForForm("1099MISC", miscFields);
    await seedFieldsForForm("STATE_WH", stateWHFields);

    return {
      message: `Successfully seeded ${seededFields.length} field definitions for W-2, W-4, 1099-NEC, 1099-MISC, and State Withholding forms for tax year ${seedYear}`,
      seeded: seededFields.length,
      fields: seededFields,
    };
  },
});
