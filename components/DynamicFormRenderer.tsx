"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  AlertCircle,
  Calculator,
  ChevronRight,
  ChevronDown,
  DollarSign,
  Calendar,
  Hash,
  Type,
  CheckSquare,
  Save,
  Loader2,
  Info,
} from "lucide-react";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface DynamicFormRendererProps {
  formCode: string;
  year: number;
  returnId: Id<"returns">;
  mode?: "form" | "interview";
  onFieldChange?: (fieldKey: string, value: any) => void;
  readOnly?: boolean;
  instanceId?: Id<"formInstances">;
}

interface FormDefinition {
  _id: Id<"formDefinitions">;
  formCode: string;
  year: number;
  entityType: string;
  formName: string;
  sections: FormSection[];
  metadata: Record<string, any>;
  isActive: boolean;
}

interface FormSection {
  sectionId: string;
  title: string;
  description?: string;
  subsections?: FormSubsection[];
  fields?: FormFieldDef[];
}

interface FormSubsection {
  title: string;
  fields: FormFieldDef[];
}

interface FormFieldDef {
  fieldKey: string;
  label: string;
  labelEs?: string;
  type?: string;
  required?: boolean;
  irsLine?: string;
  calculated?: boolean;
}

interface FieldDefinition {
  _id: Id<"fieldDefinitions">;
  formCode: string;
  year: number;
  fieldKey: string;
  label: string;
  labelEs?: string;
  fieldType: "currency" | "number" | "text" | "boolean" | "date";
  isCalculated: boolean;
  formula?: string;
  dependsOn: string[];
  isRequired: boolean;
  category: "income" | "deduction" | "credit" | "info";
  irsLineReference: string;
  helpText: string;
  helpTextEs?: string;
}

interface FieldValue {
  _id: Id<"fields">;
  instanceId: Id<"formInstances">;
  fieldKey: string;
  value: any;
  isManualOverride: boolean;
  isEstimated?: boolean;
  isCalculated?: boolean;
}

// Tax topic for interview mode
interface TaxTopic {
  name: string;
  fields: FieldDefinition[];
  completed: number;
  total: number;
}

// =============================================================================
// CURRENCY FORMATTER
// =============================================================================

