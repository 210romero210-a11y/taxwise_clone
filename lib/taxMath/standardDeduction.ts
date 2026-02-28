export type FilingStatus = 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household' | 'Qualifying Widow(er)';

export function calculateStandardDeduction(
    status: FilingStatus,
    taxYear: number,
    isBlind: boolean = false,
    isOver65: boolean = false
): number {
    // 2023 Standard Deductions
    let baseDeduction = 0;
    let additionalDeduction = 0;

    if (taxYear === 2023) {
        switch (status) {
            case 'Single':
            case 'Married Filing Separately':
                baseDeduction = 13850;
                additionalDeduction = 1850;
                break;
            case 'Married Filing Jointly':
            case 'Qualifying Widow(er)':
                baseDeduction = 27700;
                additionalDeduction = 1500;
                break;
            case 'Head of Household':
                baseDeduction = 20800;
                additionalDeduction = 1850;
                break;
            default:
                throw new Error(`Unsupported filing status: ${status}`);
        }
    } else if (taxYear === 2025) {
        switch (status) {
            case 'Single':
            case 'Married Filing Separately':
                baseDeduction = 15000;
                additionalDeduction = 2000;
                break;
            case 'Married Filing Jointly':
            case 'Qualifying Widow(er)':
                baseDeduction = 30000;
                additionalDeduction = 1600;
                break;
            case 'Head of Household':
                baseDeduction = 22500;
                additionalDeduction = 2000;
                break;
            default:
                throw new Error(`Unsupported filing status: ${status}`);
        }
    } else {
        throw new Error(`Tax year ${taxYear} is not currently supported`);
    }

    let totalAdditional = 0;
    if (isBlind) totalAdditional += additionalDeduction;
    if (isOver65) totalAdditional += additionalDeduction;

    return baseDeduction + totalAdditional;
}
