# Constitutional Close Audit

Status: audit contract and validation report.

## Required Close Types

The close authority audit validates the presence and traceability of:

- `CONTRACT_CLOSE`
- `CONTROL_CLOSE`
- `FIELD_CLOSE`
- `COMPLETION_CLOSE`
- `OPERATIONS_CLOSE`

## Audit Checks

The close audit detects:

- missing close types.
- invalid close ownership.
- invalid close traceability.
- close events without `scopeVersionId`.
- close events without actor attribution.
- immutable close events without `validatedAt`.
- authority type mismatches.
- AI advisory actors validating close authority.

## Diagnostics

Close diagnostics include:

- `[CLOSE_AUTHORITY_VALIDATED]`
- `[CLOSE_AUTHORITY_ERROR]`

## Result

Close authority passes only when close events are traceable, attributable, validated, immutable when authoritative, and aligned with ScopeVersion Close Authority.