const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrency = (value: string): number => {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DynamicFormRenderer({
  formCode,
  year,
  returnId,
  mode = "form",
  onFieldChange,
  readOnly = false,
  instanceId,
}: DynamicFormRendererProps) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showHelpForField, setShowHelpForField] = useState<string | null>(null);

  // Interview mode state
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);

  // ---------------------------------------------------------------------------
  // CONVEX QUERIES
  // ---------------------------------------------------------------------------

  // Get form definition
  const formDefinition = useQuery(
    api.formDefinitions.getFormDefinition,
    { formCode, year }
  );

  // Get field definitions
  const fieldDefinitions = useQuery(
    api.fieldDefinitions.getFieldsByForm,
    { formCode, year }
  ) || [];

  // Get form instance ID if not provided
  const formInstances = useQuery(
    api.formInstances.getInstancesForReturn,
    returnId ? { returnId } : "skip"
  );

  // Get the actual instance ID to use
  const actualInstanceId = instanceId || formInstances?.[0]?._id;

  // Get field values for this instance
  const fieldValues = useQuery(
    api.fields.getFieldsForInstance,
    actualInstanceId ? { instanceId: actualInstanceId } : "skip"
  ) || [];

  // Get tax topics for interview mode
  const taxTopicsList = useQuery(api.formFields.getAllTaxTopics) || [];

  // Get fields by current tax topic for interview mode
  const currentTopicFields = useQuery(
    api.formFields.getFieldsByTaxTopic,
    mode === "interview" && taxTopicsList[currentTopicIndex]
      ? { taxTopic: taxTopicsList[currentTopicIndex] }
      : "skip"
  ) || [];

  // ---------------------------------------------------------------------------
  // CONVEX MUTATIONS
  // ---------------------------------------------------------------------------

  const updateFieldMutation = useMutation(api.fields.updateField);

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------

  // Initialize form data from field values
  useEffect(() => {
    if (fieldValues.length > 0) {
      const dataMap: Record<string, any> = {};
      fieldValues.forEach((fv: FieldValue) => {
        dataMap[fv.fieldKey] = fv.value;
      });
      setFormData(dataMap);
    }
    setLoading(false);
  }, [fieldValues]);

  // Expand all sections by default
  useEffect(() => {
    if (formDefinition?.sections) {
      const allSections = new Set<string>(formDefinition.sections.map((s: FormSection) => s.sectionId));
      setExpandedSections(allSections);
    }
  }, [formDefinition]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const handleFieldChange = useCallback(
    async (fieldKey: string, value: any, fieldDef?: FieldDefinition) => {
      // Update local state immediately for responsive UI
      setFormData((prev) => ({ ...prev, [fieldKey]: value }));

      // Clear error for this field
      if (errors[fieldKey]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[fieldKey];
          return newErrors;
        });
      }

      // Call onFieldChange callback if provided
      if (onFieldChange) {
        onFieldChange(fieldKey, value);
      }

      // Auto-save to Convex if we have an instance
      if (actualInstanceId && !readOnly) {
        try {
          setIsCalculating(true);
          await updateFieldMutation({
            instanceId: actualInstanceId,
            fieldKey,
            value,
            isManualOverride: true,
            isEstimated: false,
            isCalculated: fieldDef?.isCalculated || false,
            source: "manual",
          });
        } catch (error) {
          console.error("Failed to save field:", error);
          setErrors((prev) => ({
            ...prev,
            [fieldKey]: "Failed to save value",
          }));
        } finally {
          setIsCalculating(false);
        }
      }
    },
    [actualInstanceId, readOnly, onFieldChange, updateFieldMutation, errors]
  );

  const handleBlur = useCallback(
    async (fieldKey: string, value: any, fieldDef?: FieldDefinition) => {
      // Trigger recalculation on blur
      if (actualInstanceId && !readOnly) {
        setIsCalculating(true);
        // The mutation will trigger recalculation internally
        setTimeout(() => setIsCalculating(false), 500);
      }
    },
    [actualInstanceId, readOnly]
  );

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const validateField = useCallback(
    (fieldDef: FieldDefinition, value: any): string | null => {
      if (fieldDef.isRequired && (value === null || value === undefined || value === "")) {
        return "This field is required";
      }

      if (fieldDef.fieldType === "currency" || fieldDef.fieldType === "number") {
        const numValue = typeof value === "number" ? value : parseFloat(value);
        if (isNaN(numValue) && value !== "" && value !== null) {
          return "Please enter a valid number";
        }
      }

      return null;
    },
    []
  );

  // ---------------------------------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------------------------------

  const getFieldValue = useCallback(
    (fieldKey: string): any => {
      return formData[fieldKey] ?? "";
    },
    [formData]
  );

  const getFieldDefinition = useCallback(
    (fieldKey: string): FieldDefinition | undefined => {
      // Cast to handle type mismatch between schema string and literal type
      return (fieldDefinitions as FieldDefinition[]).find((fd: FieldDefinition) => fd.fieldKey === fieldKey);
    },
    [fieldDefinitions]
  );

  const getCalculatedValue = useCallback(
    (fieldKey: string): boolean => {
      const field = fieldValues.find((fv: FieldValue) => fv.fieldKey === fieldKey);
      return field?.isCalculated || getFieldDefinition(fieldKey)?.isCalculated || false;
    },
    [fieldValues, getFieldDefinition]
  );

  // ---------------------------------------------------------------------------
  // INTERVIEW MODE
  // ---------------------------------------------------------------------------

  const renderInterviewMode = () => {
    if (!taxTopicsList.length) {
      return (
        <div className="flex-1 p-8 text-center text-slate-500">
          Loading interview topics...
        </div>
      );
    }

    const currentTopic = taxTopicsList[currentTopicIndex];
    const topicFields = currentTopicFields.filter((f: any) => 
      (fieldDefinitions as FieldDefinition[]).some((fd: FieldDefinition) => fd.fieldKey === f.fieldKey)
    );
    
    const currentField = topicFields[currentFieldIndex];
    const currentValue = currentField ? getFieldValue(currentField.fieldKey) : "";
    const fieldDef = currentField ? getFieldDefinition(currentField.fieldKey) : null;
    const validationError = fieldDef ? validateField(fieldDef, currentValue) : null;
    const progress = topicFields.length > 0 ? ((currentFieldIndex + 1) / topicFields.length) * 100 : 0;

    // Group fields by their category for the sidebar
    const fieldsByCategory = useMemo(() => {
      const groups: Record<string, FieldDefinition[]> = {};
      topicFields.forEach((tf: any) => {
        const fd = getFieldDefinition(tf.fieldKey);
        if (fd) {
          const cat = fd.category || "info";
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(fd);
        }
      });
      return groups;
    }, [topicFields, getFieldDefinition]);

    return (
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              Interview Mode - {formDefinition?.formName || formCode}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Topic:</span>
              <select
                value={currentTopicIndex}
                onChange={(e) => {
                  setCurrentTopicIndex(parseInt(e.target.value));
                  setCurrentFieldIndex(0);
                }}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-3 py-1 text-sm font-medium"
              >
                {taxTopicsList.map((topic: string, idx: number) => (
                  <option key={topic} value={idx}>{topic}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Step {currentFieldIndex + 1} of {topicFields.length} in {currentTopic}
          </p>
        </div>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar with topic list */}
          <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-700 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-slate-300 dark:border-slate-700">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Topics
              </h3>
              <div className="flex flex-col gap-1">
                {taxTopicsList.map((topic: string, idx: number) => (
                  <button
                    key={topic}
                    onClick={() => {
                      setCurrentTopicIndex(idx);
                      setCurrentFieldIndex(0);
                    }}
                    className={cn(
                      "text-left px-3 py-2 rounded text-sm transition-colors",
                      currentTopicIndex === idx
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Fields by category */}
            <div className="p-4 flex-1">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Fields
              </h3>
              <div className="space-y-4">
                {Object.entries(fieldsByCategory).map(([category, fields]) => (
                  <div key={category}>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">
                      {category}
                    </h4>
                    <div className="space-y-1">
                      {(fields as FieldDefinition[]).map((fd, idx) => {
                        const topicFieldIdx = topicFields.findIndex((tf: any) => tf.fieldKey === fd.fieldKey);
                        const hasValue = getFieldValue(fd.fieldKey) !== "" && getFieldValue(fd.fieldKey) !== null;
                        
                        return (
                          <button
                            key={fd.fieldKey}
                            onClick={() => setCurrentFieldIndex(topicFieldIdx)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2",
                              topicFieldIdx === currentFieldIndex
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                          >
                            <span className={cn(
                              "w-2 h-2 rounded-full flex-shrink-0",
                              hasValue ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                            )} />
                            <span className="truncate">{fd.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Main wizard area */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              {currentField && fieldDef && (
                <div 
                  className={cn(
                    "bg-white dark:bg-slate-900 rounded-xl border-2 p-6 shadow-lg transition-all",
                    validationError
                      ? "border-red-500"
                      : "border-slate-200 dark:border-slate-700"
                  )}
                >
                  {/* Field label and help */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <label className="text-lg font-bold text-slate-800 dark:text-slate-200 block mb-1">
                        {fieldDef.label}
                        {fieldDef.isRequired && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      {fieldDef.helpText && (
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <HelpCircle size={14} />
                          {fieldDef.helpText}
                        </p>
                      )}
                    </div>
                    {fieldDef.irsLineReference && (
                      <span className="text-sm font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        Line {fieldDef.irsLineReference}
                      </span>
                    )}
                  </div>
                  
                  {/* Input field */}
                  <div className="mb-4">
                    {renderFieldInput(fieldDef, getFieldValue(fieldDef.fieldKey), (val) => 
                      handleFieldChange(fieldDef.fieldKey, val, fieldDef)
                    , readOnly)}
                    
                    {/* Validation message */}
                    {validationError && (
                      <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                        <AlertCircle size={14} />
                        {validationError}
                      </p>
                    )}
                  </div>
                  
                  {/* Navigation buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => {
                        if (currentFieldIndex > 0) {
                          setCurrentFieldIndex(currentFieldIndex - 1);
                        }
                      }}
                      disabled={currentFieldIndex === 0}
                      className={cn(
                        "flex items-center gap-1 px-4 py-2 rounded text-sm font-medium transition-colors",
                        currentFieldIndex === 0
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      Previous
                    </button>
                    
                    {currentFieldIndex === topicFields.length - 1 ? (
                      <button
                        className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                      >
                        Complete {currentTopic}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (currentFieldIndex < topicFields.length - 1) {
                            setCurrentFieldIndex(currentFieldIndex + 1);
                          }
                        }}
                        className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // FORM MODE
  // ---------------------------------------------------------------------------

  const renderFormMode = () => {
    if (!formDefinition || loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500">Loading form...</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Form Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                {formDefinition.formName}
              </h1>
              <p className="text-sm text-slate-500">
                Form {formCode} - Tax Year {year}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isCalculating && (
                <span className="flex items-center gap-1 text-sm text-blue-600">
                  <Calculator size={14} className="animate-pulse" />
                  Calculating...
                </span>
              )}
              {readOnly && (
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded">
                  Read Only
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form Sections */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-6xl mx-auto space-y-4">
            {formDefinition.sections?.map((section: FormSection) => (
              <div
                key={section.sectionId}
                className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.sectionId)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    {section.title}
                  </h3>
                  {expandedSections.has(section.sectionId) ? (
                    <ChevronDown size={20} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-500" />
                  )}
                </button>

                {/* Section Content */}
                {expandedSections.has(section.sectionId) && (
                  <div className="p-4">
                    {section.description && (
                      <p className="text-sm text-slate-500 mb-4">{section.description}</p>
                    )}

                    {/* Subsections */}
                    {section.subsections?.map((subsection, subIdx) => (
                      <div key={subIdx} className="mb-6 last:mb-0">
                        <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wider">
                          {subsection.title}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {subsection.fields?.map((field) => {
                            const fieldDef = getFieldDefinition(field.fieldKey);
                            const value = getFieldValue(field.fieldKey);
                            const isCalculatedField = getCalculatedValue(field.fieldKey);
                            const error = errors[field.fieldKey];

                            return (
                              <div
                                key={field.fieldKey}
                                className={cn(
                                  "relative p-3 rounded-lg border-2 transition-colors",
                                  isCalculatedField
                                    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
                                  error
                                    ? "border-red-500"
                                    : "focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
                                )}
                              >
                                {/* Field Label */}
                                <div className="flex items-start justify-between mb-2">
                                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {fieldDef?.label || field.label}
                                    {field.required && (
                                      <span className="text-red-500 ml-1">*</span>
                                    )}
                                  </label>
                                  {fieldDef?.irsLineReference && (
                                    <span className="text-xs text-slate-400 font-mono">
                                      Line {fieldDef.irsLineReference}
                                    </span>
                                  )}
                                </div>

                                {/* Field Input */}
                                {fieldDef ? (
                                  renderFieldInput(
                                    fieldDef,
                                    value,
                                    (newValue) =>
                                      handleFieldChange(field.fieldKey, newValue, fieldDef),
                                    readOnly || isCalculatedField
                                  )
                                ) : (
                                  <input
                                    type="text"
                                    value={value}
                                    onChange={(e) =>
                                      handleFieldChange(field.fieldKey, e.target.value)
                                    }
                                    disabled={readOnly}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                  />
                                )}

                                {/* Error Message */}
                                {error && (
                                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    {error}
                                  </p>
                                )}

                                {/* Help Text Icon */}
                                {fieldDef?.helpText && (
                                  <div className="absolute top-2 right-2">
                                    <button
                                      onMouseEnter={() => setShowHelpForField(field.fieldKey)}
                                      onMouseLeave={() => setShowHelpForField(null)}
                                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                      <HelpCircle size={14} />
                                    </button>
                                    {showHelpForField === field.fieldKey && (
                                      <div className="absolute right-0 top-6 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10">
                                        {fieldDef.helpText}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Calculated Indicator */}
                                {isCalculatedField && (
                                  <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-blue-600">
                                    <Calculator size={12} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Direct Fields (no subsections) */}
                    {section.fields && section.fields.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {section.fields.map((field) => {
                          const fieldDef = getFieldDefinition(field.fieldKey);
                          const value = getFieldValue(field.fieldKey);
                          const isCalculatedField = getCalculatedValue(field.fieldKey);
                          const error = errors[field.fieldKey];

                          return (
                            <div
                              key={field.fieldKey}
                              className={cn(
                                "relative p-3 rounded-lg border-2 transition-colors",
                                isCalculatedField
                                  ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
                                error
                                  ? "border-red-500"
                                  : "focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
                              )}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {fieldDef?.label || field.label}
                                  {field.required && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </label>
                                {fieldDef?.irsLineReference && (
                                  <span className="text-xs text-slate-400 font-mono">
                                    Line {fieldDef.irsLineReference}
                                  </span>
                                )}
                              </div>

                              {fieldDef ? (
                                renderFieldInput(
                                  fieldDef,
                                  value,
                                  (newValue) =>
                                    handleFieldChange(field.fieldKey, newValue, fieldDef),
                                  readOnly || isCalculatedField
                                )
                              ) : (
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) =>
                                    handleFieldChange(field.fieldKey, e.target.value)
                                  }
                                  disabled={readOnly}
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                                />
                              )}

                              {error && (
                                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                  <AlertCircle size={12} />
                                  {error}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // FIELD INPUT RENDERER
  // ---------------------------------------------------------------------------

  const renderFieldInput = (
    fieldDef: FieldDefinition,
    value: any,
    onChange: (value: any) => void,
    disabled: boolean
  ) => {
    const baseInputClass = cn(
      "w-full px-3 py-2 border-2 rounded-lg font-mono text-sm transition-colors",
      disabled
        ? "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
        : "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
      errors[fieldDef.fieldKey]
        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
        : ""
    );

    switch (fieldDef.fieldType) {
      case "currency":
        return (
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <DollarSign size={16} />
            </div>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(parseCurrency(e.target.value))}
              onBlur={() => handleBlur(fieldDef.fieldKey, value, fieldDef)}
              disabled={disabled}
              placeholder="0.00"
              className={cn(baseInputClass, "pl-8 text-right")}
            />
          </div>
        );

      case "number":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            onBlur={() => handleBlur(fieldDef.fieldKey, value, fieldDef)}
            disabled={disabled}
            className={cn(baseInputClass, "text-right")}
          />
        );

      case "text":
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => handleBlur(fieldDef.fieldKey, value, fieldDef)}
            disabled={disabled}
            placeholder={fieldDef.helpText || ""}
            className={cn(baseInputClass, "text-left")}
          />
        );

      case "boolean":
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value === true || value === "true" || value === 1 || value === "1"}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {value ? "Yes" : "No"}
            </span>
          </label>
        );

      case "date":
        return (
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Calendar size={16} />
            </div>
            <input
              type="date"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => handleBlur(fieldDef.fieldKey, value, fieldDef)}
              disabled={disabled}
              className={cn(baseInputClass, "pl-10")}
            />
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => handleBlur(fieldDef.fieldKey, value, fieldDef)}
            disabled={disabled}
            className={baseInputClass}
          />
        );
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (mode === "interview") {
    return renderInterviewMode();
  }

  return renderFormMode();
}

// =============================================================================
// EXPORTS
// =============================================================================

export default DynamicFormRenderer;
