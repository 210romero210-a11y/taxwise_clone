"use client";

import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * W-4 Form Data Entry Page
 * 
 * Route: /forms/w4
 * 
 * This page provides the data entry interface for the W-4 (Employee's Withholding Certificate).
 * The W-4 is used by employees to tell employers how much federal income tax to withhold.
 */
export default function W4FormPage() {
  const params = useParams();
  const returnId = params.returnId as string | undefined;
  
  // Get current tax year (default to current year for withholding)
  const currentYear = new Date().getFullYear();
  const taxYear = currentYear;

  // Check if form definitions exist - if not, seed them
  const formDefinitions = useQuery(
    api.formDefinitions.getFormDefinition,
    { formCode: "W4", year: taxYear }
  );

  // Seed mutations
  const seedDefaultForms = useMutation(api.formDefinitions.seedDefaultForms);
  const seedAdditionalForms = useMutation(api.formDefinitions.seedAdditionalTaxForms);
  const seedFieldDefinitions = useMutation(api.fieldDefinitions.seedWageIncomeFields);

  const [isSeeding, setIsSeeding] = useState(false);

  // Auto-seed form and field definitions if they don't exist
  useEffect(() => {
    async function seedIfNeeded() {
      if (formDefinitions === undefined) return;
      if (formDefinitions !== null) return;
      if (isSeeding) return;

      setIsSeeding(true);
      try {
        await seedDefaultForms({});
        await seedAdditionalForms({});
        await seedFieldDefinitions({ year: taxYear });
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
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <DynamicFormRenderer 
        formCode="W4"
        year={taxYear}
        returnId={returnId as any}
        mode="form"
      />
    </div>
  );
}
