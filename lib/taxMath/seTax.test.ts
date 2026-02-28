import { calculateSETax } from "./seTax";

describe("Self-Employment Tax Math Audit", () => {
    test("Calculates $0 tax for $0 profit", () => {
        const { totalTax, deduction } = calculateSETax(0, 2023);
        expect(totalTax).toBe(0);
        expect(deduction).toBe(0);
    });

    test("Calculates correct tax for $100,000 profit (2023)", () => {
        // 100,000 * 0.9235 = 92,350
        // SS: 92,350 * 0.124 = 11,451.4
        // Medicare: 92,350 * 0.029 = 2,678.15
        // Total: 14,129.55 -> 14,130
        const { totalTax, deduction } = calculateSETax(100000, 2023);
        expect(totalTax).toBe(14130);
        expect(deduction).toBe(7065);
    });

    test("Respects Social Security Wage Limit ($160,200 for 2023)", () => {
        // Profit: $200,000
        // SE Income: 200,000 * 0.9235 = 184,700
        // SS Tax (Capped at 160,200): 160,200 * 0.124 = 19,864.8
        // Medicare Tax (No cap): 184,700 * 0.029 = 5,356.3
        // Total: 25,221.1 -> 25,221
        const { totalTax } = calculateSETax(200000, 2023);
        expect(totalTax).toBe(25221);
    });

    test("Applies 2025 SS Limit correctly", () => {
        // Profit: $200,000
        // SE Income: 184,700
        // SS Tax (Capped at 176,100 for 2025): 176,100 * 0.124 = 21,836.4
        // Medicare Tax: 5,356.3
        // Total: 27,192.7 -> 27,193
        const { totalTax } = calculateSETax(200000, 2025);
        expect(totalTax).toBe(27193);
    });
});
