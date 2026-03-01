import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// =============================================================================
// BILINGUAL SUPPORT ENGINE - EN/ES LOCALIZATION
// =============================================================================
// Provides real-time bilingual diagnostics and form support
// Replicates TaxWise feature for English/Spanish toggle

// =============================================================================
// DEFAULT TRANSLATIONS (Seed Data)
// =============================================================================

const defaultTranslations = [
  // Diagnostics - English
  { locale: "en", category: "diagnostics", key: "ERR_SSN_MISSING", value: "Social Security Number is required" },
  { locale: "en", category: "diagnostics", key: "ERR_SSN_INVALID", value: "Social Security Number must be 9 digits" },
  { locale: "en", category: "diagnostics", key: "ERR_NAME_REQUIRED", value: "Taxpayer name is required" },
  { locale: "en", category: "diagnostics", key: "ERR_ADDRESS_INCOMPLETE", value: "Complete address is required" },
  { locale: "en", category: "diagnostics", key: "ERR_INCOME_NEGATIVE", value: "Income cannot be negative" },
  { locale: "en", category: "diagnostics", key: "ERR_BANK_ROUTING_INVALID", value: "Bank routing number is invalid" },
  { locale: "en", category: "diagnostics", key: "ERR_EFIN_REQUIRED", value: "EFIN required for electronic filing" },
  { locale: "en", category: "diagnostics", key: "WARN_DEPENDENTS_EXCEED", value: "Number of dependents exceeds limit" },
  
  // Diagnostics - Spanish
  { locale: "es", category: "diagnostics", key: "ERR_SSN_MISSING", value: "Se requiere el Número de Seguro Social" },
  { locale: "es", category: "diagnostics", key: "ERR_SSN_INVALID", value: "El Número de Seguro Social debe tener 9 dígitos" },
  { locale: "es", category: "diagnostics", key: "ERR_NAME_REQUIRED", value: "Se requiere el nombre del contribuyente" },
  { locale: "es", category: "diagnostics", key: "ERR_ADDRESS_INCOMPLETE", value: "Se requiere dirección completa" },
  { locale: "es", category: "diagnostics", key: "ERR_INCOME_NEGATIVE", value: "Los ingresos no pueden ser negativos" },
  { locale: "es", category: "diagnostics", key: "ERR_BANK_ROUTING_INVALID", value: "El número de ruta bancaria es inválido" },
  { locale: "es", category: "diagnostics", key: "ERR_EFIN_REQUIRED", value: "EFIN requerido para presentación electrónica" },
  { locale: "es", category: "diagnostics", key: "WARN_DEPENDENTS_EXCEED", value: "El número de dependientes excede el límite" },
  
  // UI Labels - English
  { locale: "en", category: "ui", key: "BUTTON_SAVE", value: "Save" },
  { locale: "en", category: "ui", key: "BUTTON_CANCEL", value: "Cancel" },
  { locale: "en", category: "ui", key: "BUTTON_SUBMIT", value: "Submit to IRS" },
  { locale: "en", category: "ui", key: "BUTTON_PRINT", value: "Print Form" },
  { locale: "en", category: "ui", key: "LABEL_STATUS", value: "Status" },
  { locale: "en", category: "ui", key: "LABEL_PROGRESS", value: "Progress" },
  
  // UI Labels - Spanish
  { locale: "es", category: "ui", key: "BUTTON_SAVE", value: "Guardar" },
  { locale: "es", category: "ui", key: "BUTTON_CANCEL", value: "Cancelar" },
  { locale: "es", category: "ui", key: "BUTTON_SUBMIT", value: "Enviar al IRS" },
  { locale: "es", category: "ui", key: "BUTTON_PRINT", value: "Imprimir Forma" },
  { locale: "es", category: "ui", key: "LABEL_STATUS", value: "Estado" },
  { locale: "es", category: "ui", key: "LABEL_PROGRESS", value: "Progreso" },
  
  // Form Titles - English
  { locale: "en", category: "forms", key: "FORM_1040", value: "U.S. Individual Income Tax Return" },
  { locale: "en", category: "forms", key: "FORM_W2", value: "Wage and Tax Statement" },
  { locale: "en", category: "forms", key: "FORM_SCHA", value: "Itemized Deductions" },
  { locale: "en", category: "forms", key: "FORM_SCHC", value: "Profit or Loss From Business" },
  
  // Form Titles - Spanish
  { locale: "es", category: "forms", key: "FORM_1040", value: "Declaración de Impuestos sobre el Ingreso Personal de EE.UU." },
  { locale: "es", category: "forms", key: "FORM_W2", value: "Declaración de Salarios y Impuestos" },
  { locale: "es", category: "forms", key: "FORM_SCHA", value: "Deducciones Detalladas" },
  { locale: "es", category: "forms", key: "FORM_SCHC", value: "Ganancia o Pérdida de Negocio" },
  
  // Help Text - English
  { locale: "en", category: "help", key: "HELP_SSN_FORMAT", value: "Enter 9 digits without dashes" },
  { locale: "en", category: "help", key: "HELP_EFIN_FORMAT", value: "Your EFIN is 6 digits provided by IRS" },
  { locale: "en", category: "help", key: "HELP_BANK_ROUTING", value: "Routing number is 9 digits (first 2 must be 01-12 or 21-32)" },
  
  // Help Text - Spanish
  { locale: "es", category: "help", key: "HELP_SSN_FORMAT", value: "Ingrese 9 dígitos sin guiones" },
  { locale: "es", category: "help", key: "HELP_EFIN_FORMAT", value: "Su EFIN es de 6 dígitos proporcionado por el IRS" },
  { locale: "es", category: "help", key: "HELP_BANK_ROUTING", value: "El número de ruta tiene 9 dígitos (los primeros 2 deben ser 01-12 o 21-32)" },
];

