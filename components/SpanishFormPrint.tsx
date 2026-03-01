"use client";

import React from "react";
import { FileText, Download, Printer } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBilingual } from "./BilingualProvider";

interface SpanishFormPrintProps {
  formType: string;
  taxYear?: number;
}

export function SpanishFormPrint({ formType, taxYear }: SpanishFormPrintProps) {
  const { locale } = useBilingual();
  const spanishForms = useQuery(api.i18n.getSpanishForms);
  
  const form = spanishForms?.find((f) => f.formType === formType);
  
  if (!form) {
    return null;
  }

  const isSpanish = locale === "es";
  
  // Spanish form titles
  const spanishTitles: Record<string, string> = {
    "1040": "Declaración de Impuestos sobre el Ingreso Personal de EE.UU. (Forma 1040)",
    "W2": "Declaración de Salarios e Impuestos (W-2)",
    "SchA": "Deducciones Detalladas (Anexo A)",
    "SchC": "Ganancia o Pérdida de Negocio (Anexo C)",
    "SchD": "Ganancias y Pérdidas de Capital (Anexo D)",
    "SchE": "Ingreso Suplementario y Pérdida (Anexo E)",
    "SchF": "Ganancia o Pérdida de Negocio Agrícola (Anexo F)",
    "8949": "Ventas y Disposiciones de Activos de Capital",
    "1099INT": "Declaración de Ingresos de Intereses",
    "1099DIV": "Declaración de Dividendos y Distribuciones",
  };

  const title = isSpanish 
    ? (spanishTitles[formType] || form.spanishTitle)
    : `Form ${formType}`;

  const handlePrint = () => {
    // In production, this would generate a PDF using a library like jsPDF
    window.print();
  };

  const handleDownload = () => {
    // In production, this would download a PDF
    console.log(`Downloading Spanish Form ${formType}`);
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-red-50 rounded-lg">
          <FileText className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {isSpanish ? "Año fiscal" : "Tax Year"}: {taxYear || new Date().getFullYear() - 1}
          </p>
          {isSpanish && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Disponible en español
            </p>
          )}
        </div>
      </div>
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Printer className="w-4 h-4" />
          {isSpanish ? "Imprimir" : "Print"}
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          {isSpanish ? "Descargar PDF" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}

// Spanish Forms List Component
interface SpanishFormsListProps {
  availableForms?: string[];
}

export function SpanishFormsList({ availableForms }: SpanishFormsListProps) {
  const { locale } = useBilingual();
  const spanishForms = useQuery(api.i18n.getSpanishForms);
  
  const forms = availableForms 
    ? spanishForms?.filter((f) => availableForms.includes(f.formType))
    : spanishForms;

  if (!forms || forms.length === 0) {
    return null;
  }

  const isSpanish = locale === "es";

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-gray-900">
        {isSpanish ? "Formularios en Español" : "Spanish Forms"}
      </h3>
      <p className="text-sm text-gray-500">
        {isSpanish 
          ? `${forms.length} formularios disponibles`
          : `${forms.length} forms available`
        }
      </p>
      <div className="grid gap-2">
        {forms.map((form) => (
          <SpanishFormPrint 
            key={form.formType} 
            formType={form.formType} 
          />
        ))}
      </div>
    </div>
  );
}
