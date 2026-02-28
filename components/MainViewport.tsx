import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Info, AlertCircle, CheckCircle2, Upload, FileUp, Printer } from "lucide-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Form1040Print } from "./Form1040Print";

export function TaxField({
    label,
    value,
    onChange,
    isOverride = false,
    onOverrideToggle,
    isEstimated = false,
    onEstimateToggle,
    isCalculated = false,
    lineNumber,
    className,
    id
}: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    isOverride?: boolean;
    onOverrideToggle?: () => void;
    isEstimated?: boolean;
    onEstimateToggle?: () => void;
    isCalculated?: boolean;
    lineNumber?: string;
    className?: string;
    id?: string;
}) {
    return (
        <div id={id} className={cn("flex flex-col gap-0.5 border-b border-slate-200 dark:border-slate-800 py-1 group relative", className)}>
            <div className="flex justify-between items-end px-1">
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                    {lineNumber && <span className="font-bold text-slate-900 dark:text-slate-100">{lineNumber}</span>}
                    {label}
                </label>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEstimateToggle && (
                        <button
                            onClick={onEstimateToggle}
                            className={cn("text-[9px] uppercase font-bold px-1 rounded", isEstimated ? "bg-amber-100 text-amber-700" : "text-slate-400")}
                        >
                            Est (F3)
                        </button>
                    )}
                    {onOverrideToggle && (
                        <button
                            onClick={onOverrideToggle}
                            className={cn("text-[9px] uppercase font-bold px-1 rounded", isOverride ? "bg-red-100 text-red-700" : "text-slate-400")}
                        >
                            {isOverride ? "Locked (F8)" : "Lock (F8)"}
                        </button>
                    )}
                </div>
            </div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "F3" && onEstimateToggle) {
                        e.preventDefault();
                        onEstimateToggle();
                    }
                    if ((e.key === "F8" || (e.key === "Enter" && e.ctrlKey)) && onOverrideToggle) {
                        e.preventDefault();
                        onOverrideToggle();
                    }
                }}
                className={cn(
                    "px-1.5 py-0.5 text-sm bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/30 font-mono transition-colors rounded",
                    // TaxWise Color Coding
                    isOverride ? "text-pink-600 dark:text-pink-400 font-bold bg-pink-50/30" : // Pink = Override
                        isCalculated ? "text-blue-700 dark:text-blue-400 font-medium" : // Blue = Calculated
                            "text-slate-900 dark:text-slate-100", // Black/White = Manual

                    isEstimated && "border-b border-dotted border-amber-500", // Dotted = Estimate
                    !value && !isOverride ? "bg-slate-50/50 dark:bg-slate-900/50" : ""
                )}
            />
        </div>
    );
}

