"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
// Stub auth hook - replace with actual auth provider in production
const useAuth = () => ({ userId: "stub-user-id" });
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  Users,
  Upload,
  Download,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ChevronRight,
  X,
  Loader2,
  Eye,
  Edit,
  Trash2,
  Calendar,
} from "lucide-react";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface K1Partner {
  _id: Id<"k1Records">;
  returnId: Id<"returns">;
  partnerId: string;
  ein: string;
  recipientName: string;
  recipientTin: string;
  k1Data: K1Data;
  syncStatus: "pending" | "synced" | "error";
  syncedAt?: number;
  createdAt: number;
}

interface K1Data {
  // Income items (Box 1-7)
  ordinaryBusinessIncome?: number;
  qualifiedBusinessIncome?: number;
  section199ADeduction?: number;
  
  // Box 8 - Specific Deductions
  charitableContributions?: number;
  investmentInterest?: number;
  section179Deduction?: number;
  otherDeductions?: number;
  
  // Box 9 - Tax Exempt Income
  taxExemptInterest?: number;
  exemptQualifiedDividends?: number;
  
  // Box 10 - Credits
  foreignTaxCredit?: number;
  otherCredits?: number;
  
  // Box 11 - Other Items
  ordinaryDividends?: number;
  qualifiedDividends?: number;
  section409ATaxDeferral?: number;
  otherItems?: number;
  
  // Box 12 - Supplemental Information
  section199AQualifiedBusinessIncome?: number;
  section199AQualifiedProperty?: number;
  section199AWages?: number;
  
  // Additional K-1 fields
  selfEmploymentEarnings?: number;
  selfEmploymentDeductions?: number;
  healthInsurance?: number;
  sepSIMPLE?: number;
  qualifiedPlanExpenses?: number;
  
  // Investment items
  interestIncome?: number;
  shortTermCapitalGains?: number;
  longTermCapitalGains?: number;
  section1231Gains?: number;
  section1231Losses?: number;
  
  // Rental real estate
  rentalRealEstateIncome?: number;
  rentalRealEstateExpenses?: number;
  
  // Other income/expenses
  otherIncome?: number;
  otherExpenses?: number;
}

interface K1WizardProps {
  returnId: Id<"returns">;
  entityType: "1065" | "1120S";
  onComplete?: () => void;
  onCancel?: () => void;
}

// =============================================================================
// K-1 FIELD LABELS
// =============================================================================

