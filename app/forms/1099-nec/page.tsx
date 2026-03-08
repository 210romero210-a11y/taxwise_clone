"use client";

import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * 1099-NEC Form Data Entry Page
 * 
 * Route: /forms/1099-nec
 * 
 * This page provides the data entry interface for the 1099-NEC (Nonemployee Compensation) form.
 * The 1099-NEC is used to report payments of $600 or more to nonemployees (independent contractors).
 */
export default function Form1099NECPage() {
  const params = useParams();
  const returnId = params.returnId as string | undefined;
  
  // Get current tax year (default to previous year for filing)
  const currentYear = new Date().getFullYear();
  const taxYear = currentYear - 1;

  // Check if form definitions exist - if not, seed them
  const formDefinitions = useQuery(
    api.formDefinitions.getFormDefinition,
    { formCode: "1099NEC", year: taxYear }
  );

  // Seed mutations
  const seedDefaultForms = useMutation(api.formDefinitions.seedDefaultForms);
  const seedAdditionalForms = useMutation(api.formDefinitions.seedAdditionalTaxForms);
  const seedFieldDefinitions = useMutation(api.fieldDefinitions.seedWageIncomeFields);

  const [isSeeding, setIsSeeding] = useState(false);

  // Auto-seed form and field definitions if they don't exist
  useEffect(() => {
    async function seedIfNeeded() {
      // Wait for the query to complete
      if (formDefinitions === undefined) return;
      
      // If form definition exists, no need to seed
      if (formDefinitions !== null) return;
      
      // If already seeding, skip
      if (isSeeding) return;

      setIsSeeding(true);

      try {
        await seedDefaultForms({});
        await seedAdditionalForms({});
        await seedFieldDefinitions({ year: taxYear });
        console.log("Successfully seeded form definitions");
      } catch (e) {
        console.error("Seed error:", e);
      } finally {
        setIsSeeding(false);
      }
    }

    seedIfNeeded();
  }, [formDefinitions, isSeeding, seedDefaultForms, seedAdditionalForms, seedFieldDefinitions, taxYear]);

  if (isSeeding || formDefinitions === undefined) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-600">Initializing form...</p>
        <p className="text-sm text-slate-400 mt-2">This may take a moment on first load</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <DynamicFormRenderer 
        formCode="1099NEC"
        year={taxYear}
        returnId={returnId as any}
        mode="form"
      />
    </div>
  );
}
