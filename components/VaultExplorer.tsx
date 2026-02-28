"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
    FileText, 
    Image, 
    Eye, 
    X, 
    CheckCircle2, 
    AlertCircle,
    User,
    Users,
    Shield
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

interface VaultExplorerProps {
    returnId: Id<"returns">;
    onClose: () => void;
    onSelectInstance?: (instanceId: Id<"formInstances">) => void;
}

export function VaultExplorer({ returnId, onClose, onSelectInstance }: VaultExplorerProps) {
    const instances = useQuery(api.formInstances.getInstancesForReturn, { returnId });
    
    const [selectedInstance, setSelectedInstance] = useState<Id<"formInstances"> | null>(null);
    const [selectedStorageId, setSelectedStorageId] = useState<Id<"_storage"> | null>(null);
    const [taxpayerFilter, setTaxpayerFilter] = useState<"all" | "primary" | "spouse">("all");

    // Filter instances by taxpayer role
    const filteredInstances = instances?.filter(instance => {
        if (taxpayerFilter === "all") return true;
        return instance.taxpayerRole === taxpayerFilter || !instance.taxpayerRole;
    }) || [];

    const selectedInstanceData = instances?.find(i => i._id === selectedInstance);
    const hasDocuments = (filteredInstances?.filter(i => i.storageId)?.length || 0) > 0;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-300 dark:border-slate-700">
                {/* Header */}
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-black uppercase tracking-wide">Document Vault</h2>
                        <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                            {filteredInstances?.length || 0} documents
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Taxpayer Filter Toggle */}
                        <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 rounded-lg p-1">
                            <button
                                onClick={() => setTaxpayerFilter("all")}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold rounded transition-colors",
                                    taxpayerFilter === "all" 
                                        ? "bg-blue-600 text-white" 
                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                )}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setTaxpayerFilter("primary")}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1",
                                    taxpayerFilter === "primary" 
                                        ? "bg-blue-600 text-white" 
                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                )}
                            >
                                <User size={12} /> Primary
                            </button>
                            <button
                                onClick={() => setTaxpayerFilter("spouse")}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1",
                                    taxpayerFilter === "spouse" 
                                        ? "bg-purple-600 text-white" 
                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                )}
                            >
                                <Users size={12} /> Spouse
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Document List Sidebar */}
                    <div className="w-80 border-r border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto">
                        <div className="p-3">
                            <h3 className="text-xs font-black uppercase text-slate-500 mb-2">Uploaded Documents</h3>
                            {filteredInstances.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No documents uploaded
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredInstances.map(instance => (
                                        <div
                                            key={instance._id}
                                            onClick={() => {
                                                setSelectedInstance(instance._id);
                                                if (instance.storageId) setSelectedStorageId(instance.storageId);
                                            }}
                                            className={cn(
                                                "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                                                selectedInstance === instance._id
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    {instance.storageId ? (
                                                        <Image className="w-4 h-4 text-blue-500" />
                                                    ) : (
                                                        <FileText className="w-4 h-4 text-slate-400" />
                                                    )}
                                                    <span className="text-xs font-bold">{instance.formType}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {instance.documentSource === "ai_ocr" && (
                                                        <span className="text-[10px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded font-bold">
                                                            AI
                                                        </span>
                                                    )}
                                                    {instance.taxpayerRole === "spouse" && (
                                                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">
                                                            S
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                                                {instance.instanceName}
                                            </p>
                                            {instance.uploadedAt && (
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    {new Date(instance.uploadedAt).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Document Viewer */}
                    <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950">
                        {selectedInstance && selectedStorageId ? (
                            <DocumentViewer 
                                storageId={selectedStorageId} 
                                instance={selectedInstanceData}
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-400">
                                <div className="text-center">
                                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">Select a document to view</p>
                                    <p className="text-xs mt-1 opacity-60">Verify AI-extracted data against source</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-t border-slate-300 dark:border-slate-700 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-4 text-slate-500">
                        <span className="flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-green-500" /> AI Verified
                        </span>
                        <span className="flex items-center gap-1">
                            <AlertCircle size={12} className="text-amber-500" /> Manual Review
                        </span>
                    </div>
                    <span className="font-medium text-slate-600 dark:text-slate-400">
                        IRS Publication 1345 Compliant Storage
                    </span>
                </div>
            </div>
        </div>
    );
}

function DocumentViewer({ 
    storageId, 
    instance 
}: { 
    storageId: Id<"_storage">; 
    instance?: any;
}) {
    const imageUrl = useQuery(api.files.getImageUrl, { storageId });
    const [zoom, setZoom] = useState(100);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-900 px-4 py-2 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {instance?.instanceName || "Document"}
                    </span>
                    {instance?.documentSource === "ai_ocr" && (
                        <span className="flex items-center gap-1 text-[10px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} />
                            AI Extracted
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setZoom(Math.max(50, zoom - 25))}
                        className="px-2 py-1 text-xs font-bold bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                        -
                    </button>
                    <span className="text-xs font-mono w-12 text-center">{zoom}%</span>
                    <button
                        onClick={() => setZoom(Math.min(200, zoom + 25))}
                        className="px-2 py-1 text-xs font-bold bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* Image */}
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt="Document"
                        className="shadow-lg rounded"
                        style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center">
                            <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Loading document...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
