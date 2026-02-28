import { calculateStandardDeduction } from './standardDeduction';

describe('Standard Deduction Calculation (2023)', () => {
    it('calculates the base deduction for Single correctly', () => {
        expect(calculateStandardDeduction('Single', 2023)).toBe(13850);
    });

    it('calculates the base deduction for Married Filing Jointly correctly', () => {
        expect(calculateStandardDeduction('Married Filing Jointly', 2023)).toBe(27700);
    });

    it('calculates the base deduction for Head of Household correctly', () => {
        expect(calculateStandardDeduction('Head of Household', 2023)).toBe(20800);
    });

    it('adds additional deduction for being over 65 (Single)', () => {
        expect(calculateStandardDeduction('Single', 2023, false, true)).toBe(13850 + 1850);
    });

    it('adds additional deduction for being blind (Single)', () => {
        expect(calculateStandardDeduction('Single', 2023, true, false)).toBe(13850 + 1850);
    });

    it('adds additional deduction for being both over 65 and blind (Single)', () => {
        expect(calculateStandardDeduction('Single', 2023, true, true)).toBe(13850 + 1850 + 1850);
    });

    it('adds additional deduction for being over 65 (Married Filing Jointly)', () => {
        expect(calculateStandardDeduction('Married Filing Jointly', 2023, false, true)).toBe(27700 + 1500);
    });

    it('throws for unsupported tax year', () => {
        expect(() => calculateStandardDeduction('Single', 2020)).toThrow('Tax year 2020 is not currently supported');
    });
});
