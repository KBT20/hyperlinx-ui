# Constitutional Traceability Audit

Status: audit contract and validation report.

## Required Chain

The required chain is:

```text
Customer
  -> Opportunity
  -> Corridor
  -> ScopeVersion
```

Every authority-bearing object must preserve:

- `customerId`
- `opportunityId`
- `corridorId`
- `scopeVersionId`

## Audit Checks

The traceability audit detects:

- missing `customerId`.
- missing `opportunityId`.
- missing `corridorId`.
- missing `scopeVersionId`.
- orphan customer references.
- orphan opportunity references.
- orphan corridor references.
- invalid parent ScopeVersion relationships.
- authority events without ScopeVersion traceability.
- close events without ScopeVersion traceability.
- work packages without ScopeVersion traceability.

## Diagnostics

Traceability diagnostics include:

- `[CUSTOMER_TRACEABILITY_VALIDATED]`
- `[TRACEABILITY_ERROR]`
- `[SCOPEVERSION_TRACEABILITY_VALIDATED]`
- `[SCOPEVERSION_TRACEABILITY_ERROR]`

## Result

Traceability passes only when there are no error or critical findings.

