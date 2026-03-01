"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { cn } from "@/lib/utils";
import {
    User,
    Building2,
    Star,
    ChevronLeft,
    ChevronRight,
    Clock,
    Loader2,
    FileText,
    Briefcase,
    Heart,
} from "lucide-react";

// Entity type definition
type EntityType = "Individual" | "Business" | "Specialty";

// Form definition from Convex
interface FormDefinition {
    _id: string;
    formCode: string;
    year: number;
    entityType: EntityType;
    formName: string;
    isActive: boolean;
}

// Entity configuration
const ENTITY_CONFIG: Record<
    EntityType,
    {
        title: string;
        description: string;
        icon: React.ReactNode;
        color: string;
        bgColor: string;
        borderColor: string;
        exampleForms: string[];
    }
> = {
    Individual: {
        title: "Individual",
        description: "Personal tax returns for individuals and families",
        icon: <User className="w-8 h-8" />,
        color: "text-blue-600",
        bgColor: "bg-blue-50 dark:bg-blue-950",
        borderColor: "border-blue-200 dark:border-blue-800",
        exampleForms: ["1040", "1040-SR", "1040-NR"],
    },
    Business: {
        title: "Business",
        description: "Partnerships, S-Corporations, and C-Corporations",
        icon: <Building2 className="w-8 h-8" />,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50 dark:bg-emerald-950",
        borderColor: "border-emerald-200 dark:border-emerald-800",
        exampleForms: ["1065", "1120S", "1120"],
    },
    Specialty: {
        title: "Specialty",
        description: "Non-profits, estates, and gift tax returns",
        icon: <Star className="w-8 h-8" />,
        color: "text-purple-600",
        bgColor: "bg-purple-50 dark:bg-purple-950",
        borderColor: "border-purple-200 dark:border-purple-800",
        exampleForms: ["990", "706", "709"],
    },
};

// Form item type for display
type FormItem = { code: string; name: string };

// Available forms by entity type
const AVAILABLE_FORMS: Record<EntityType, FormItem[]> = {
    Individual: [
        { code: "1040", name: "U.S. Individual Income Tax Return" },
        { code: "1040-SR", name: "U.S. Tax Return for Seniors" },
        { code: "1040-NR", name: "U.S. Nonresident Alien Income Tax Return" },
    ],
    Business: [
        { code: "1065", name: "U.S. Return of Partnership Income" },
        { code: "1120S", name: "U.S. Income Tax Return for an S Corporation" },
        { code: "1120", name: "U.S. Corporation Income Tax Return" },
    ],
    Specialty: [
        { code: "990", name: "Return of Organization Exempt From Income Tax" },
        { code: "706", name: "United States Estate Tax Return" },
        { code: "709", name: "United States Gift Tax Return" },
    ],
};

interface EntityPickerProps {
    onSelect: (entityType: EntityType, formCode?: string) => void;
    selectedEntityType?: string;
    showFormSelection?: boolean;
}

