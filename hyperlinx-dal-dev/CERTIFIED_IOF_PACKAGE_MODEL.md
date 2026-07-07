# Certified Draft IOF Package Model

Status: Active constitutional model. Legacy compatibility name: Certified IOF Package.

The Certified Draft IOF Package is the frozen Engineering-approved Draft IOF Package.

It is not a separate engineering representation.

It is the same Draft IOF Package after Engineering certifies that it is complete, constructable, constitutionally valid, and ready for customer commitment.

## Required References

- source Draft IOF Package
- Proposal projection reference
- Customer
- Opportunity
- Existing Inventory
- Customer Twin
- Customer Design Request
- Geometry references
- Runtime Object references
- Runtime Relationship references
- Runtime Evidence references
- Certified IOF Units, if unit-level certification exists in the package

## Immutability

Certified Draft IOF Packages are immutable. Normal IOF package update routes reject changes after certification.

Customer-requested changes must go through:

```text
Customer Review
  -> Draft IOF Package Revision
  -> Engineering Re-certification
  -> New Proposal
```

## Runtime Behavior

Certification persists:

- Certified Draft IOF Package reference
- frozen Certified IOF Units
- Runtime History
- Runtime Evidence
- Runtime Object mirror

Certification does not create ScopeVersion.

Certification does not create Service Order.

Certification does not create execution authorization.

No Marketplace, Contract, Procurement, Control, Field, Operational Twin, or Operational Intelligence artifact is created during certification.

Proposal and Service Order reference the Certified Draft IOF Package and shall not recreate engineering truth.
