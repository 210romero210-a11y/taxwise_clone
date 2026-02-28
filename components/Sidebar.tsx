"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, Plus, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export function Sidebar({
    returnId,
    activeInstanceId,
    onSelectInstance
}: {
    returnId: Id<"returns">,
    activeInstanceId: Id<"formInstances"> | null,
    onSelectInstance: (id: Id<"formInstances">) => void
}) {
    const [isOpen, setIsOpen] = useState(true);
    const instances = useQuery(api.formInstances.getInstancesForReturn, { returnId });
    const createInstance = useMutation(api.formInstances.createInstance);

    const handleAddInstance = (formType: string, instanceName: string) => {
        createInstance({ returnId, formType, instanceName }).then((id) => {
            onSelectInstance(id);
        });
    };

    if (instances === undefined) return null;

    const federalInstances = instances.filter((i: { formType: string }) => ["1040", "W2", "SchA", "SchC"].includes(i.formType));

    return (
        <div className={cn(
            "bg-slate-100 dark:bg-slate-900 border-r border-slate-300 dark:border-slate-700 h-screen transition-all duration-300 flex flex-col",
            isOpen ? "w-72" : "w-16"
        )}>
            <div className="p-4 flex items-center justify-between border-b border-slate-300 dark:border-slate-700 h-[65px]">
                {isOpen && <h2 className="font-bold text-slate-800 dark:text-slate-200">Forms Tree</h2>}
                <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
                    <ChevronRight className={cn("transition-transform", isOpen && "rotate-180")} size={20} />
                </button>
            </div>

            {isOpen && (
                <div className="flex-1 overflow-y-auto p-2">
                    <div className="flex flex-col gap-1">
                        <TreeSection label="Federal Forms" icon={<Folder size={16} />} defaultOpen>
                            {federalInstances.map((instance: { _id: Id<"formInstances">; formType: string; instanceName: string; status: string }) => (
                                <TreeItem
                                    key={instance._id}
                                    label={instance.instanceName}
                                    icon={<FileText size={16} className={cn(instance.formType === "1040" ? "text-blue-500" : "text-slate-500")} />}
                                    status={instance.status}
                                    isActive={activeInstanceId === instance._id}
                                    onClick={() => onSelectInstance(instance._id)}
                                />
                            ))}
                        </TreeSection>

                        <div className="mt-4 px-2">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">Add Worksheets</h3>
                            <button
                                onClick={() => handleAddInstance("W2", `W-2 (Stub ${instances.filter((i: { formType: string }) => i.formType === "W2").length + 1})`)}

                                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 rounded transition-colors"
                            >
                                <Plus size={14} />
                                <span>Add W-2</span>
                            </button>
                            <button
                                onClick={() => handleAddInstance("SchA", "Schedule A")}
                                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 rounded transition-colors"
                            >
                                <Plus size={14} />
                                <span>Add Schedule A</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TreeSection({ label, icon, children, defaultOpen = false }: { label: string, icon: React.ReactNode, children?: React.ReactNode, defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div>
            <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-400"
                onClick={() => setOpen(!open)}
            >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {icon}
                <span>{label}</span>
            </div>
            {open && (
                <div className="ml-4 border-l border-slate-300 dark:border-slate-700 pl-2 mt-1 flex flex-col gap-1">
                    {children}
                </div>
            )}
        </div>
    );
}

function TreeItem({
    label,
    icon,
    status,
    isActive,
    onClick
}: {
    label: string,
    icon: React.ReactNode,
    status: string,
    isActive: boolean,
    onClick: () => void
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-sm transition-colors",
                isActive
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent"
            )}
            onClick={onClick}
        >
            <div className="flex items-center gap-2">
                <span className="w-3.5 inline-block"></span>
                {icon}
                <span>{label}</span>
            </div>
            <div className="flex items-center">
                {status === "Complete" && <CheckCircle2 size={12} className="text-green-500" />}
                {status === "Error" && <AlertCircle size={12} className="text-red-500" />}
                {status === "In Progress" && <Clock size={12} className="text-amber-500" />}
            </div>
        </div>
    );
}