export function EntityPicker({
    onSelect,
    selectedEntityType,
    showFormSelection = false,
}: EntityPickerProps) {
    const currentYear = new Date().getFullYear();
    const [taxYear, setTaxYear] = useState(currentYear);
    const [selectedEntity, setSelectedEntity] = useState<EntityType | null>(
        selectedEntityType as EntityType | null
    );
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [recentEntities, setRecentEntities] = useState<Array<{ entityType: EntityType; formCode?: string; timestamp: number }>>([]);

    // Load recent entities from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("recentEntities");
        if (stored) {
            try {
                setRecentEntities(JSON.parse(stored));
            } catch {
                // Ignore parse errors
            }
        }
    }, []);

    // Save recent entity selection
    const saveRecentEntity = useCallback((entityType: EntityType, formCode?: string) => {
        const newRecent = [
            { entityType, formCode, timestamp: Date.now() },
            ...recentEntities.filter(
                (e) => !(e.entityType === entityType && e.formCode === formCode)
            ),
        ].slice(0, 5);
        setRecentEntities(newRecent);
        localStorage.setItem("recentEntities", JSON.stringify(newRecent));
    }, [recentEntities]);

    // Query Convex for available forms (filtered by year and entity type)
    const formDefinitions = useQuery(
        api.formDefinitions.getFormDefinitionsByEntityType,
        selectedEntity ? { entityType: selectedEntity } : "skip"
    );

    // Filter forms by year and active status
    const availableForms: FormItem[] = selectedEntity
        ? ((formDefinitions as FormDefinition[] | undefined)?.filter(
              (form) => form.year === taxYear && form.isActive
          ) || []).map(f => ({ code: f.formCode, name: f.formName }))
        : [];

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!showFormSelection || !selectedEntity) {
                // Entity selection keyboard navigation
                const entities: EntityType[] = ["Individual", "Business", "Specialty"];
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    setFocusedIndex((prev) => (prev + 1) % entities.length);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    setFocusedIndex((prev) => (prev - 1 + entities.length) % entities.length);
                } else if (e.key === "Enter" || e.key === " ") {
                    const entity = entities[focusedIndex];
                    handleEntitySelect(entity);
                }
            } else {
                // Form selection keyboard navigation
                const forms = availableForms.length > 0 ? availableForms : AVAILABLE_FORMS[selectedEntity];
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    setFocusedIndex((prev) => (prev + 1) % forms.length);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    setFocusedIndex((prev) => (prev - 1 + forms.length) % forms.length);
                } else if (e.key === "Enter" || e.key === " ") {
                    const form = forms[focusedIndex];
                    handleFormSelect(form.code);
                } else if (e.key === "Escape" || e.key === "Backspace") {
                    handleBackToEntities();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showFormSelection, selectedEntity, focusedIndex, availableForms]);

    const handleEntitySelect = (entityType: EntityType) => {
        setSelectedEntity(entityType);
        setFocusedIndex(0);
        if (!showFormSelection) {
            saveRecentEntity(entityType);
            onSelect(entityType);
        }
    };

    const handleFormSelect = (formCode: string) => {
        if (selectedEntity) {
            saveRecentEntity(selectedEntity, formCode);
            onSelect(selectedEntity, formCode);
        }
    };

    const handleBackToEntities = () => {
        setSelectedEntity(null);
        setFocusedIndex(0);
    };

    // Year selector options (current year and 2 years back)
    const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg mb-4">
                        <FileText className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        TaxWise Clone
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        Select your tax entity type to get started
                    </p>
                </div>

                {/* Tax Year Selector */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-1">
                        <Clock className="w-4 h-4 text-slate-500 ml-2" />
                        {yearOptions.map((year) => (
                            <button
                                key={year}
                                onClick={() => setTaxYear(year)}
                                className={cn(
                                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                                    taxYear === year
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                )}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent Entities */}
                {recentEntities.length > 0 && !selectedEntity && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                            Recent
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {recentEntities.slice(0, 3).map((recent, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setSelectedEntity(recent.entityType);
                                        if (recent.formCode) {
                                            setTimeout(() => handleFormSelect(recent.formCode!), 100);
                                        }
                                    }}
                                    className={cn(
                                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                                        ENTITY_CONFIG[recent.entityType].bgColor,
                                        ENTITY_CONFIG[recent.entityType].color,
                                        "hover:opacity-80"
                                    )}
                                >
                                    {recent.entityType}
                                    {recent.formCode && (
                                        <span className="text-xs opacity-75">• {recent.formCode}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                {!selectedEntity ? (
                    // Entity Type Selection
                    <div className="grid md:grid-cols-3 gap-6">
                        {(Object.keys(ENTITY_CONFIG) as EntityType[]).map((entityType, index) => {
                            const config = ENTITY_CONFIG[entityType];
                            return (
                                <button
                                    key={entityType}
                                    onClick={() => handleEntitySelect(entityType)}
                                    onFocus={() => setFocusedIndex(index)}
                                    className={cn(
                                        "group relative flex flex-col items-center p-6 rounded-2xl border-2 transition-all duration-200",
                                        config.bgColor,
                                        config.borderColor,
                                        "hover:shadow-xl hover:scale-[1.02]",
                                        focusedIndex === index && "ring-4 ring-blue-500 ring-offset-2"
                                    )}
                                    aria-label={`Select ${entityType} tax return`}
                                >
                                    <div
                                        className={cn(
                                            "flex items-center justify-center w-16 h-16 rounded-full mb-4",
                                            config.color,
                                            config.bgColor,
                                            "group-hover:scale-110 transition-transform"
                                        )}
                                    >
                                        {config.icon}
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                        {config.title}
                                    </h2>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-4">
                                        {config.description}
                                    </p>
                                    <div className="flex flex-wrap gap-1 justify-center">
                                        {config.exampleForms.map((form) => (
                                            <span
                                                key={form}
                                                className="inline-block px-2 py-0.5 text-xs font-medium bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                            >
                                                {form}
                                            </span>
                                        ))}
                                    </div>
                                    <ChevronRight className="absolute top-1/2 right-4 -translate-y-1/2 w-5 h-5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    // Form Selection
                    <div className="max-w-3xl mx-auto">
                        <button
                            onClick={handleBackToEntities}
                            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            <span>Back to Entity Types</span>
                        </button>

                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className={cn("p-6 border-b border-slate-200 dark:border-slate-700", ENTITY_CONFIG[selectedEntity].bgColor)}>
                                <div className="flex items-center gap-4">
                                    <div
                                        className={cn(
                                            "flex items-center justify-center w-12 h-12 rounded-full",
                                            ENTITY_CONFIG[selectedEntity].color,
                                            "bg-white dark:bg-slate-800"
                                        )}
                                    >
                                        {ENTITY_CONFIG[selectedEntity].icon}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                            {selectedEntity} Returns
                                        </h2>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            Select a form for tax year {taxYear}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {formDefinitions === undefined ? (
                                // Loading state
                                <div className="p-12 flex flex-col items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                                    <p className="text-slate-600 dark:text-slate-400">
                                        Loading available forms...
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {(availableForms.length > 0 ? availableForms : AVAILABLE_FORMS[selectedEntity]).map((form, index) => (
                                        <button
                                            key={form.code}
                                            onClick={() => handleFormSelect(form.code)}
                                            onFocus={() => setFocusedIndex(index)}
                                            className={cn(
                                                "w-full flex items-center gap-4 p-6 text-left transition-colors",
                                                "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                                                focusedIndex === index && "bg-blue-50 dark:bg-blue-900/20"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "flex items-center justify-center w-12 h-12 rounded-lg",
                                                    ENTITY_CONFIG[selectedEntity].bgColor,
                                                    ENTITY_CONFIG[selectedEntity].borderColor,
                                                    "border"
                                                )}
                                            >
                                                {selectedEntity === "Individual" && <User className={cn("w-6 h-6", ENTITY_CONFIG[selectedEntity].color)} />}
                                                {selectedEntity === "Business" && <Briefcase className={cn("w-6 h-6", ENTITY_CONFIG[selectedEntity].color)} />}
                                                {selectedEntity === "Specialty" && <Heart className={cn("w-6 h-6", ENTITY_CONFIG[selectedEntity].color)} />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                                                        {form.code}
                                                    </span>
                                                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                                        Form {form.code}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                    {form.name}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Keyboard shortcuts hint */}
                        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">↑</kbd>
                                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">↓</kbd>
                                to navigate
                            </span>
                            <span className="mx-2">•</span>
                            <span className="inline-flex items-center gap-1">
                                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">Enter</kbd>
                                to select
                            </span>
                            <span className="mx-2">•</span>
                            <span className="inline-flex items-center gap-1">
                                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">Esc</kbd>
                                to go back
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default EntityPicker;
