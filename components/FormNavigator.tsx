"use client";

import { useState, useMemo, useCallback } from "react";
import { 
    ChevronRight, 
    ChevronDown, 
    FileText, 
    Folder, 
    FolderOpen,
    Plus, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    Search,
    X,
    Briefcase,
    Building2,
    Heart,
    Receipt,
    Calculator,
    DollarSign,
    TrendingUp,
    Users,
    Tractor,
    FileBarChart,
    ClipboardList,
    MoreHorizontal,
    Trash2,
    Copy
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type EntityType = "Individual" | "Business" | "Specialty";
type FormStatus = "In Progress" | "Complete" | "Error" | "Not Started";

interface FormInstanceData {
    _id: Id<"formInstances">;
    formType: string;
    instanceName: string;
    status: string;
    errorCount?: number;
    taxpayerRole?: string;
}

interface DiagnosticData {
    instanceId: Id<"formInstances">;
    severity: string;
}

interface FormTreeNode {
    id: string;
    label: string;
    formType?: string;
    icon: React.ReactNode;
    children?: FormTreeNode[];
    isPrimary?: boolean;
    isExpandable?: boolean;
}

// =============================================================================
// FORM CONFIGURATION BY ENTITY TYPE
// =============================================================================

const INDIVIDUAL_FORMS: FormTreeNode[] = [
    {
        id: "1040",
        label: "1040 - U.S. Individual Income Tax Return",
        formType: "1040",
        icon: <FileText size={18} className="text-blue-500" />,
        isPrimary: true,
        children: [
            {
                id: "W2",
                label: "W-2 - Wage and Tax Statement",
                formType: "W2",
                icon: <Briefcase size={16} className="text-green-600" />,
                isExpandable: true,
            },
            {
                id: "1099",
                label: "1099 Forms",
                formType: "1099",
                icon: <DollarSign size={16} className="text-emerald-600" />,
                isExpandable: true,
            },
            {
                id: "Sch1",
                label: "Schedule 1 - Additional Income and Adjustments",
                formType: "Sch1",
                icon: <Calculator size={16} className="text-orange-600" />,
            },
            {
                id: "Sch2",
                label: "Schedule 2 - Additional Credits and Payments",
                formType: "Sch2",
                icon: <Calculator size={16} className="text-orange-600" />,
            },
            {
                id: "Sch3",
                label: "Schedule 3 - Additional Credits and Payments",
                formType: "Sch3",
                icon: <Calculator size={16} className="text-orange-600" />,
            },
            {
                id: "SchA",
                label: "Schedule A - Itemized Deductions",
                formType: "SchA",
                icon: <ClipboardList size={16} className="text-amber-600" />,
            },
            {
                id: "SchB",
                label: "Schedule B - Interest and Ordinary Dividends",
                formType: "SchB",
                icon: <TrendingUp size={16} className="text-amber-600" />,
            },
            {
                id: "SchC",
                label: "Schedule C - Profit or Loss from Business",
                formType: "SchC",
                icon: <Briefcase size={16} className="text-indigo-600" />,
            },
            {
                id: "SchD",
                label: "Schedule D - Capital Gains and Losses",
                formType: "SchD",
                icon: <TrendingUp size={16} className="text-indigo-600" />,
            },
            {
                id: "SchE",
                label: "Schedule E - Supplemental Income and Loss",
                formType: "SchE",
                icon: <TrendingUp size={16} className="text-indigo-600" />,
            },
            {
                id: "SchF",
                label: "Schedule F - Profit or Loss from Farming",
                formType: "SchF",
                icon: <Tractor size={16} className="text-green-600" />,
            },
            {
                id: "SchSE",
                label: "Schedule SE - Self-Employment Tax",
                formType: "SchSE",
                icon: <Calculator size={16} className="text-red-600" />,
            },
            {
                id: "Form8949",
                label: "Form 8949 - Sales and Dispositions",
                formType: "8949",
                icon: <FileBarChart size={16} className="text-purple-600" />,
            },
        ],
    },
];

const BUSINESS_FORMS: FormTreeNode[] = [
    {
        id: "1065",
        label: "1065 - U.S. Return of Partnership Income",
        formType: "1065",
        icon: <Users size={18} className="text-purple-500" />,
        isPrimary: true,
        children: [
            {
                id: "K1",
                label: "Schedule K-1 - Partner's Share of Income",
                formType: "K1",
                icon: <Users size={16} className="text-violet-600" />,
                isExpandable: true,
            },
            {
                id: "Form4562",
                label: "Form 4562 - Depreciation",
                formType: "4562",
                icon: <Calculator size={16} className="text-gray-600" />,
            },
            {
                id: "Form4797",
                label: "Form 4797 - Sales of Business Property",
                formType: "4797",
                icon: <TrendingUp size={16} className="text-gray-600" />,
            },
        ],
    },
    {
        id: "1120S",
        label: "1120S - U.S. Income Tax Return for S Corporation",
        formType: "1120S",
        icon: <Building2 size={18} className="text-indigo-500" />,
        isPrimary: true,
        children: [
            {
                id: "K1",
                label: "Schedule K-1 - Shareholder's Share of Income",
                formType: "K1",
                icon: <Users size={16} className="text-violet-600" />,
                isExpandable: true,
            },
            {
                id: "Form4562",
                label: "Form 4562 - Depreciation",
                formType: "4562",
                icon: <Calculator size={16} className="text-gray-600" />,
            },
            {
                id: "Form4797",
                label: "Form 4797 - Sales of Business Property",
                formType: "4797",
                icon: <TrendingUp size={16} className="text-gray-600" />,
            },
        ],
    },
];

const SPECIALTY_FORMS: FormTreeNode[] = [
    {
        id: "990",
        label: "990 - Return of Organization Exempt From Income Tax",
        formType: "990",
        icon: <Heart size={18} className="text-rose-500" />,
        isPrimary: true,
        children: [
            {
                id: "SchA",
                label: "Schedule A - Public Charity Status",
                formType: "SchA",
                icon: <ClipboardList size={16} className="text-amber-600" />,
            },
            {
                id: "SchB",
                label: "Schedule B - Contributors",
                formType: "SchB",
                icon: <Users size={16} className="text-amber-600" />,
            },
        ],
    },
];

// =============================================================================
// STATUS DOT COMPONENT
// =============================================================================

function StatusDot({ status, errorCount = 0 }: { status: FormStatus; errorCount?: number }) {
    if (status === "Complete") {
        return <CheckCircle2 size={14} className="text-green-500" />;
    }
    if (status === "Error" || errorCount > 0) {
        return (
            <div className="relative">
                <AlertCircle size={14} className="text-red-500" />
                {errorCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                        {errorCount > 9 ? "9+" : errorCount}
                    </span>
                )}
            </div>
        );
    }
    if (status === "In Progress") {
        return <Clock size={14} className="text-amber-500" />;
    }
    return <div className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600" />;
}

