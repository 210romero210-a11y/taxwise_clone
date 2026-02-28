"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

interface InterviewModeWizardProps {
  returnId: Id<"returns">;
  instanceId: Id<"formInstances">;
  onComplete?: () => void;
}

export function InterviewModeWizard({ returnId, instanceId, onComplete }: InterviewModeWizardProps) {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Get all tax topics
  const taxTopics = useQuery(api.formFields.getAllTaxTopics) || [];
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  // Get fields for selected topic
  const topicFields = useQuery(
    api.formFields.getFieldsByTaxTopic,
    selectedTopic ? { taxTopic: selectedTopic } : "skip"
  ) || [];
  
  // Get existing field values for this instance
  const existingFields = useQuery(api.fields.getFieldsForInstance, { instanceId }) || [];
  
  // Get running totals
  const runningTotals = useQuery(api.formFields.getTaxTotals, { returnId }) || [];
  
  // Seed form fields on first load (use ref to avoid infinite loop)
  const seedFields = useMutation(api.formFields.seedFormFields);
  const seedFieldsRef = useRef(seedFields);
  seedFieldsRef.current = seedFields;
  
  useEffect(() => {
    seedFieldsRef.current();
  }, []);
  
  const updateField = useMutation(api.fields.updateField);
  const updateTaxTotal = useMutation(api.formFields.updateTaxTotal);
  
  // Calculate running total from existing fields
  const calculateRunningTotal = useCallback(() => {
    if (!topicFields.length) return 0;
    return topicFields.reduce((sum, field) => {
      const existing = existingFields.find((f: any) => f.fieldKey === field.fieldKey);
      const val = existing?.value ? parseFloat(existing.value.toString()) : 0;
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [topicFields, existingFields]);
  
  // Update running total when fields change
  const runningTotal = calculateRunningTotal();
  
  // Select first topic on mount
  useEffect(() => {
    if (taxTopics.length > 0 && !selectedTopic) {
      setSelectedTopic(taxTopics[0]);
    }
  }, [taxTopics, selectedTopic]);
  
  // Set active field to first field of current topic
  useEffect(() => {
    if (topicFields.length > 0 && !activeFieldId) {
      setActiveFieldId(topicFields[0].fieldKey);
    }
  }, [topicFields, activeFieldId]);
  
  const getFieldValue = (fieldKey: string): string => {
    const field = existingFields.find((f: any) => f.fieldKey === fieldKey);
    return field?.value?.toString() || "";
  };
  
  const handleFieldChange = async (fieldKey: string, value: string) => {
    const numValue = parseFloat(value);
    const isNumeric = !isNaN(numValue);
    
    // Get the old value to calculate delta for running total
    const oldValue = getFieldValue(fieldKey);
    const oldNumValue = oldValue ? parseFloat(oldValue) : 0;
    const isOldNumeric = !isNaN(oldNumValue);
    
    // Update the field
    await updateField({
      instanceId,
      fieldKey,
      value: isNumeric ? numValue : value,
      isManualOverride: false,
      isEstimated: false,
      isCalculated: false,
    });
    
    // Update running total if numeric - use delta to handle edits correctly
    if (isNumeric && isOldNumeric) {
      const delta = numValue - oldNumValue;
      const newTotal = runningTotal + delta;
      await updateTaxTotal({
        returnId,
        fieldKey: `${selectedTopic}_total`,
        amount: newTotal,
      });
    } else if (isNumeric && !isOldNumeric) {
      // Adding a new value to previously empty field
      const newTotal = runningTotal + numValue;
      await updateTaxTotal({
        returnId,
        fieldKey: `${selectedTopic}_total`,
        amount: newTotal,
      });
    }
  };
  
  const validateField = (field: any, value: string): { valid: boolean; message?: string } => {
    if (!field.validationRules) return { valid: true };
    
    const { required, min, max, pattern } = field.validationRules;
    
    if (required && !value) {
      return { valid: false, message: "This field is required" };
    }
    
    if (value) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (min !== undefined && numValue < min) {
          return { valid: false, message: `Minimum value is ${min}` };
        }
        if (max !== undefined && numValue > max) {
          return { valid: false, message: `Maximum value is ${max}` };
        }
      }
      
      if (pattern) {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
          return { valid: false, message: "Invalid format" };
        }
      }
    }
    
    return { valid: true };
  };
  
  const handleNext = () => {
    if (currentStep < topicFields.length - 1) {
      const nextField = topicFields[currentStep + 1];
      setCurrentStep(currentStep + 1);
      setActiveFieldId(nextField.fieldKey);
    }
  };
  
  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevField = topicFields[currentStep - 1];
      setCurrentStep(currentStep - 1);
      setActiveFieldId(prevField.fieldKey);
    }
  };
  
  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    setCurrentStep(0);
    setActiveFieldId(null);
  };
  
  if (!selectedTopic || taxTopics.length === 0) {
    return (
      <div className="flex-1 p-8 text-center text-slate-500">
        Loading interview topics...
      </div>
    );
  }
  
  const currentField = topicFields[currentStep];
  const currentValue = currentField ? getFieldValue(currentField.fieldKey) : "";
  const validation = currentField ? validateField(currentField, currentValue) : { valid: true };
  const progress = topicFields.length > 0 ? ((currentStep + 1) / topicFields.length) * 100 : 0;
  
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Interview Mode
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Topic:</span>
            <select
              value={selectedTopic}
              onChange={(e) => handleTopicSelect(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-3 py-1 text-sm font-medium"
            >
              {taxTopics.map((topic) => (
                <option key={topic} value={topic}>{topic}</option>
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
          Step {currentStep + 1} of {topicFields.length} in {selectedTopic}
        </p>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with topic list and running total */}
        <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-300 dark:border-slate-700">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Topics
            </h3>
            <div className="flex flex-col gap-1">
              {taxTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleTopicSelect(topic)}
                  className={cn(
                    "text-left px-3 py-2 rounded text-sm transition-colors",
                    selectedTopic === topic
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
          
          {/* Running Total Display */}
          <div className="p-4 mt-auto border-t border-slate-300 dark:border-slate-700">
            <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="text-xs font-bold text-green-700 dark:text-green-400 uppercase mb-1">
                Running Total
              </h4>
              <p className="text-2xl font-black text-green-800 dark:text-green-300">
                ${runningTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-green-600 dark:text-green-500 mt-1">
                {selectedTopic} Subtotal
              </p>
            </div>
          </div>
        </div>
        
        {/* Main wizard area */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            {currentField && (
              <div 
                id={`wizard-field-${currentField.fieldKey}`}
                className={cn(
                  "bg-white dark:bg-slate-900 rounded-xl border-2 p-6 shadow-lg transition-all",
                  activeFieldId === currentField.fieldKey
                    ? "border-blue-500 ring-4 ring-blue-500/20"
                    : "border-slate-200 dark:border-slate-700"
                )}
              >
                {/* Field label and help */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <label className="text-lg font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      {currentField.fieldLabel}
                    </label>
                    {currentField.metadata?.helpText && (
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <HelpCircle size={14} />
                        {currentField.metadata.helpText}
                      </p>
                    )}
                  </div>
                  {currentField.metadata?.lineNumber && (
                    <span className="text-sm font-bold text-slate-400">
                      Line {currentField.metadata.lineNumber}
                    </span>
                  )}
                </div>
                
                {/* Input field */}
                <div className="mb-4">
                  {currentField.inputType === "boolean" ? (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentValue === "true" || currentValue === "1"}
                        onChange={(e) => handleFieldChange(currentField.fieldKey, e.target.checked ? "true" : "false")}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-600 dark:text-slate-400">Yes</span>
                    </label>
                  ) : (
                    <input
                      type={currentField.inputType === "currency" ? "number" : "text"}
                      step={currentField.inputType === "currency" ? "0.01" : undefined}
                      value={currentValue}
                      onChange={(e) => handleFieldChange(currentField.fieldKey, e.target.value)}
                      placeholder={currentField.metadata?.placeholder || ""}
                      className={cn(
                        "w-full px-4 py-3 text-lg border-2 rounded-lg font-mono",
                        !validation.valid
                          ? "border-red-500 focus:ring-red-500/20"
                          : "border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20"
                      )}
                      autoFocus={activeFieldId === currentField.fieldKey}
                    />
                  )}
                  
                  {/* Validation message */}
                  {!validation.valid && (
                    <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {validation.message}
                    </p>
                  )}
                </div>
                
                {/* Navigation buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                    className={cn(
                      "flex items-center gap-1 px-4 py-2 rounded text-sm font-medium transition-colors",
                      currentStep === 0
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  
                  {currentStep === topicFields.length - 1 ? (
                    <button
                      onClick={onComplete}
                      className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      <CheckCircle2 size={16} />
                      Complete {selectedTopic}
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Field list preview */}
            <div className="mt-8">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Fields in this topic
              </h4>
              <div className="space-y-2">
                {topicFields.map((field, idx) => {
                  const value = getFieldValue(field.fieldKey);
                  const hasValue = value && value !== "" && value !== "0" && value !== "false";
                  
                  return (
                    <div
                      key={field.fieldKey}
                      onClick={() => {
                        setCurrentStep(idx);
                        setActiveFieldId(field.fieldKey);
                      }}
                      className={cn(
                        "flex items-center justify-between px-4 py-2 rounded cursor-pointer transition-colors",
                        idx === currentStep
                          ? "bg-blue-100 dark:bg-blue-900/30"
                          : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {hasValue ? (
                          <CheckCircle2 size={14} className="text-green-500" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                        )}
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {field.fieldLabel}
                        </span>
                      </div>
                      {hasValue && (
                        <span className="text-sm font-mono text-slate-500">
                          {value}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
