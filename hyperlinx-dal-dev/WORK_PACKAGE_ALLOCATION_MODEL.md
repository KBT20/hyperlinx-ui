# Work Package Allocation Model

Status: doctrine and read-only allocation contract.

## Required Allocation Traceability

Each Work Package must preserve:

- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- station ids.
- segment ids.
- object ids.
- vendor ids.
- budget references.
- quantity references.
- dependency references.

## No Orphan Packages

No Work Package may exist without ScopeVersion traceability.

No Work Package may own stations, segments, objects, vendors, budgets, or quantities outside the approved ScopeVersion authority boundary.

## Allocation Meaning

Allocation identifies what a package organizes.

Allocation is not schedule.

Allocation is not assignment.

Allocation is not closure.

