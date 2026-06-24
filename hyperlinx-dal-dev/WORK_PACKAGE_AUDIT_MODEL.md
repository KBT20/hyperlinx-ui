# Work Package Audit Model

Status: doctrine and read-only audit contract.

## Purpose

Work Package audits explain what was generated, what was rejected, and why.

## Audit Fields

A Work Package audit records:

- `auditId`.
- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- generated package ids.
- rejected package ids.
- blocker ids.
- actor id.
- actor role.
- timestamp.
- diagnostics.

## Diagnostic Events

Work Package generation may emit:

- `[WORK_PACKAGE_GENERATION_STARTED]`
- `[WORK_PACKAGE_GENERATED]`
- `[WORK_PACKAGE_VALIDATED]`
- `[WORK_PACKAGE_BLOCKER_IDENTIFIED]`
- `[WORK_PACKAGE_REJECTED]`
- `[WORK_PACKAGE_AUDIT_CREATED]`

## Replay Doctrine

Replay may verify package authority from:

1. ScopeVersion traceability.
2. `CONTROL_ACTIVE`.
3. approved package references.
4. generated Work Package allocations.
5. dependency references.
6. audit records.

Replay may not infer package authority from Prism output, Marketplace estimates, Budget Candidates, Vendor Responses, SOF readiness, or Contract Readiness.

