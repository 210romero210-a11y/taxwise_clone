"use client";

import Link from "next/link";
import { 
  FileText, 
  Users, 
  DollarSign, 
  Briefcase, 
  MapPin,
  Calculator,
  ChevronRight,
  ClipboardList
} from "lucide-react";

/**
 * Tax Forms Index Page
 * 
 * Route: /forms
 * 
 * This page provides a central navigation hub for all available tax forms.
 * Forms are organized by category for easy access.
 */
export default function FormsIndexPage() {
  const currentYear = new Date().getFullYear();
  const taxYear = currentYear - 1;

  const formCategories = [
    {
      title: "Income Documents",
      description: "Documents reporting income received during the tax year",
      forms: [
        {
          name: "W-2",
          description: "Wage and Tax Statement - Annual wages from employer",
          href: "/forms/w2",
          icon: FileText,
          taxYear: taxYear,
        },
        {
          name: "1099-NEC",
          description: "Nonemployee Compensation - Payments to contractors",
          href: "/forms/1099-nec",
          icon: Briefcase,
          taxYear: taxYear,
        },
        {
          name: "1099-MISC",
          description: "Miscellaneous Income - Rents, royalties, and other income",
          href: "/forms/1099-misc",
          icon: DollarSign,
          taxYear: taxYear,
        },
      ],
    },
    {
      title: "Withholding Certificates",
      description: "Documents for tax withholding elections",
      forms: [
        {
          name: "W-4",
          description: "Employee's Withholding Certificate - Federal withholding",
          href: "/forms/w4",
          icon: Users,
          taxYear: currentYear,
        },
        {
          name: "State Withholding",
          description: "State Income Tax Withholding Certificate",
          href: "/forms/state-wh",
          icon: MapPin,
          taxYear: currentYear,
        },
      ],
    },
    {
      title: "Tax Returns",
      description: "Main tax return forms",
      forms: [
        {
          name: "Form 1040",
          description: "U.S. Individual Income Tax Return",
          href: "/forms/1040",
          icon: Calculator,
          taxYear: taxYear,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Tax Forms
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Select a form to enter data for Tax Year {taxYear}
          </p>
        </div>
      </div>

      {/* Form Categories */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-10">
          {formCategories.map((category) => (
            <div key={category.title}>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {category.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {category.description}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.forms.map((form) => {
                  const Icon = form.icon;
                  return (
                    <Link
                      key={form.href}
                      href={form.href}
                      className="group block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {form.name}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Tax Year {form.taxYear}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                      </div>
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                        {form.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
