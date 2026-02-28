"use client";

import { Sidebar } from "@/components/Sidebar";
import { MainViewport } from "@/components/MainViewport";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useState } from "react";
import { Id } from "../convex/_generated/dataModel";

export default function Home() {
  const returns = useQuery(api.returns.listReturns);
  const createReturn = useMutation(api.returns.createReturn);
  const instances = useQuery(api.formInstances.getInstancesForReturn,
    returns && returns.length > 0 ? { returnId: returns[0]._id } : "skip" as any
  );
  const createInstance = useMutation(api.formInstances.createInstance);

  const [activeReturnId, setActiveReturnId] = useState<Id<"returns"> | null>(null);
  const [activeInstanceId, setActiveInstanceId] = useState<Id<"formInstances"> | null>(null);

  // Query fields for the active 1040 instance to get the live refund amount
  const activeInstanceFields = useQuery(
    api.fields.getFieldsForInstance,
    activeInstanceId ? { instanceId: activeInstanceId } : "skip" as any
  );

  const refundField = activeInstanceFields?.find(
    (f: { fieldKey: string; value: any }) => f.fieldKey === "1040_RefundAmount"
  );
  const refundValue = refundField?.value;
  const liveRefundDisplay = (() => {
    if (activeInstanceFields === undefined) return "Live Refund: —";
    if (refundValue == null) return "Live Refund: $0.00";
    const amount = typeof refundValue === "number" ? refundValue : parseFloat(refundValue);
    if (isNaN(amount)) return "Live Refund: $0.00";
    return "Live Refund: " + new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  })();

  // 1. Auto-create or select a return
  useEffect(() => {
    if (returns !== undefined) {
      if (returns.length > 0) {
        if (!activeReturnId) setActiveReturnId(returns[0]._id);
      } else {
        createReturn({ name: "Doe, John", taxYear: 2023 }).then((id) => {
          setActiveReturnId(id);
        });
      }
    }
  }, [returns, activeReturnId, createReturn]);

  // 2. Ensure at least a 1040 instance exists and is selected
  useEffect(() => {
    if (activeReturnId && instances !== undefined) {
      const main1040 = instances.find((i: { formType: string }) => i.formType === "1040");
      if (main1040) {
        if (!activeInstanceId) setActiveInstanceId(main1040._id);
      } else {
        createInstance({
          returnId: activeReturnId,
          formType: "1040",
          instanceName: "Form 1040",
        }).then((id) => {
          setActiveInstanceId(id);
        });
      }
    }
  }, [activeReturnId, instances, activeInstanceId, createInstance]);

  const activeReturn = returns?.find((r: { _id: Id<"returns"> }) => r._id === activeReturnId);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {activeReturnId && (
        <Sidebar
          returnId={activeReturnId}
          activeInstanceId={activeInstanceId}
          onSelectInstance={setActiveInstanceId}
        />
      )}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navigation / Toolbar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 p-3 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="font-bold text-xl tracking-tight text-blue-600 dark:text-blue-400">Phoenix Tax</div>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700"></div>
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Return: <span className="text-slate-900 dark:text-slate-100">
                {activeReturn ? `${activeReturn.name} (${activeReturn.taxYear})` : "Loading..."}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-200 dark:border-green-800 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {liveRefundDisplay}
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors shadow-sm">
              Save Return
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        {activeInstanceId ? (
          <MainViewport instanceId={activeInstanceId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Initializing Form Environment...
          </div>
        )}
      </div>
    </div>
  );
}

