"use client";

import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * W-2 Form Data Entry Page
 * 
 * Route: /forms/w2
 * 
 * This page provides the data entry interface for the W-2 (Wage and Tax Statement) form.
 * The W-2 is used by employers to report wages paid to employees and taxes withheld.
 */
export default function W2FormPage() {
  const params = useParams();
  const returnId = params.returnId as string | undefined;
  const router = useRouter();
  
  // Get current tax year (default to previous year for filing)
  const currentYear = new Date().getFullYear();
  const taxYear = currentYear - 1;

  // Check if form definitions exist - if not, seed them
  const formDefinitions = useQuery(
    api.formDefinitions.getFormDefinition,
    { formCode: "W2", year: taxYear }
  );

  // Seed mutations
  const seedDefaultForms = useMutation(api.formDefinitions.seedDefaultForms);
  const seedAdditionalForms = useMutation(api.formDefinitions.seedAdditionalTaxForms);
  const seedFieldDefinitions = useMutation(api.fieldDefinitions.seedWageIncomeFields);
  const createReturn = useMutation(api.returns.createReturn);
  const createInstance = useMutation(api.formInstances.createInstance);

  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

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
      setSeedError(null);

      try {
        // Seed the default forms (1040, etc.)
        await seedDefaultForms({});
        
        // Seed the additional tax forms (W2, W4, 1099, etc.)
        await seedAdditionalForms({});
        
        // Seed the field definitions for wage income forms
        await seedFieldDefinitions({ year: taxYear });
        
        console.log("Successfully seeded form and field definitions");
      } catch (error) {
        console.error("Failed to seed form definitions:", error);
        setSeedError(error instanceof Error ? error.message : "Failed to seed");
      } finally {
        setIsSeeding(false);
      }
    }

    seedIfNeeded();
  }, [formDefinitions, isSeeding, seedDefaultForms, seedAdditionalForms, seedFieldDefinitions, taxYear]);

  // Show loading state while seeding
  if (isSeeding || formDefinitions === undefined) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-600">Initializing form...</p>
        <p className="text-sm text-slate-400 mt-2">This may take a moment on first load</p>
      </div>
    );
  }

  // Show error if seeding failed
  if (seedError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="text-red-600 mb-4">Failed to initialize form</div>
        <p className="text-sm text-slate-500">{seedError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <DynamicFormRenderer 
        formCode="W2"
        year={taxYear}
        returnId={returnId as any}
        mode="form"
      />
    </div>
  );
}
