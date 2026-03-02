/**
 * Calculates Self-Employment (SE) Tax.
 * 15.3% total (12.4% SS + 2.9% Medicare) on 92.35% of net profit.
 * 
 * Social Security wage limits by year:
 * - 2023: $160,200
 * - 2024: $168,600
 * - 2025: $176,100
 */
export function calculateSETax(netProfit: number, taxYear: number): { totalTax: number, deduction: number } {
    if (netProfit <= 0) return { totalTax: 0, deduction: 0 };

    const seIncome = netProfit * 0.9235;

    // Social Security wage limits by year
    let ssLimit: number;
    switch (taxYear) {
        case 2025:
            ssLimit = 176100;
            break;
        case 2024:
            ssLimit = 168600;
            break;
        case 2023:
        default:
            ssLimit = 160200;
            break;
    }

    // Social Security portion (12.4%)
    const ssTax = Math.min(seIncome, ssLimit) * 0.124;

    // Medicare portion (2.9%)
    const medicareTax = seIncome * 0.029;

    const totalTax = Math.round(ssTax + medicareTax);
    const deduction = Math.round(totalTax * 0.5);

    return { totalTax, deduction };
}
