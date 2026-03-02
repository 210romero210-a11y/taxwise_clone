export type FilingStatus = 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household' | 'Qualifying Widow(er)';

// 2024 Standard Deductions (IRS Revenue Procedure 2023-34)
const STANDARD_DEDUCTIONS_2024: Record<FilingStatus, { base: number; additional: number }> = {
    'Single': { base: 14600, additional: 1950 },
    'Married Filing Jointly': { base: 29200, additional: 1550 },
    'Married Filing Separately': { base: 14600, additional: 1550 },
    'Head of Household': { base: 21900, additional: 1950 },
    'Qualifying Widow(er)': { base: 29200, additional: 1550 },
};

// 2025 Standard Deductions
const STANDARD_DEDUCTIONS_2025: Record<FilingStatus, { base: number; additional: number }> = {
    'Single': { base: 15000, additional: 2000 },
    'Married Filing Jointly': { base: 30000, additional: 1600 },
    'Married Filing Separately': { base: 15000, additional: 1600 },
    'Head of Household': { base: 22500, additional: 2000 },
    'Qualifying Widow(er)': { base: 30000, additional: 1600 },
};

export function calculateStandardDeduction(
    status: FilingStatus,
    taxYear: number,
    isBlind: boolean = false,
    isOver65: boolean = false
): number {
    let deduction: { base: number; additional: number };
    
    if (taxYear === 2024) {
        deduction = STANDARD_DEDUCTIONS_2024[status];
    } else if (taxYear === 2025) {
        deduction = STANDARD_DEDUCTIONS_2025[status];
    } else if (taxYear === 2023) {
        // Legacy 2023 values
        switch (status) {
            case 'Single':
            case 'Married Filing Separately':
                return 13850 + (isBlind ? 1850 : 0) + (isOver65 ? 1850 : 0);
            case 'Married Filing Jointly':
            case 'Qualifying Widow(er)':
                return 27700 + (isBlind ? 1500 : 0) + (isOver65 ? 1500 : 0);
            case 'Head of Household':
                return 20800 + (isBlind ? 1850 : 0) + (isOver65 ? 1850 : 0);
            default:
                throw new Error(`Unsupported filing status: ${status}`);
        }
    } else {
        throw new Error(`Tax year ${taxYear} is not currently supported`);
    }

    if (!deduction) {
        throw new Error(`Unsupported filing status: ${status}`);
    }

    let totalAdditional = 0;
    if (isBlind) totalAdditional += deduction.additional;
    if (isOver65) totalAdditional += deduction.additional;

    return deduction.base + totalAdditional;
}