// =============================================================================
// TRANSLATION FUNCTIONS
// =============================================================================

/**
 * Get translation for a specific key and locale
 */
export const getTranslation = query({
  args: { locale: v.string(), category: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const translation = await ctx.db
      .query("translations")
      .withIndex("by_locale_category", (q) => 
        q.eq("locale", args.locale).eq("category", args.category)
      )
      .filter((q) => q.eq(q.field("key"), args.key))
      .first();
    
    return translation?.value || null;
  },
});

/**
 * Get all translations for a locale and category
 */
export const getTranslationsForCategory = query({
  args: { locale: v.string(), category: v.string() },
  handler: async (ctx, args) => {
    const translations = await ctx.db
      .query("translations")
      .withIndex("by_locale_category", (q) => 
        q.eq("locale", args.locale).eq("category", args.category)
      )
      .collect();
    
    const result: Record<string, string> = {};
    for (const t of translations) {
      result[t.key] = t.value;
    }
    return result;
  },
});

/**
 * Get all translations for a locale
 */
export const getAllTranslations = query({
  args: { locale: v.string() },
  handler: async (ctx, args) => {
    const translations = await ctx.db
      .query("translations")
      .filter((q) => q.eq(q.field("locale"), args.locale))
      .collect();
    
    const result: Record<string, Record<string, string>> = {};
    for (const t of translations) {
      if (!result[t.category]) {
        result[t.category] = {};
      }
      result[t.category][t.key] = t.value;
    }
    return result;
  },
});

/**
 * Add or update a translation
 */
export const upsertTranslation = mutation({
  args: { locale: v.string(), category: v.string(), key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("translations")
      .withIndex("by_locale_category", (q) => 
        q.eq("locale", args.locale).eq("category", args.category)
      )
      .filter((q) => q.eq(q.field("key"), args.key))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("translations", args);
    }
  },
});

// =============================================================================
// SEED DEFAULT TRANSLATIONS
// =============================================================================

/**
 * Seed default translations (called on initialization)
 */
export const seedDefaultTranslations = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const t of defaultTranslations) {
      const existing = await ctx.db
        .query("translations")
        .withIndex("by_locale_category", (q) => 
          q.eq("locale", t.locale).eq("category", t.category)
        )
        .filter((q) => q.eq(q.field("key"), t.key))
        .first();
      
      if (!existing) {
        await ctx.db.insert("translations", t);
      }
    }
    return { seeded: defaultTranslations.length };
  },
});

// =============================================================================
// USER PREFERENCES (LOCALE)
// =============================================================================

/**
 * Get user locale preference
 */
export const getUserLocale = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    return prefs?.locale || "en";
  },
});

/**
 * Set user locale preference
 */
export const setUserLocale = mutation({
  args: { userId: v.id("users"), locale: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { locale: args.locale, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        locale: args.locale,
        updatedAt: Date.now(),
      });
    }
  },
});

// =============================================================================
// SPANISH FORMS METADATA
// =============================================================================

const defaultSpanishForms = [
  { formType: "1040", spanishTitle: "Declaración de Impuestos sobre el Ingreso Personal (Forma 1040)", availableForPrint: true, taxYears: [2023, 2024, 2025] },
  { formType: "W2", spanishTitle: "Declaración de Salarios e Impuestos (W-2)", availableForPrint: true, taxYears: [2023, 2024, 2025] },
  { formType: "SchA", spanishTitle: "Deducciones Detalladas (Anexo A)", availableForPrint: true, taxYears: [2023, 2024, 2025] },
  { formType: "SchC", spanishTitle: "Ganancia o Pérdida de Negocio (Anexo C)", availableForPrint: true, taxYears: [2023, 2024, 2025] },
  { formType: "SchD", spanishTitle: "Ganancias y Pérdidas de Capital (Anexo D)", availableForPrint: true, taxYears: [2023, 2024, 2025] },
  { formType: "SchE", spanishTitle: "Ingreso Suplementario y Pérdida (Anexo E)", availableForPrint: true, taxYears: [2023, 2024, 2025] },
  { formType: "SchF", spanishTitle: "Ganancia o Pérdida de Negocio Agrícola (Anexo F)", availableForPrint: true, taxYears: [2023, 2024, 2025] },
  { formType: "8949", spanishTitle: "Ventas y Disposiciones de Activos de Capital", availableForPrint: true, taxYears: [2023, 2024, 2025] },
  { formType: "1099INT", spanishTitle: "Declaración de Ingresos de Intereses", availableForPrint: true, taxYears: [2023, 2024, 2025] },
  { formType: "1099DIV", spanishTitle: "Declaración de Dividendos y Distribuciones", availableForPrint: true, taxYears: [2023, 2024, 2025] },
];

/**
 * Seed Spanish form metadata
 */
export const seedSpanishForms = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const form of defaultSpanishForms) {
      const existing = await ctx.db
        .query("spanishForms")
        .withIndex("by_form", (q) => q.eq("formType", form.formType))
        .first();
      
      if (!existing) {
        await ctx.db.insert("spanishForms", form);
      }
    }
    return { seeded: defaultSpanishForms.length };
  },
});

/**
 * Get available Spanish forms
 */
export const getSpanishForms = query({
  args: {},
  handler: async (ctx) => {
    const forms = await ctx.db.query("spanishForms").collect();
    return forms.filter(f => f.availableForPrint);
  },
});
