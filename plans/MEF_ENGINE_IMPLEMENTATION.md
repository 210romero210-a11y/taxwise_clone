# MeF Engine Implementation - IRS Publication 4164 Compliance

## Overview

This document describes the implementation of the Modernized e-File (MeF) XML Generator for the TaxWise Clone, designed to output IRS-compliant data adhering to Publication 4164 standards.

## Key Features Implemented

### 1. IRS Pub 4164 Compliant XML Structure

The XML generator now produces output that conforms to IRS specifications:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Header>
    <TransmissionHeader>
      <ETIN>...</ETIN>
      <TransmissionManifest>
        <SubmissionId>TW{timestamp}</SubmissionId>
        <TaxYear>{year}</TaxYear>
        <TaxReturnType>1040</TaxReturnType>
      </TransmissionManifest>
      <ElectronicReturnOriginator>
        <EFIN>...</EFIN>
        <PTIN>...</PTIN>
      </ElectronicReturnOriginator>
      <Security>
        <OriginatingIP>...</OriginatingIP>
      </Security>
    </TransmissionHeader>
  </SOAP-ENV:Header>
  <SOAP-ENV:Body>
    <Return xmlns="http://www.irs.gov/efile/1040" returnVersion="2024v5.0">
      <!-- IRS 1040 Data -->
    </Return>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

### 2. IRS Field Mapping

The system maps internal form fields to IRS XML element names:

| Internal Field | IRS XML Element |
|----------------|-----------------|
| Line1z | WagesSalariesTipsAmt |
| Line12 | StandardDeductionAmt |
| Line15 | TaxableIncomeAmt |
| Line25a | IncomeTaxWithheldAmt |

See [`IRS_FIELD_MAPPING`](convex/mefEngine.ts:23) for complete mapping.

### 3. XML Schema Validation (XSD)

The `validateAgainstXSD()` function validates critical field constraints:

- SSN format: exactly 9 digits
- Currency fields: non-negative integers (IRS requires whole dollars)
- Routing numbers: exactly 9 digits
- Account numbers: 4-17 digits

### 4. Expanded Business Rules

The system implements IRS Pub 4164 Section 5 business rules:

| Rule ID | Description |
|---------|-------------|
| R0000-001 | PrimarySSN must be 9 digits |
| R1001-002 | SpouseSSN required for MFJ |
| F1040-001 | Income cannot be negative |
| F1040-005 | Tax calculation must match IRS tables |
| F1040-009 | Refund cannot exceed overpayment |

### 5. Security Requirements (Pub 4164 Section 3)

- **OriginatingIP**: Captures taxpayer's IP for audit trail
- **ERO Signature**: Electronic Return Originator credentials (EFIN, PTIN)
- **Immutable Audit Trail**: Hash-chained logging of all transmissions

### 6. Bilingual Diagnostics

Error messages are translated between English and Spanish:

```typescript
const IRS_ERROR_TRANSLATIONS = {
  "R0000-001": {
    en: "Primary SSN and NameControl do not match IRS records",
    es: "El SSN primario y NameControl no coinciden con los registros del IRS"
  },
  // ... more translations
};
```

## API Usage

### Generate IRS 1040 XML

```typescript
const { xml, submissionId, validationErrors, translatedErrors } = 
  await convex.functions.generateIRS1040XML({ 
    returnId: returnId,
    locale: "es" // Optional: for Spanish diagnostics
  });
```

### Query Submission Status

```typescript
const submission = await convex.functions.getSubmissionStatus({ 
  submissionId: submissionId 
});
```

### Validate Before Transmission

```typescript
const validation = await convex.functions.validateForTransmission({
  returnId: returnId,
  submissionType: "1040",
  returnData: taxReturnData
});
```

## Schema Updates

### mefSubmissions Table

Enhanced with IRS tracking fields:

- `irsSubmissionId`: IRS-assigned submission ID
- `irsReceiptTimestamp`: When IRS acknowledged receipt
- `irsAcknowledgmentCode`: "ACCEPTED" or "REJECTED"
- `originatingIP`: Taxpayer's IP for security
- `efin`: Electronic Filing Identification Number
- `preparerPTIN`: Preparer Tax Identification Number

### mefValidationResults Table

Enhanced with bilingual support:

- `irsErrorCode`: Original IRS error code
- `translatedMessage`: Localized error message
- `locale`: Language preference

## Next Steps

1. **EFIN Registration**: Register for an EFIN at [IRS e-file Provider Page](https://www.irs.gov/e-file-providers)
2. **WSDL Integration**: Implement actual SOAP/WSDL transmission per IRS Pub 4163
3. **Production XSD**: Obtain official IRS XSD schemas for full validation
4. **Test Transmission**: Use IRS Modernized e-File Test Suite before production

## References

- [IRS Publication 4164](https://www.irs.gov/pub4164) - Modernized e-File (MeF) Guide
- [IRS Publication 4163](https://www.irs.gov/pub4163) - XML Schema Documentation
- [IRS Publication 1345](https://www.irs.gov/pub1345) - Authentication Requirements
