import { FilingStatus } from './standardDeduction';

export interface TaxBracket {
    limit: number;
    rate: number;
}

const TAX_BRACKETS_2023: Record<FilingStatus, TaxBracket[]> = {
    'Single': [
        { limit: 11000, rate: 0.10 },
        { limit: 44725, rate: 0.12 },
        { limit: 95375, rate: 0.22 },
        { limit: 182100, rate: 0.24 },
        { limit: 231250, rate: 0.32 },
        { limit: 578125, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
    'Married Filing Jointly': [
        { limit: 22000, rate: 0.10 },
        { limit: 89450, rate: 0.12 },
        { limit: 190750, rate: 0.22 },
        { limit: 364200, rate: 0.24 },
        { limit: 462500, rate: 0.32 },
        { limit: 693750, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
    'Married Filing Separately': [
        { limit: 11000, rate: 0.10 },
        { limit: 44725, rate: 0.12 },
        { limit: 95375, rate: 0.22 },
        { limit: 182100, rate: 0.24 },
        { limit: 231250, rate: 0.32 },
        { limit: 346875, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
    'Head of Household': [
        { limit: 15700, rate: 0.10 },
        { limit: 59850, rate: 0.12 },
        { limit: 95350, rate: 0.22 },
        { limit: 182100, rate: 0.24 },
        { limit: 231250, rate: 0.32 },
        { limit: 578100, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
    'Qualifying Widow(er)': [
        { limit: 22000, rate: 0.10 },
        { limit: 89450, rate: 0.12 },
        { limit: 190750, rate: 0.22 },
        { limit: 364200, rate: 0.24 },
        { limit: 462500, rate: 0.32 },
        { limit: 693750, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
};

const TAX_BRACKETS_2025: Record<FilingStatus, TaxBracket[]> = {
    'Single': [
        { limit: 12000, rate: 0.10 },
        { limit: 49000, rate: 0.12 },
        { limit: 104000, rate: 0.22 },
        { limit: 198000, rate: 0.24 },
        { limit: 252000, rate: 0.32 },
        { limit: 630000, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
    'Married Filing Jointly': [
        { limit: 24000, rate: 0.10 },
        { limit: 98000, rate: 0.12 },
        { limit: 208000, rate: 0.22 },
        { limit: 396000, rate: 0.24 },
        { limit: 504000, rate: 0.32 },
        { limit: 756000, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
    'Married Filing Separately': [
        { limit: 12000, rate: 0.10 },
        { limit: 49000, rate: 0.12 },
        { limit: 104000, rate: 0.22 },
        { limit: 198000, rate: 0.24 },
        { limit: 252000, rate: 0.32 },
        { limit: 378000, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
    'Head of Household': [
        { limit: 17100, rate: 0.10 },
        { limit: 65400, rate: 0.12 },
        { limit: 104000, rate: 0.22 },
        { limit: 198000, rate: 0.24 },
        { limit: 252000, rate: 0.32 },
        { limit: 630000, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
    'Qualifying Widow(er)': [
        { limit: 24000, rate: 0.10 },
        { limit: 98000, rate: 0.12 },
        { limit: 208000, rate: 0.22 },
        { limit: 396000, rate: 0.24 },
        { limit: 504000, rate: 0.32 },
        { limit: 756000, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
};

/**
 * Calculates federal income tax based on specified tax year.
 */
export function calculateFederalTax(taxableIncome: number, status: FilingStatus, taxYear: number): number {
    if (taxYear !== 2023 && taxYear !== 2025) {
        throw new Error(`Tax year ${taxYear} calculations are not yet implemented.`);
    }

    if (taxableIncome <= 0) return 0;

    const brackets = taxYear === 2025 ? TAX_BRACKETS_2025[status] : TAX_BRACKETS_2023[status];
    let totalTax = 0;
    let previousLimit = 0;

    for (const bracket of brackets) {
        if (taxableIncome > previousLimit) {
            const taxableInBracket = Math.min(taxableIncome, bracket.limit) - previousLimit;
            totalTax += taxableInBracket * bracket.rate;
            previousLimit = bracket.limit;
        } else {
            break;
        }
    }

    return Math.round(totalTax);
}

/**
 * Calculates Section 199A QBI Deduction (simplified).
 * Max 20% of QBI. Subject to thresholds.
 */
export function calculateQBIDeduction(qbi: number, taxableIncome: number): number {
    if (qbi <= 0) return 0;
    // Simplified: 20% of QBI or 20% of taxable income (less capital gains)
    return Math.round(Math.min(qbi * 0.20, taxableIncome * 0.20));
}

/**
 * Calculates Child Tax Credit (simplified for demo).
 * $2,000 per qualifying child.
 */
export function calculateChildTaxCredit(numChildren: number, agi: number, status: FilingStatus): number {
    let credit = numChildren * 2000;

    // Phase-out
    let threshold = 400000; // MFJ
    if (status !== 'Married Filing Jointly') {
        threshold = 200000;
    }

    if (agi > threshold) {
        const excess = agi - threshold;
        const phaseOut = Math.ceil(excess / 1000) * 50;
        credit = Math.max(0, credit - phaseOut);
    }

    return credit;
}