// =============================================================================
// FORM TREE ITEM COMPONENT
// =============================================================================

interface FormTreeItemProps {
    node: FormTreeNode;
    instances: FormInstanceData[];
    diagnostics: DiagnosticData[];
    expandedNodes: Set<string>;
    toggleNode: (nodeId: string) => void;
    activeFormCode?: string;
    onSelectForm: (formCode: string, instanceId?: string) => void;
    onAddForm: (formType: string) => void;
    onDeleteForm: (instanceId: Id<"formInstances">) => void;
    depth?: number;
    searchQuery?: string;
}

function FormTreeItem({
    node,
    instances,
    diagnostics,
    expandedNodes,
    toggleNode,
    activeFormCode,
    onSelectForm,
    onAddForm,
    onDeleteForm,
    depth = 0,
    searchQuery = "",
}: FormTreeItemProps) {
    // Get instances for this form type
    const nodeInstances = instances.filter(
        (inst) => inst.formType === node.formType || 
        (node.formType === "1099" && inst.formType.startsWith("1099"))
    );
    
    // Get error count for this form type
    const errorCount = nodeInstances.reduce((acc, inst) => {
        const instDiagnostics = diagnostics.filter(d => 
            d.instanceId === inst._id && d.severity === "Error"
        );
        return acc + instDiagnostics.length;
    }, 0);
    
    // Determine overall status for this node
    const overallStatus = useMemo((): FormStatus => {
        if (nodeInstances.length === 0) return "Not Started";
        const hasError = nodeInstances.some(inst => inst.status === "Error" || errorCount > 0);
        if (hasError) return "Error";
        const allComplete = nodeInstances.every(inst => inst.status === "Complete");
        if (allComplete) return "Complete";
        return "In Progress";
    }, [nodeInstances, errorCount]);
    
    // Filter by search query
    const matchesSearch = searchQuery === "" || 
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nodeInstances.some(inst => 
            inst.instanceName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    
    // If searching and this node doesn't match and has no matching children, hide it
    const hasMatchingChildren = node.children?.some(child => {
        const childInstances = instances.filter(inst => inst.formType === child.formType);
        return searchQuery === "" || 
            child.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            childInstances.some(inst => 
                inst.instanceName.toLowerCase().includes(searchQuery.toLowerCase())
            );
    }) || false;
    
    if (searchQuery !== "" && !matchesSearch && !hasMatchingChildren) {
        return null;
    }
    
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = activeFormCode === node.formType;
    
    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all group",
                    isActive
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800",
                    depth > 0 && "ml-4"
                )}
                onClick={() => {
                    if (hasChildren) {
                        toggleNode(node.id);
                    }
                    if (nodeInstances.length > 0) {
                        onSelectForm(node.formType!, nodeInstances[0]._id);
                    }
                }}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Chevron or expand icon */}
                    <span className="w-4 flex-shrink-0">
                        {hasChildren && (
                            isExpanded ? (
                                <ChevronDown size={14} className="text-slate-400" />
                            ) : (
                                <ChevronRight size={14} className="text-slate-400" />
                            )
                        )}
                    </span>
                    
                    {/* Icon */}
                    {node.icon}
                    
                    {/* Label */}
                    <span className="truncate text-sm">
                        {node.label}
                    </span>
                    
                    {/* Instance count badge */}
                    {nodeInstances.length > 0 && (
                        <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                            ({nodeInstances.length})
                        </span>
                    )}
                </div>
                
                {/* Status and actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <StatusDot status={overallStatus} errorCount={errorCount} />
                    
                    {/* Add button for expandable forms */}
                    {node.isExpandable && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddForm(node.formType!);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-opacity"
                            title={`Add ${node.label}`}
                        >
                            <Plus size={14} className="text-slate-500" />
                        </button>
                    )}
                </div>
            </div>
            
            {/* Render children */}
            {hasChildren && isExpanded && (
                <div className="ml-2 border-l border-slate-200 dark:border-slate-700 pl-2 mt-1 flex flex-col gap-0.5">
                    {node.children!.map((child) => (
                        <FormTreeItem
                            key={child.id}
                            node={child}
                            instances={instances}
                            diagnostics={diagnostics}
                            expandedNodes={expandedNodes}
                            toggleNode={toggleNode}
                            activeFormCode={activeFormCode}
                            onSelectForm={onSelectForm}
                            onAddForm={onAddForm}
                            onDeleteForm={onDeleteForm}
                            depth={depth + 1}
                            searchQuery={searchQuery}
                        />
                    ))}
                </div>
            )}
            
            {/* Render individual instances (for expandable nodes like W2, 1099, K1) */}
            {node.isExpandable && isExpanded && nodeInstances.length > 0 && (
                <div className="ml-6 border-l border-slate-200 dark:border-slate-700 pl-2 mt-1 flex flex-col gap-0.5">
                    {nodeInstances.map((inst) => {
                        const instErrors = diagnostics.filter(d => 
                            d.instanceId === inst._id && d.severity === "Error"
                        ).length;
                        
                        return (
                            <div
                                key={inst._id}
                                className={cn(
                                    "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all group",
                                    activeFormCode === inst.formType && 
                                    inst._id === activeFormCode
                                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium"
                                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                                )}
                                onClick={() => onSelectForm(inst.formType, inst._id)}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="w-4" />
                                    <FileText size={14} className="text-slate-400 flex-shrink-0" />
                                    <span className="truncate text-sm">{inst.instanceName}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <StatusDot 
                                        status={inst.status as FormStatus} 
                                        errorCount={instErrors} 
                                    />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteForm(inst._id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-200 dark:hover:bg-red-900/40 rounded transition-opacity"
                                        title="Delete form"
                                    >
                                        <Trash2 size={12} className="text-red-500" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// =============================================================================
// ADD FORM MODAL (Simple inline version)
// =============================================================================

interface AddFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (formType: string, instanceName: string) => void;
    availableForms: FormTreeNode[];
    existingCount: number;
}

function AddFormModal({ isOpen, onClose, onAdd, availableForms, existingCount }: AddFormModalProps) {
    const [selectedForm, setSelectedForm] = useState<string>("");
    const [customName, setCustomName] = useState("");
    
    if (!isOpen) return null;
    
    const selectedFormNode = availableForms.find(f => f.formType === selectedForm);
    const defaultName = selectedFormNode 
        ? `${selectedFormNode.label.split(" - ")[0]} (${existingCount + 1})`
        : "";
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-80 max-h-[80vh] overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Add New Form</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
                        <X size={18} />
                    </button>
                </div>
                
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Select Form Type
                        </label>
                        <select
                            value={selectedForm}
                            onChange={(e) => setSelectedForm(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        >
                            <option value="">-- Select --</option>
                            {availableForms.map((form) => (
                                <option key={form.formType} value={form.formType}>
                                    {form.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Instance Name (optional)
                        </label>
                        <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder={defaultName}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (selectedForm) {
                                    onAdd(selectedForm, customName || defaultName);
                                    onClose();
                                }
                            }}
                            disabled={!selectedForm}
                            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Form
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// MAIN FORM NAVIGATOR COMPONENT
// =============================================================================

interface FormNavigatorProps {
    returnId: string;
    activeFormCode?: string;
    onSelectForm: (formCode: string, instanceId?: string) => void;
    entityType: EntityType;
}

export function FormNavigator({
    returnId,
    activeFormCode,
    onSelectForm,
    entityType,
}: FormNavigatorProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["1040", "1065", "1120S", "990"]));
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addFormType, setAddFormType] = useState<string>("");
    
    // Convex queries
    const instances = useQuery(api.formInstances.getInstancesForReturn, { 
        returnId: returnId as Id<"returns"> 
    });
    const diagnostics = useQuery(api.diagnostics.getDiagnosticsForReturn, { 
        returnId: returnId as Id<"returns"> 
    });
    
    const createInstance = useMutation(api.formInstances.createInstance);
    const deleteInstance = useMutation(api.formInstances.deleteInstance);
    
    const loading = instances === undefined || diagnostics === undefined;
    
    // Get form tree based on entity type
    const formTree = useMemo(() => {
        switch (entityType) {
            case "Individual":
                return INDIVIDUAL_FORMS;
            case "Business":
                return BUSINESS_FORMS;
            case "Specialty":
                return SPECIALTY_FORMS;
            default:
                return INDIVIDUAL_FORMS;
        }
    }, [entityType]);
    
    // Get all available forms for add modal
    const availableForms = useMemo(() => {
        const forms: FormTreeNode[] = [];
        const collectForms = (nodes: FormTreeNode[]) => {
            for (const node of nodes) {
                if (node.formType && !node.isPrimary) {
                    forms.push(node);
                }
                if (node.children) {
                    collectForms(node.children);
                }
            }
        };
        collectForms(formTree);
        return forms;
    }, [formTree]);
    
    // Toggle node expansion
    const toggleNode = useCallback((nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, []);
    
    // Handle adding a new form
    const handleAddForm = useCallback(async (formType: string, instanceName: string) => {
        try {
            await createInstance({
                returnId: returnId as Id<"returns">,
                formType,
                instanceName,
            });
        } catch (error) {
            console.error("Failed to create form instance:", error);
        }
    }, [createInstance, returnId]);
    
    // Handle deleting a form
    const handleDeleteForm = useCallback(async (instanceId: Id<"formInstances">) => {
        try {
            await deleteInstance({ instanceId });
        } catch (error) {
            console.error("Failed to delete form instance:", error);
        }
    }, [deleteInstance]);
    
    // Open add modal for specific form type
    const openAddModal = useCallback((formType: string) => {
        setAddFormType(formType);
        setIsAddModalOpen(true);
    }, []);
    
    // Get existing count for form type
    const getExistingCount = useCallback((formType: string) => {
        if (!instances) return 0;
        return instances.filter(inst => inst.formType === formType).length;
    }, [instances]);
    
    // Get primary form instance for entity type
    const primaryFormType = useMemo(() => {
        switch (entityType) {
            case "Individual":
                return "1040";
            case "Business":
                return "1065"; // or 1120S
            case "Specialty":
                return "990";
            default:
                return "1040";
        }
    }, [entityType]);
    
    // Get entity type icon
    const entityIcon = useMemo(() => {
        switch (entityType) {
            case "Individual":
                return <Receipt size={20} className="text-blue-500" />;
            case "Business":
                return <Building2 size={20} className="text-purple-500" />;
            case "Specialty":
                return <Heart size={20} className="text-rose-500" />;
            default:
                return <FileText size={20} className="text-slate-500" />;
        }
    }, [entityType]);
    
    // Get entity type label
    const entityLabel = useMemo(() => {
        switch (entityType) {
            case "Individual":
                return "Individual Return (1040)";
            case "Business":
                return "Business Return (1065/1120S)";
            case "Specialty":
                return "Tax-Exempt Org (990)";
            default:
                return "Tax Return";
        }
    }, [entityType]);
    
    // Error summary
    const errorSummary = useMemo(() => {
        if (!diagnostics || !instances) return { errors: 0, warnings: 0 };
        const errors = diagnostics.filter(d => d.severity === "Error").length;
        const warnings = diagnostics.filter(d => d.severity === "Warning").length;
        return { errors, warnings };
    }, [diagnostics, instances]);
    
    if (loading) {
        return (
            <div className={cn(
                "bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 h-screen flex items-center justify-center",
                isOpen ? "w-72" : "w-16"
            )}>
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-500">Loading forms...</span>
                </div>
            </div>
        );
    }
    
    return (
        <div className={cn(
            "bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 h-screen flex flex-col transition-all duration-300",
            isOpen ? "w-80" : "w-16"
        )}>
            {/* Header */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 h-[56px] flex items-center justify-between flex-shrink-0">
                {isOpen && (
                    <div className="flex items-center gap-2">
                        {entityIcon}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">
                            {entityLabel}
                        </span>
                    </div>
                )}
                <button 
                    onClick={() => setIsOpen(!isOpen)} 
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                    <ChevronRight className={cn(
                        "transition-transform text-slate-500", 
                        isOpen && "rotate-180"
                    )} size={18} />
                </button>
            </div>
            
            {isOpen && (
                <>
                    {/* Search */}
                    <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search forms..."
                                className="w-full pl-9 pr-8 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text focus:outline-none-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                                >
                                    <X size={14} className="text-slate-400" />
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* Error/Warning summary */}
                    {(errorSummary.errors > 0 || errorSummary.warnings > 0) && (
                        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex gap-2">
                                {errorSummary.errors > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                                        <AlertCircle size={12} />
                                        <span>{errorSummary.errors} error{errorSummary.errors !== 1 ? "s" : ""}</span>
                                    </div>
                                )}
                                {errorSummary.warnings > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                        <Clock size={12} />
                                        <span>{errorSummary.warnings} warning{errorSummary.warnings !== 1 ? "s" : ""}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Form Tree */}
                    <div className="flex-1 overflow-y-auto p-2">
                        <div className="flex flex-col gap-1">
                            {formTree.map((node) => (
                                <FormTreeItem
                                    key={node.id}
                                    node={node}
                                    instances={instances || []}
                                    diagnostics={diagnostics || []}
                                    expandedNodes={expandedNodes}
                                    toggleNode={toggleNode}
                                    activeFormCode={activeFormCode}
                                    onSelectForm={onSelectForm}
                                    onAddForm={openAddModal}
                                    onDeleteForm={handleDeleteForm}
                                    searchQuery={searchQuery}
                                />
                            ))}
                        </div>
                    </div>
                    
                    {/* Quick Add Section */}
                    <div className="p-3 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">
                            Quick Add
                        </h4>
                        <div className="flex flex-wrap gap-1">
                            {availableForms.slice(0, 4).map((form) => (
                                <button
                                    key={form.formType}
                                    onClick={() => openAddModal(form.formType!)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded transition-colors"
                                    title={`Add ${form.label}`}
                                >
                                    <Plus size={12} />
                                    <span className="truncate max-w-[60px]">{form.formType}</span>
                                </button>
                            ))}
                            {availableForms.length > 4 && (
                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded transition-colors"
                                >
                                    <MoreHorizontal size={12} />
                                    <span>More</span>
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
            
            {/* Add Form Modal */}
            <AddFormModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddForm}
                availableForms={availableForms}
                existingCount={addFormType ? getExistingCount(addFormType) : 0}
            />
        </div>
    );
}

export default FormNavigator;
