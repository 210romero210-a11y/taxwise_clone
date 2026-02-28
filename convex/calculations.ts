import { v } from "convex/values";
import { internalMutation, MutationCtx } from "./_generated/server";
import { calculateStandardDeduction, FilingStatus } from "../lib/taxMath/standardDeduction";
import { calculateFederalTax, calculateChildTaxCredit, calculateQBIDeduction } from "../lib/taxMath/taxCalculation";
import { calculateSETax } from "../lib/taxMath/seTax";
import { Id } from "./_generated/dataModel";

// Helper function that can be called directly within a mutation
export async function calculateReturnDependencies(ctx: MutationCtx, returnId: Id<"returns">) {
    // 1. Fetch return metadata
    const returnData = await ctx.db.get(returnId);
    if (!returnData) return;
    const taxYear = returnData.taxYear;

    // 2. Fetch all form instances for this return
    const instances = await ctx.db
        .query("formInstances")
        .withIndex("by_return", (q) => q.eq("returnId", returnId))
        .collect();

    // 2. Fetch all fields for all instances
    const allFields: (any & { formType: string })[] = [];
    for (const inst of instances) {
        const fields = await ctx.db
            .query("fields")
            .withIndex("by_instance", (q) => q.eq("instanceId", inst._id))
            .collect();
        allFields.push(...fields.map(f => ({ ...f, formType: inst.formType })));
    }

    // 3. Find the primary 1040 instance
    let main1040 = instances.find(i => i.formType === "1040");
    if (!main1040) {
        // Fallback: create if missing? For now, we expect it to exist.
        // Return early if no 1040 to update
        return;
    }

    // Map for easy lookup [instanceId_fieldKey]
    const fieldMap = new Map(allFields.map((f) => [`${f.instanceId}_${f.fieldKey}`, f]));

    // Helper to sum a field across all instances of a form type (Flow-Through)
    const getSum = (formType: string, fieldKey: string): number => {
        return allFields
            .filter(f => f.formType === formType && f.fieldKey === fieldKey)
            .reduce((sum, f) => {
                const val = f.value;
                const num = typeof val === "number" ? val : parseFloat(val);
                return sum + (isNaN(num) ? 0 : num);
            }, 0);
    };

    // Helper to get value from primary 1040
    const get1040Value = (key: string): number => {
        const f = fieldMap.get(`${main1040!._id}_${key}`);
        const val = f?.value;
        if (typeof val === "number") return val;
        if (typeof val === "string") {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    const get1040Bool = (key: string): boolean => {
        const f = fieldMap.get(`${main1040!._id}_${key}`);
        return f?.value === true || f?.value === "true";
    };

    const get1040String = (key: string, defaultValue: string): string => {
        const f = fieldMap.get(`${main1040!._id}_${key}`);
        return typeof f?.value === "string" ? f.value : defaultValue;
    };

    // Helper to set primary 1040 calculated values
    const set1040Value = async (key: string, value: number | string | boolean) => {
        const compositeKey = `${main1040!._id}_${key}`;
        const existingField = fieldMap.get(compositeKey);

        if (existingField) {
            if (existingField.isManualOverride) return;
            if (existingField.value !== value) {
                await ctx.db.patch(existingField._id, {
                    value,
                    isCalculated: true
                });
                existingField.value = value;
            }
        } else {
            const newId = await ctx.db.insert("fields", {
                instanceId: main1040!._id,
                fieldKey: key,
                value,
                isManualOverride: false,
                isCalculated: true,
            });
            fieldMap.set(compositeKey, { _id: newId, instanceId: main1040!._id, fieldKey: key, value, isManualOverride: false, isCalculated: true } as any);
        }
    };

    // --- TAX MATH DEPENDENCIES (2023 LOGIC) ---

    // 1. Inputs from 1040 Metadata
    const status = get1040String("FilingStatus", "Single") as FilingStatus;
    const isBlind = get1040Bool("IsBlind");
    const isOver65 = get1040Bool("IsOver65");
    const numChildren = get1040Value("NumChildren");

    // 2. FLOW-THROUGH: Sum all W-2 Box 1 -> 1040 Line 1z
    const totalWages = getSum("W2", "Box1");
    const totalW2Withholding = getSum("W2", "Box2");
    await set1040Value("1040_Line1z", totalWages);

    // 3. Schedule C Aggregation & SE Tax
    const schCProfit = getSum("SchC", "Line31");
    const { totalTax: seTax, deduction: seDeduction } = calculateSETax(schCProfit, taxYear);
    await set1040Value("1040_Line23", seTax);

    // 4. Total Income
    const taxableInterest = get1040Value("1040_Line2b");
    const ordinaryDividends = get1040Value("1040_Line3b");
    const capitalGain = get1040Value("1040_Line7");
    const otherIncome = get1040Value("1040_Line8"); // This could ideally be flow-through too

    const totalIncome = totalWages + taxableInterest + ordinaryDividends + capitalGain + otherIncome + schCProfit;
    await set1040Value("1040_Line9", totalIncome);

    // 5. Adjusted Gross Income (AGI)
    // AGI = Total Income - Adjustments (including 1/2 of SE Tax)
    const adjustments = get1040Value("1040_Line10") + seDeduction;
    const agi = Math.max(0, totalIncome - adjustments);
    await set1040Value("1040_Line11", agi);

    // 6. Deductions
    const itemizedTotal = getSum("SchA", "Line17");
    const standardDeductionVal = calculateStandardDeduction(status, taxYear, isBlind, isOver65);
    const deductionToUse = Math.max(standardDeductionVal, itemizedTotal);
    await set1040Value("1040_Line12", deductionToUse);

    // 7. QBI Deduction (2025+)
    let qbiDeduction = 0;
    if (taxYear >= 2025) {
        // Simple: Sch C profit is QBI
        qbiDeduction = calculateQBIDeduction(schCProfit, agi - deductionToUse);
        await set1040Value("1040_Line13", qbiDeduction);
    }

    // 8. Taxable Income
    const taxableIncome = Math.max(0, agi - deductionToUse - qbiDeduction);
    await set1040Value("1040_Line15", taxableIncome);

    // 9. Total Tax Liability
    const incomeTaxVal = calculateFederalTax(taxableIncome, status, taxYear);
    const childTaxCreditVal = calculateChildTaxCredit(numChildren, agi, status);

    await set1040Value("1040_Line16", incomeTaxVal);
    await set1040Value("1040_Line19", childTaxCreditVal);

    // Line 24: Total Tax = (Income Tax - Credits) + SE Tax
    const finalTaxLiability = Math.max(0, incomeTaxVal - childTaxCreditVal) + seTax;
    await set1040Value("1040_Line24", finalTaxLiability);

    // Payments
    await set1040Value("1040_Line25a", totalW2Withholding);

    // 10. Line 22: Sum of tax and credits
    const totalTaxAfterCredit = Math.max(0, incomeTaxVal - childTaxCreditVal);
    await set1040Value("1040_Line22", totalTaxAfterCredit);

    // Live Refund Monitor Signal (for UI header)
    const totalPayments = totalW2Withholding;
    const refundOrBalance = totalPayments - finalTaxLiability;
    await set1040Value("1040_RefundAmount", refundOrBalance);
}

// Internal mutation exposing the helper
export const recalculateReturn = internalMutation({
    args: { returnId: v.id("returns") },
    handler: async (ctx, args) => {
        await calculateReturnDependencies(ctx, args.returnId);
    },
});

