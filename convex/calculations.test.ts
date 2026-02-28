import { calculateReturnDependencies } from "./calculations";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

describe("Dependency Engine (Direct Mock)", () => {
    let mockFields: any[] = [];
    let mockCtx: any;

    beforeEach(() => {
        mockFields = [];
        mockCtx = {
            db: {
                query: jest.fn().mockReturnThis(),
                withIndex: jest.fn().mockReturnThis(),
                collect: jest.fn().mockImplementation(async () => mockFields),
                patch: jest.fn().mockImplementation(async (id: unknown, updates: unknown) => {
                    const idx = mockFields.findIndex(f => f._id === id);
                    if (idx !== -1) {
                        mockFields[idx] = { ...mockFields[idx], ...(updates as object) };
                    }
                }),
                insert: jest.fn().mockImplementation(async (_table: unknown, data: unknown) => {
                    mockFields.push({ ...(data as object), _id: "new_id_" + Math.random() });
                }),
            }
        };
    });

    it("updates 1040_Line1z when W2_Box1 changes", async () => {
        // Setup initial W-2 Box 1 field
        mockFields.push({
            _id: "field1",
            returnId: "test_return",
            fieldKey: "W2_Box1",
            value: 50000,
            isManualOverride: false
        });
        await calculateReturnDependencies(mockCtx, "test_return" as any);

        // Should have inserted 1040_Line1z
        const line1z = mockFields.find(f => f.fieldKey === "1040_Line1z");
        expect(line1z).toBeDefined();
        expect(line1z.value).toBe(50000);
        expect(line1z.isManualOverride).toBe(false);
        expect(mockCtx.db.insert).toHaveBeenCalledWith("fields", expect.objectContaining({
            fieldKey: "1040_Line1z",
            value: 50000
        }));
    });

    it("respects manual overrides on calculated fields", async () => {
        mockFields.push({
            _id: "field1",
            returnId: "test_return",
            fieldKey: "W2_Box1",
            value: 60000,
            isManualOverride: false
        });
        mockFields.push({
            _id: "field2",
            returnId: "test_return",
            fieldKey: "1040_Line1z",
            value: 99999,
            isManualOverride: true // Overridden!
        });
        await calculateReturnDependencies(mockCtx, "test_return" as any);

        // Should NOT have patched or inserted
        const line1z = mockFields.find(f => f.fieldKey === "1040_Line1z");
        expect(line1z.value).toBe(99999);
        expect(mockCtx.db.patch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ value: 60000 }));
        expect(mockCtx.db.insert).not.toHaveBeenCalledWith("fields", expect.objectContaining({ fieldKey: "1040_Line1z" }));
    });

    it("calculates Total Income and AGI correctly", async () => {
        // Setup initial fields
        mockFields.push(
            { _id: "f1", returnId: "r1", fieldKey: "W2_Box1", value: 50000, isManualOverride: false },
            { _id: "f2", returnId: "r1", fieldKey: "1040_Line2b", value: 1500, isManualOverride: false },
            { _id: "f3", returnId: "r1", fieldKey: "1040_Line10", value: 2000, isManualOverride: false }
        );

        await calculateReturnDependencies(mockCtx, "r1" as any);

        // Total Income (Line 9) should be 50000 (1z) + 1500 (2b) = 51500
        const totalIncome = mockFields.find(f => f.fieldKey === "1040_Line9");
        expect(totalIncome).toBeDefined();
        expect(totalIncome.value).toBe(51500);

        // AGI (Line 11) should be 51500 (Total Income) - 2000 (Adjustments) = 49500
        const agi = mockFields.find(f => f.fieldKey === "1040_Line11");
        expect(agi).toBeDefined();
        expect(agi.value).toBe(49500);
    });
});
