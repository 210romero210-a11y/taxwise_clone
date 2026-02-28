/**
 * Calculates Self-Employment (SE) Tax.
 * 15.3% total (12.4% SS + 2.9% Medicare) on 92.35% of net profit.
 */
export function calculateSETax(netProfit: number, taxYear: number): { totalTax: number, deduction: number } {
    if (netProfit <= 0) return { totalTax: 0, deduction: 0 };

    const seIncome = netProfit * 0.9235;

    // Limits (Approximated for 2025)
    const ssLimit = taxYear === 2025 ? 176100 : 160200;

    // Social Security portion (12.4%)
    const ssTax = Math.min(seIncome, ssLimit) * 0.124;

    // Medicare portion (2.9%)
    const medicareTax = seIncome * 0.029;

    const totalTax = Math.round(ssTax + medicareTax);
    const deduction = Math.round(totalTax * 0.5);

    return { totalTax, deduction };
}