const K1_FIELD_LABELS: Record<string, string> = {
  ordinaryBusinessIncome: "Ordinary Business Income (Box 1)",
  qualifiedBusinessIncome: "Qualified Business Income (Box 2)",
  section199ADeduction: "Section 199A Deduction (Box 3)",
  charitableContributions: "Charitable Contributions (Box 5a)",
  investmentInterest: "Investment Interest Expense (Box 5c)",
  section179Deduction: "Section 179 Deduction (Box 5d)",
  otherDeductions: "Other Deductions (Box 5)",
  taxExemptInterest: "Tax Exempt Interest (Box 6)",
  exemptQualifiedDividends: "Exempt Qualified Dividends (Box 6)",
  foreignTaxCredit: "Foreign Tax Credit (Box 6)",
  otherCredits: "Other Credits (Box 6)",
  ordinaryDividends: "Ordinary Dividends (Box 4a)",
  qualifiedDividends: "Qualified Dividends (Box 4b)",
  section199AQualifiedBusinessIncome: "Section 199A QBI (Box 11)",
  section199AWages: "Section 199A Wages (Box 11)",
  section199AQualifiedProperty: "Section 199A Qualified Property (Box 11)",
  selfEmploymentEarnings: "Self-Employment Earnings",
  selfEmploymentDeductions: "Self-Employment Deductions",
  healthInsurance: "Health Insurance Deduction",
  sepSIMPLE: "SEP/SIMPLE Deduction",
  qualifiedPlanExpenses: "Qualified Plan Expenses",
  interestIncome: "Interest Income",
  shortTermCapitalGains: "Short-Term Capital Gains",
  longTermCapitalGains: "Long-Term Capital Gains",
  rentalRealEstateIncome: "Rental Real Estate Income",
  rentalRealEstateExpenses: "Rental Real Estate Expenses",
  otherIncome: "Other Income",
  otherExpenses: "Other Expenses",
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function K1Wizard({ returnId, entityType, onComplete, onCancel }: K1WizardProps) {
  // Get authenticated user
  const { userId } = useAuth();
  
  // State
  const [activeTab, setActiveTab] = useState<"list" | "import" | "export" | "audit">("list");
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showK1Detail, setShowK1Detail] = useState<K1Partner | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "mapping">("upload");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  
  // Export state
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv">("pdf");
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Queries
  const k1Records = useQuery(api.k1Records.getK1RecordsByReturn, { returnId }) || [];
  const auditLogs = useQuery(api.k1Records.getK1AuditTrail, { returnId });
  
  // Mutations - use any for internal mutations that aren't exposed publicly
  // In production, expose these as public mutations in k1Records.ts
  const updateK1Record = useMutation(api.k1Records.updateK1Record as any);
  const createK1Record = useMutation(api.k1Records.createK1Record as any);
  const deleteK1Record = useMutation(api.k1Records.deleteK1Record as any);
  
  // Filter partners based on search and status
  // Cast to any to handle type mismatch between schema string and literal type
  const filteredPartners = (k1Records as any[]).filter((partner: any) => {
    const matchesSearch = searchQuery === "" || 
      partner.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.recipientTin.includes(searchQuery);
    
    const matchesStatus = statusFilter === "all" || partner.syncStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  // Get pending count
  const pendingCount = (k1Records as any[]).filter((p: any) => p.syncStatus === "pending").length;
  const syncedCount = (k1Records as any[]).filter((p: any) => p.syncStatus === "synced").length;
  const errorCount = (k1Records as any[]).filter((p: any) => p.syncStatus === "error").length;
  
  // Format currency
  const formatCurrency = (value?: number): string => {
    if (value === undefined || value === null) return "-";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };
  
  // Format date
  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Get TIN formatted
  const formatTIN = (tin: string): string => {
    if (!tin || tin.length < 4) return tin;
    return `***-**-${tin.slice(-4)}`;
  };
  
  // Handle single K-1 sync - stub for now
  const handleSyncK1 = async (k1Id: Id<"k1Records">) => {
    // Internal mutations aren't available in frontend - would need to expose as public
    alert("K-1 sync is not available in this version. Please use the Convex dashboard.");
  };
  
  // Handle bulk sync all pending - stub for now
  const handleSyncAllPending = async () => {
    // Internal mutations aren't available in frontend - would need to expose as public
    alert("Bulk K-1 sync is not available in this version. Please use the Convex dashboard.");
  };
  
  // Handle file upload and parsing
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    
    // Parse CSV/Excel - simplified for demo
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const parsed = lines.slice(1).filter(line => line.trim()).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });
      return row;
    });
    
    setParsedData(parsed);
    setImportStep("preview");
  };
  
  // Handle import confirmation
  const handleConfirmImport = async () => {
    for (const row of parsedData) {
      const k1Data: K1Data = {};
      
      // Map columns to K-1 fields
      Object.entries(columnMapping).forEach(([csvColumn, k1Field]) => {
        const value = row[csvColumn];
        if (value && !isNaN(parseFloat(value))) {
          (k1Data as any)[k1Field] = parseFloat(value);
        }
      });
      
      await createK1Record({
        returnId,
        partnerId: row.partnerId || `partner_${Date.now()}`,
        ein: row.ein || "",
        recipientName: row.recipientName || "Unknown",
        recipientTin: row.recipientTin || "",
        k1Data,
        syncStatus: "pending",
      });
    }
    
    setImportStep("upload");
    setImportFile(null);
    setParsedData([]);
    setColumnMapping({});
    setActiveTab("list");
  };
  
  // Handle export
  const handleExport = () => {
    const partnersToExport = (k1Records as any[]).filter((p: any) => 
      selectedPartners.has(p._id)
    );
    
    if (exportFormat === "csv") {
      const csv = generateCSV(partnersToExport);
      downloadCSV(csv, `K1_Export_${entityType}.csv`);
    } else {
      // PDF generation would go here
      alert("PDF export would generate printable K-1 forms");
    }
  };
  
  // Generate CSV
  const generateCSV = (partners: K1Partner[]): string => {
    const headers = [
      "Recipient Name",
      "TIN",
      "EIN",
      "Ordinary Business Income",
      "Qualified Business Income",
      "Section 199A Deduction",
      "Charitable Contributions",
      "Investment Interest",
      "Section 179 Deduction",
      "Ordinary Dividends",
      "Qualified Dividends",
      "Foreign Tax Credit",
      "Sync Status",
    ];
    
    const rows = partners.map(p => [
      p.recipientName,
      p.recipientTin,
      p.ein,
      p.k1Data.ordinaryBusinessIncome?.toString() || "",
      p.k1Data.qualifiedBusinessIncome?.toString() || "",
      p.k1Data.section199ADeduction?.toString() || "",
      p.k1Data.charitableContributions?.toString() || "",
      p.k1Data.investmentInterest?.toString() || "",
      p.k1Data.section179Deduction?.toString() || "",
      p.k1Data.ordinaryDividends?.toString() || "",
      p.k1Data.qualifiedDividends?.toString() || "",
      p.k1Data.foreignTaxCredit?.toString() || "",
      p.syncStatus,
    ]);
    
    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  };
  
  // Download CSV
  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Toggle partner selection for export
  const togglePartnerSelection = (partnerId: string) => {
    const newSelected = new Set(selectedPartners);
    if (newSelected.has(partnerId)) {
      newSelected.delete(partnerId);
    } else {
      newSelected.add(partnerId);
    }
    setSelectedPartners(newSelected);
  };
  
  // Select all partners for export
  const selectAllPartners = () => {
    if (selectedPartners.size === filteredPartners.length) {
      setSelectedPartners(new Set());
    } else {
      setSelectedPartners(new Set((filteredPartners as any[]).map((p: any) => p._id)));
    }
  };
  
  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "synced":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 size={12} />
            Synced
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock size={12} />
            Pending
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle size={12} />
            Error
          </span>
        );
      default:
        return null;
    }
  };
  
  // Render K-1 detail modal
  const renderK1Detail = () => {
    if (!showK1Detail) return null;
    
    const k1 = showK1Detail;
    const k1Data = k1.k1Data as K1Data;
    
    const incomeItems = [
      { key: "ordinaryBusinessIncome", value: k1Data.ordinaryBusinessIncome },
      { key: "qualifiedBusinessIncome", value: k1Data.qualifiedBusinessIncome },
      { key: "section199ADeduction", value: k1Data.section199ADeduction },
      { key: "interestIncome", value: k1Data.interestIncome },
      { key: "shortTermCapitalGains", value: k1Data.shortTermCapitalGains },
      { key: "longTermCapitalGains", value: k1Data.longTermCapitalGains },
      { key: "rentalRealEstateIncome", value: k1Data.rentalRealEstateIncome },
      { key: "otherIncome", value: k1Data.otherIncome },
    ].filter(item => item.value !== undefined);
    
    const deductionItems = [
      { key: "charitableContributions", value: k1Data.charitableContributions },
      { key: "investmentInterest", value: k1Data.investmentInterest },
      { key: "section179Deduction", value: k1Data.section179Deduction },
      { key: "otherDeductions", value: k1Data.otherDeductions },
      { key: "selfEmploymentDeductions", value: k1Data.selfEmploymentDeductions },
      { key: "rentalRealEstateExpenses", value: k1Data.rentalRealEstateExpenses },
      { key: "otherExpenses", value: k1Data.otherExpenses },
    ].filter(item => item.value !== undefined);
    
    const dividendItems = [
      { key: "ordinaryDividends", value: k1Data.ordinaryDividends },
      { key: "qualifiedDividends", value: k1Data.qualifiedDividends },
    ].filter(item => item.value !== undefined);
    
    const creditItems = [
      { key: "foreignTaxCredit", value: k1Data.foreignTaxCredit },
      { key: "otherCredits", value: k1Data.otherCredits },
    ].filter(item => item.value !== undefined);
    
    const seItems = [
      { key: "selfEmploymentEarnings", value: k1Data.selfEmploymentEarnings },
      { key: "healthInsurance", value: k1Data.healthInsurance },
      { key: "sepSIMPLE", value: k1Data.sepSIMPLE },
      { key: "qualifiedPlanExpenses", value: k1Data.qualifiedPlanExpenses },
    ].filter(item => item.value !== undefined);
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                K-1 Details: {k1.recipientName}
              </h2>
              <p className="text-sm text-slate-500">
                TIN: {formatTIN(k1.recipientTin)} | EIN: {k1.ein || "N/A"}
              </p>
            </div>
            <button
              onClick={() => setShowK1Detail(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">Status:</span>
              {renderStatusBadge(k1.syncStatus)}
              {k1.syncedAt && (
                <span className="text-sm text-slate-500">
                  Synced: {formatDate(k1.syncedAt)}
                </span>
              )}
            </div>
            
            {/* Income Section */}
            {incomeItems.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Income (Boxes 1-3)
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 grid grid-cols-2 gap-4">
                  {incomeItems.map(item => (
                    <div key={item.key} className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {K1_FIELD_LABELS[item.key] || item.key}
                      </span>
                      <span className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Dividends Section */}
            {dividendItems.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Dividends (Box 4)
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 grid grid-cols-2 gap-4">
                  {dividendItems.map(item => (
                    <div key={item.key} className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {K1_FIELD_LABELS[item.key] || item.key}
                      </span>
                      <span className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Deductions Section */}
            {deductionItems.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Deductions (Box 5)
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 grid grid-cols-2 gap-4">
                  {deductionItems.map(item => (
                    <div key={item.key} className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {K1_FIELD_LABELS[item.key] || item.key}
                      </span>
                      <span className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Credits Section */}
            {creditItems.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Credits (Box 6)
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 grid grid-cols-2 gap-4">
                  {creditItems.map(item => (
                    <div key={item.key} className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {K1_FIELD_LABELS[item.key] || item.key}
                      </span>
                      <span className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Self-Employment Section */}
            {seItems.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Self-Employment
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 grid grid-cols-2 gap-4">
                  {seItems.map(item => (
                    <div key={item.key} className="flex justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {K1_FIELD_LABELS[item.key] || item.key}
                      </span>
                      <span className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* No data message */}
            {incomeItems.length === 0 && deductionItems.length === 0 && dividendItems.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No K-1 data available for this partner
              </div>
            )}
          </div>
          
          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end gap-3">
            {k1.syncStatus === "pending" && (
              <button
                onClick={() => {
                  handleSyncK1(k1._id);
                  setShowK1Detail(null);
                }}
                disabled={syncStatus === "syncing"}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {syncStatus === "syncing" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Sync to 1040
              </button>
            )}
            <button
              onClick={() => setShowK1Detail(null)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Tab configuration
  const tabs = [
    { id: "list" as const, label: "Partner List", icon: Users, count: k1Records.length },
    { id: "import" as const, label: "Import K-1", icon: Upload },
    { id: "export" as const, label: "Export K-1", icon: Download },
    { id: "audit" as const, label: "Audit Trail", icon: FileText },
  ];
  
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              K-1 Wizard
            </h2>
            <p className="text-sm text-slate-500">
              {entityType === "1065" ? "Partnership (Form 1065)" : "S-Corporation (Form 1120S)"} - K-1 Pass-Through Management
            </p>
          </div>
          
          {/* Status Summary */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-slate-600 dark:text-slate-400">{pendingCount} Pending</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-slate-600 dark:text-slate-400">{syncedCount} Synced</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-600 dark:text-slate-400">{errorCount} Error</span>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {/* TAB 1: PARTNER LIST */}
        {activeTab === "list" && (
          <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-900 rounded-t-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search partners..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
                
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="synced">Synced</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                
                {/* Bulk Sync Button */}
                <button
                  onClick={handleSyncAllPending}
                  disabled={pendingCount === 0 || syncStatus === "syncing"}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    pendingCount > 0
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed",
                    syncStatus === "syncing" && "opacity-50"
                  )}
                >
                  {syncStatus === "syncing" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Sync All Pending ({pendingCount})
                </button>
              </div>
            </div>
            
            {/* Table */}
            <div className="flex-1 bg-white dark:bg-slate-900 border border-t-0 border-slate-200 dark:border-slate-700 overflow-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Partner Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      TIN
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      EIN
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Ordinary Income
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredPartners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        {searchQuery || statusFilter !== "all" 
                          ? "No partners match your search criteria"
                          : "No K-1 records found for this return"}
                      </td>
                    </tr>
                  ) : (
                    (filteredPartners as any[]).map((partner: any) => (
                      <tr 
                        key={partner._id}
                        className={cn(
                          "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                          selectedPartner === partner._id && "bg-blue-50 dark:bg-blue-900/20"
                        )}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {partner.recipientName}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                            {formatTIN(partner.recipientTin)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                            {partner.ein || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                            {formatCurrency(partner.k1Data?.ordinaryBusinessIncome)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {renderStatusBadge(partner.syncStatus)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowK1Detail(partner)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="View K-1 Details"
                            >
                              <Eye size={16} />
                            </button>
                            {partner.syncStatus === "pending" && (
                              <button
                                onClick={() => handleSyncK1(partner._id)}
                                disabled={syncStatus === "syncing"}
                                className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                                title="Sync to 1040"
                              >
                                <RefreshCw size={16} />
                              </button>
                            )}
                            <button
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors"
                              title="Edit K-1"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this K-1 record?")) {
                                  deleteK1Record({ id: partner._id });
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Delete K-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* TAB 2: IMPORT K-1 */}
        {activeTab === "import" && (
          <div className="h-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            {importStep === "upload" && (
              <div className="max-w-xl mx-auto">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
                  Import K-1 Data
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Upload a CSV or Excel file containing K-1 data. The file should have columns for partner name, TIN, and K-1 amounts.
                </p>
                
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                >
                  <Upload size={48} className="mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600 dark:text-slate-400 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-slate-500">
                    CSV or Excel files (.csv, .xlsx)
                  </p>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">
                    Expected CSV Format
                  </h4>
                  <pre className="text-xs text-blue-700 dark:text-blue-400 overflow-x-auto">
{`recipientName,recipientTin,ein,ordinaryBusinessIncome,charitableContributions,...
John Smith,123-45-6789,12-3456789,75000,2500,...`}
                  </pre>
                </div>
              </div>
            )}
            
            {importStep === "preview" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      Preview Import Data
                    </h3>
                    <p className="text-sm text-slate-500">
                      {parsedData.length} records found in {importFile?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setImportStep("upload");
                        setImportFile(null);
                        setParsedData([]);
                      }}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Confirm Import
                    </button>
                  </div>
                </div>
                
                <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                      <tr>
                        {parsedData.length > 0 && Object.keys(parsedData[0]).map(key => (
                          <th key={key} className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {parsedData.slice(0, 10).map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((value: any, vidx) => (
                            <td key={vidx} className="px-3 py-2 text-slate-600 dark:text-slate-400">
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {parsedData.length > 10 && (
                  <p className="text-sm text-slate-500 mt-2">
                    Showing first 10 of {parsedData.length} records
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* TAB 3: EXPORT K-1 */}
        {activeTab === "export" && (
          <div className="h-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
              Export K-1 Data
            </h3>
            
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setExportFormat("pdf")}
                className={cn(
                  "flex-1 p-4 rounded-lg border-2 transition-colors",
                  exportFormat === "pdf"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                )}
              >
                <FileText size={24} className="mx-auto mb-2 text-slate-600 dark:text-slate-400" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">PDF Forms</p>
                <p className="text-xs text-slate-500">Printable K-1 forms</p>
              </button>
              
              <button
                onClick={() => setExportFormat("csv")}
                className={cn(
                  "flex-1 p-4 rounded-lg border-2 transition-colors",
                  exportFormat === "csv"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                )}
              >
                <Download size={24} className="mx-auto mb-2 text-slate-600 dark:text-slate-400" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">CSV Export</p>
                <p className="text-xs text-slate-500">Spreadsheet data</p>
              </button>
            </div>
            
            {/* Partner Selection */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Select Partners
                </h4>
                <button
                  onClick={selectAllPartners}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {selectedPartners.size === filteredPartners.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg max-h-64 overflow-y-auto">
                {(filteredPartners as any[]).map((partner: any) => (
                  <label
                    key={partner._id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPartners.has(partner._id)}
                      onChange={() => togglePartnerSelection(partner._id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                      {partner.recipientName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatTIN(partner.recipientTin)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={selectedPartners.size === 0}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors",
                selectedPartners.size > 0
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
            >
              <Download size={18} />
              Export {selectedPartners.size} K-1 {selectedPartners.size === 1 ? "Record" : "Records"}
            </button>
          </div>
        )}
        
        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === "audit" && (
          <div className="h-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
              K-1 Audit Trail
            </h3>
            
            {/* Date Filter */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
            
            {/* K-1 Records Summary */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                K-1 Records Summary
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {k1Records.length}
                  </div>
                  <div className="text-sm text-slate-500">Total Records</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {syncedCount}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-500">Synced</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                    {pendingCount}
                  </div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-500">Pending</div>
                </div>
              </div>
            </div>
            
            {/* Sync History */}
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                Sync History
              </h4>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-200 dark:divide-slate-700">
                {auditLogs?.syncAuditLogs && auditLogs.syncAuditLogs.length > 0 ? (
                  auditLogs.syncAuditLogs.slice(0, 20).map((log: any, idx: number) => (
                    <div key={idx} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.action === "K-1 Sync" ? (
                            <RefreshCw size={14} className="text-green-500" />
                          ) : log.action === "K-1 Sync Error" ? (
                            <AlertCircle size={14} className="text-red-500" />
                          ) : (
                            <Clock size={14} className="text-yellow-500" />
                          )}
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {log.action}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatDate(log.timestamp)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Source: {log.source || "unknown"} | User: {log.userId}
                      </div>
                      {log.newValue && (
                        <pre className="mt-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.newValue, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-slate-500">
                    No sync history available
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-4 flex justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onComplete}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Complete
        </button>
      </div>
      
      {/* K-1 Detail Modal */}
      {renderK1Detail()}
    </div>
  );
}

export default K1Wizard;