export function MainViewport({ instanceId }: { instanceId: Id<"formInstances"> }) {
    const instance = useQuery(api.formInstances.getInstance, { instanceId });
    const fields = useQuery(api.fields.getFieldsForInstance, { instanceId });
    const diagnostics = useQuery(api.diagnostics.getDiagnosticsForReturn,
        instance ? { returnId: instance.returnId } : "skip" as any
    );
    const updateField = useMutation(api.fields.updateField);
    const generateUploadUrl = useMutation(api.files.generateUploadUrl);
    const processDocument = useAction(api.ocr.processDocument);

    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "e") {
                e.preventDefault();
                // Find first diagnostic field and focus it
                if (diagnostics && diagnostics.length > 0) {
                    const firstErrField = diagnostics[0].fieldKey;
                    const el = document.getElementById(`field-${firstErrField}`);
                    if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        (el.querySelector("input") as HTMLInputElement)?.focus();
                    }
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [diagnostics]);

    if (fields === undefined || !instance) {
        return <div className="flex-1 p-8 text-center text-slate-500">Loading Form Data...</div>;
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !instance) return;

        setIsScanning(true);
        try {
            const postUrl = await generateUploadUrl();
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const { storageId } = await result.json();
            await processDocument({ storageId, returnId: instance.returnId });
        } catch (err) {
            console.error(err);
            alert("Failed to process document.");
        } finally {
            setIsScanning(false);
        }
    };

    const getFieldData = (key: string) => {
        const field = fields.find((f: any) => f.fieldKey === key);
        return {
            value: field?.value?.toString() || "",
            isOverride: field?.isManualOverride || false,
            isEstimated: field?.isEstimated || false,
            isCalculated: field?.isCalculated || false
        };
    };

    const handleFieldChange = (key: string, value: string) => {
        const { isOverride, isEstimated, isCalculated } = getFieldData(key);
        updateField({
            instanceId,
            fieldKey: key,
            value,
            isManualOverride: isOverride,
            isEstimated,
            isCalculated
        });
    };

    const handleOverrideToggle = (key: string) => {
        const { value, isOverride, isEstimated, isCalculated } = getFieldData(key);
        updateField({
            instanceId,
            fieldKey: key,
            value,
            isManualOverride: !isOverride,
            isEstimated,
            isCalculated
        });
    };

    const handleEstimateToggle = (key: string) => {
        const { value, isOverride, isEstimated, isCalculated } = getFieldData(key);
        updateField({
            instanceId,
            fieldKey: key,
            value,
            isManualOverride: isOverride,
            isEstimated: !isEstimated,
            isCalculated
        });
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-200 dark:bg-slate-950">
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-2xl max-w-5xl mx-auto min-h-full flex flex-col relative">
                    {isScanning && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                            <div className="relative">
                                <FileUp size={48} className="text-blue-600 animate-pulse" />
                                <div className="absolute -bottom-2 -right-2 bg-blue-100 dark:bg-blue-900 rounded-full p-1 animate-spin">
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                </div>
                            </div>
                            <span className="mt-4 font-black text-blue-600 uppercase tracking-widest text-sm italic">Phoenix AI Scanning...</span>
                            <p className="text-xs text-slate-500 mt-2">MAPPING IMAGE TO IRS FIELDKEYS</p>
                        </div>
                    )}
                    {/* Header Strip mimicking IRS style */}
                    <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <span className="font-black text-xl tracking-tighter italic">PhoenixTax</span>
                            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
                            <span className="text-xs font-bold text-slate-500 uppercase">{instance.instanceName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-green-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Calculations Current</span>
                            </div>
                            <label className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded cursor-pointer transition-colors transition-opacity group no-print">
                                <Upload size={12} className="group-hover:animate-bounce" />
                                <span className="text-[10px] font-black uppercase">Scan Doc</span>
                                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                            </label>

                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white px-2 py-1 rounded transition-colors no-print"
                            >
                                <Printer size={12} />
                                <span className="text-[10px] font-black uppercase">Export PDF</span>
                            </button>
                        </div>
                    </div>

                    <div className="p-8 flex-1">
                        {instance.formType === "1040" && (
                            <div className="grid grid-cols-12 gap-6">
                                <div className="col-span-12 md:col-span-8">
                                    <section className="mb-8">
                                        <h2 className="text-2xl font-black mb-4 border-b-2 border-slate-900 dark:border-slate-100 pb-1">INCOME</h2>
                                        <div className="grid grid-cols-1 border-t border-l border-slate-200 dark:border-slate-800">
                                            {[
                                                { key: "1z", label: "Wages, salaries, tips, etc. (Attach W-2)" },
                                                { key: "2b", label: "Taxable interest" },
                                                { key: "3b", label: "Ordinary dividends" },
                                                { key: "7", label: "Capital gain or (loss)" },
                                                { key: "9", label: "TOTAL INCOME" },
                                                { key: "11", label: "ADJUSTED GROSS INCOME" },
                                                { key: "12", label: "Standard Deduction" },
                                                { key: "15", label: "TAXABLE INCOME" },
                                                { key: "16", label: "TAX" },
                                                { key: "24", label: "TOTAL TAX LIABILITY" },
                                            ].map(item => {
                                                const fieldKey = `1040_Line${item.key}`;
                                                const data = getFieldData(fieldKey);
                                                return (
                                                    <TaxField
                                                        key={item.key}
                                                        id={`field-${fieldKey}`}
                                                        lineNumber={item.key}
                                                        label={item.label}
                                                        value={data.value}
                                                        isOverride={data.isOverride}
                                                        isCalculated={data.isCalculated}
                                                        isEstimated={data.isEstimated}
                                                        onChange={(val) => handleFieldChange(fieldKey, val)}
                                                        onOverrideToggle={() => handleOverrideToggle(fieldKey)}
                                                        onEstimateToggle={() => handleEstimateToggle(fieldKey)}
                                                        className="border-r"
                                                    />
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>
                                <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
                                    <SummaryPanel refundAmount={getFieldData("1040_RefundAmount").value} />
                                </div>
                            </div>
                        )}

                        {instance.formType === "W2" && (
                            <div className="grid grid-cols-12 gap-6">
                                <div className="col-span-12">
                                    <h2 className="text-2xl font-black mb-6 border-b-2 border-slate-900 dark:border-slate-100 pb-1 italic">Wage and Tax Statement (W-2)</h2>
                                    <div className="grid grid-cols-4 gap-0 border-t border-l border-slate-200 dark:border-slate-800">
                                        {[
                                            { key: "Box1", label: "Box 1: Wages, tips, other compensation", colSpan: 2 },
                                            { key: "Box2", label: "Box 2: Federal income tax withheld", colSpan: 2 },
                                            { key: "Box3", label: "Box 3: Social security wages", colSpan: 2 },
                                            { key: "Box4", label: "Box 4: Social security tax withheld", colSpan: 2 },
                                        ].map(item => {
                                            const data = getFieldData(item.key);
                                            return (
                                                <TaxField
                                                    key={item.key}
                                                    id={`field-${item.key}`}
                                                    label={item.label}
                                                    value={data.value}
                                                    isOverride={data.isOverride}
                                                    isEstimated={data.isEstimated}
                                                    onChange={(v) => handleFieldChange(item.key, v)}
                                                    onOverrideToggle={() => handleOverrideToggle(item.key)}
                                                    onEstimateToggle={() => handleEstimateToggle(item.key)}
                                                    className={cn("border-r", item.colSpan === 2 && "col-span-2")}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {instance.formType === "SchA" && (
                            <div className="grid grid-cols-12 gap-6">
                                <div className="col-span-12">
                                    <h2 className="text-2xl font-black mb-6 border-b-2 border-slate-900 dark:border-slate-100 pb-1 italic">Schedule A (Itemized Deductions)</h2>
                                    <div className="grid grid-cols-1 border-t border-l border-slate-200 dark:border-slate-800">
                                        {[
                                            { key: "Line1", num: "1", label: "Medical and dental expenses" },
                                            { key: "Line7", num: "7", label: "State and local taxes" },
                                            { key: "Line8", num: "8", label: "Home mortgage interest" },
                                            { key: "Line14", num: "14", label: "Gifts to charity" },
                                            { key: "Line17", num: "17", label: "TOTAL ITEMIZED DEDUCTIONS", font: "font-black" },
                                        ].map(item => {
                                            const data = getFieldData(item.key);
                                            return (
                                                <TaxField
                                                    key={item.key}
                                                    id={`field-${item.key}`}
                                                    lineNumber={item.num}
                                                    label={item.label}
                                                    value={data.value}
                                                    isOverride={data.isOverride}
                                                    isCalculated={data.isCalculated}
                                                    isEstimated={data.isEstimated}
                                                    onChange={(v) => handleFieldChange(item.key, v)}
                                                    onOverrideToggle={() => handleOverrideToggle(item.key)}
                                                    onEstimateToggle={() => handleEstimateToggle(item.key)}
                                                    className={cn("border-r", item.font)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {instance.formType === "SchC" && (
                            <div className="grid grid-cols-12 gap-6">
                                <div className="col-span-12">
                                    <div className="flex justify-between items-end mb-6 border-b-2 border-slate-900 dark:border-slate-100 pb-1">
                                        <h2 className="text-2xl font-black italic">Schedule C (Profit or Loss From Business)</h2>
                                        <span className="text-sm font-bold text-slate-500">Sole Proprietorship</span>
                                    </div>
                                    <section className="mb-6">
                                        <h3 className="text-xs font-black uppercase text-slate-500 mb-2">Part I: Income</h3>
                                        <div className="grid grid-cols-1 border-t border-l border-slate-200 dark:border-slate-800">
                                            {[
                                                { key: "Line1", num: "1", label: "Gross receipts or sales" },
                                                { key: "Line4", num: "4", label: "Cost of goods sold", font: "font-mono text-red-600" },
                                                { key: "Line7", num: "7", label: "GROSS INCOME", font: "font-black bg-slate-50/50" },
                                            ].map(item => {
                                                const data = getFieldData(item.key);
                                                return (
                                                    <TaxField
                                                        key={item.key}
                                                        id={`field-${item.key}`}
                                                        lineNumber={item.num}
                                                        label={item.label}
                                                        value={data.value}
                                                        isOverride={data.isOverride}
                                                        isCalculated={data.isCalculated}
                                                        isEstimated={data.isEstimated}
                                                        onChange={(v) => handleFieldChange(item.key, v)}
                                                        onOverrideToggle={() => handleOverrideToggle(item.key)}
                                                        onEstimateToggle={() => handleEstimateToggle(item.key)}
                                                        className={cn("border-r", item.font)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </section>
                                    <section>
                                        <h3 className="text-xs font-black uppercase text-slate-500 mb-2">Part II: Expenses</h3>
                                        <div className="grid grid-cols-2 border-t border-l border-slate-200 dark:border-slate-800">
                                            {[
                                                { key: "Line8", num: "8", label: "Advertising" },
                                                { key: "Line11", num: "11", label: "Contract labor" },
                                                { key: "Line16a", num: "16a", label: "Mortgage interest" },
                                                { key: "Line18", num: "18", label: "Office expense" },
                                                { key: "Line28", num: "28", label: "Total expenses", font: "bg-slate-50/50" },
                                                { key: "Line31", num: "31", label: "NET PROFIT OR (LOSS)", font: "col-span-2 font-black text-lg bg-blue-50/30", colSpan: 2 },
                                            ].map(item => {
                                                const data = getFieldData(item.key);
                                                return (
                                                    <TaxField
                                                        key={item.key}
                                                        id={`field-${item.key}`}
                                                        lineNumber={item.num}
                                                        label={item.label}
                                                        value={data.value}
                                                        isOverride={data.isOverride}
                                                        isCalculated={data.isCalculated}
                                                        isEstimated={data.isEstimated}
                                                        onChange={(v) => handleFieldChange(item.key, v)}
                                                        onOverrideToggle={() => handleOverrideToggle(item.key)}
                                                        onEstimateToggle={() => handleEstimateToggle(item.key)}
                                                        className={cn("border-r", item.font, item.colSpan === 2 && "col-span-2")}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Diagnostic Tray at bottom */}
            <div className="h-32 bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 flex flex-col">
                <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Diagnostics & Errors ({diagnostics?.length || 0})
                    </span>
                    <button className="text-[10px] font-bold text-blue-600 uppercase hover:underline">Clear All</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {diagnostics?.map((d: { _id: string; severity: string; fieldKey: string; message: string }) => (
                        <div key={d._id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer group transition-colors">
                            {d.severity === "Error" && <AlertCircle size={14} className="text-red-500" />}
                            {d.severity === "Warning" && <AlertCircle size={14} className="text-amber-500" />}
                            <span className="text-xs text-slate-700 dark:text-slate-300">
                                {d.message}
                                <button
                                    onClick={() => {
                                        const el = document.getElementById(`field-${d.fieldKey}`);
                                        if (el) {
                                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                                            (el.querySelector("input") as HTMLInputElement)?.focus();
                                        }
                                    }}
                                    className="ml-2 text-blue-600 invisible group-hover:visible underline"
                                >
                                    Go to Field
                                </button>
                            </span>
                        </div>
                    ))}
                    {(!diagnostics || diagnostics.length === 0) && (
                        <div className="p-4 text-center text-xs text-slate-400">No issues detected. Return is clean.</div>
                    )}
                </div>
            </div>

            {/* Hidden component for printing */}
            <Form1040Print fields={fields} taxpayerName="John Doe (Sample)" />
        </div>
    );
}

function SummaryPanel({ refundAmount }: { refundAmount: string }) {
    const amount = parseFloat(refundAmount) || 0;
    const isRefund = amount >= 0;

    return (
        <>
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 border border-blue-200 dark:border-blue-900 rounded-lg">
                <h3 className="text-xs font-black text-blue-800 dark:text-blue-300 uppercase mb-2 flex items-center gap-2">
                    <Info size={14} />
                    Field Diagnostic
                </h3>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-tight">
                    Blue fields are calculated. Pink fields are overrides (F8). Dotted lines represent estimated values (F3). Use Ctrl+E to jump to the next error.
                </p>
            </div>

            <div className={cn(
                "p-4 border rounded-lg transition-colors",
                isRefund
                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900"
                    : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900"
            )}>
                <h3 className={cn(
                    "text-xs font-black uppercase mb-3 text-center",
                    isRefund ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
                )}>
                    {isRefund ? "Federal Refund" : "Balance Due"}
                </h3>
                <div className={cn(
                    "text-4xl font-black tabular-nums tracking-tighter text-center",
                    isRefund ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"
                )}>
                    ${Math.abs(amount).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1 flex items-center justify-center gap-1">
                    <CheckCircle2 size={10} className={isRefund ? "text-green-600" : "text-red-600"} />
                    Live Calculation
                </div>
            </div>
        </>
    );
}


