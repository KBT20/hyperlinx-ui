# Work Package Generation Model

Status: doctrine and read-only generation contract.

## Required Inputs

Work Package generation requires:

- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- lifecycle state `CONTROL_ACTIVE`.
- approved object package.
- approved station package.
- approved segment package.
- approved budget.
- approved execution strategy.
- approved design standards.
- approved reference architecture.
- approved vendor allocations.

## Supported Generation Sources

Work Packages may be generated from:

- Objects.
- Stations.
- Segments.
- Disciplines.
- Vendors.
- Products.
- Reference Architectures.
- Design Standards.

## Example Patterns

Long-haul corridor:

- Segment Work Packages.
- Regen Work Packages.
- Fiber Work Packages.
- Conduit Work Packages.
- Station Work Packages.

Metro aggregation:

- Station Work Packages.
- LSO Work Packages.
- Fiber Work Packages.
- Construction Work Packages.

AI corridor:

- Power Work Packages.
- Substation Work Packages.
- GPU Work Packages.
- Facility Work Packages.
- Transport Work Packages.

