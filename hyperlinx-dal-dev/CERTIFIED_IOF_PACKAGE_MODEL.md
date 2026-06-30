# Certified IOF Package Model

Status: Sprint 13.4 Runtime Model

A Certified IOF Package is the frozen Engineering-approved execution spine. It is generated from a Draft IOF Package only after every Proposed IOF Unit has been certified.

## Required References

- source Draft IOF Package
- Proposal
- Customer
- Opportunity
- Existing Inventory
- Customer Twin
- Customer Design Request
- Geometry references
- Runtime Object references
- Runtime Relationship references
- Runtime Evidence references
- Certified IOF Units

## Immutability

Certified IOF Packages are immutable. Normal IOF package update routes reject changes after certification. Rework must go back through Commercial Proposal revision, Customer approval, Draft IOF assembly, and Engineering certification.

## Runtime Behavior

Certification persists:

- Certified IOF Package
- frozen Certified IOF Units
- Runtime History
- Runtime Evidence
- Runtime Object mirror
- Execution Authorization Certificate
- executable ScopeVersion

No Marketplace, Contract, Procurement, Control, Field, or Operational Intelligence artifact is created during certification.
