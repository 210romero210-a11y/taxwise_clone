import { jest } from "@jest/globals";
import { calculateReturnDependencies } from "./calculations";
import { calculateStandardDeduction } from "../lib/taxMath/standardDeduction";
import { calculateFederalTax, calculateQBIDeduction } from "../lib/taxMath/taxCalculation";

describe("Tax Calculation Engine 2025", () => {
    let mockCtx: any;
    const returnId = "return123" as any;

    beforeEach(() => {
        const dbState: any = {
            returns: [
                { _id: returnId, name: "Test 2025", taxYear: 2025, status: "In Progress" }
            ],
            formInstances: [],
            fields: []
        };

        mockCtx = {
            db: {
                get: jest.fn(async (id: any) => {
                    if (id === returnId) return dbState.returns[0];
                    return dbState.formInstances.find((i: any) => i._id === id);
                }),
                query: jest.fn(() => ({
                    withIndex: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            collect: jest.fn(async () => dbState.fields.filter((f: any) => f.instanceId === "inst1040")), // Simplified
                        })),
                    })),
                    collect: jest.fn(async () => dbState.formInstances),
                })),
                patch: jest.fn(async (id: any, data: any) => {
                    const field = dbState.fields.find((f: any) => f._id === id);
                    if (field) Object.assign(field, data);
                }),
                insert: jest.fn(async (table: string, data: any) => {
                    const id = `id_${Math.random()}`;
                    if (table === "fields") {
                        dbState.fields.push({ _id: id, ...data });
                    }
                    return id;
                }),
            },
        };

        // Redefine query more accurately for the test
        mockCtx.db.query = jest.fn((table: string) => ({
            withIndex: jest.fn((index: string, filterFn: any) => ({
                eq: jest.fn((key: string, val: any) => ({
                    collect: jest.fn(async () => {
                        if (table === "formInstances") return dbState.formInstances;
                        if (table === "fields") return dbState.fields.filter((f: any) => f.instanceId === val);
                        return [];
                    }),
                    filter: jest.fn(() => ({
                        first: jest.fn(async () => {
                            // This is getting complex, let's simplify in the actual engine call if needed
                            // but for now let's try to match what calculateReturnDependencies expects
                            return dbState.fields.find((f: any) => f.instanceId === val);
                        })
                    }))
                }))
            })),
            collect: jest.fn(async () => {
                if (table === "formInstances") return dbState.formInstances;
                return [];
            })
        })) as any;
    });

    test("calculates standard deduction for Single status in 2025", () => {
        const deduction = calculateStandardDeduction("Single", 2025);
        expect(deduction).toBe(15000);
    });

    test("calculates standard deduction for MFJ with Over 65 in 2025", () => {
        const deduction = calculateStandardDeduction("Married Filing Jointly", 2025, false, true);
        expect(deduction).toBe(31600); // 30000 + 1600
    });

    test("QBI deduction is 20% of QBI cap at 20% taxable income", () => {
        const qbi = 10000;
        const taxable = 50000;
        const deduction = calculateQBIDeduction(qbi, taxable);
        expect(deduction).toBe(2000);
    });

    test("QBI deduction cap works", () => {
        const qbi = 100000;
        const taxable = 50000;
        const deduction = calculateQBIDeduction(qbi, taxable);
        expect(deduction).toBe(10000); // 20% of 50k
    });
});
