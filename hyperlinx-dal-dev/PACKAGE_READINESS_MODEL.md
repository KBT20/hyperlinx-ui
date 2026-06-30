# Package Readiness Model

Status: Sprint 13.5 Runtime Model

Package readiness measures whether a Draft IOF Package is sufficiently assembled for Engineering review and eventual certification.

It is separate from certification. A package can be ready for Engineering review while still missing Engineering certification.

## Readiness Inputs

- Proposal reference
- Customer
- Opportunity
- Runtime Object references
- Geometry references
- Existing Inventory references
- Relationship references
- Evidence references
- Proposed IOF Units
- Engineering Review state
- Validation state

## Missing Categories

The model reports:

- Missing Geometry
- Missing Inventory
- Missing Relationships
- Missing Evidence
- Missing Units
- Missing Engineering Review
- Missing Validation

## Scores

- `readinessScore`
- `packageCompleteness`
- `certificationPercent`
- `proposedUnitCount`
- `certifiedUnitCount`

## Status Values

- `INCOMPLETE`
- `READY_FOR_ENGINEERING_REVIEW`
- `READY_FOR_PACKAGE_CERTIFICATION`

## Validation

Validation checks are emitted alongside readiness:

- Geometry
- Existing Inventory
- Relationships
- Evidence
- Proposed IOF Units
- Engineering Review
- Runtime References

Validation can be `PASS`, `WARNING`, or `FAIL`.

