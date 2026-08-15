# PD-006 Engineering Baseline Doctrine

Date: 2026-07-08

## Constitutional Purpose

Commercial owns Commercial truth.

Engineering owns Engineering truth.

The Draft IOF Package is a Commercial artifact. It is the complete commercial release package projection that allows Engineering intake, but it is not the mutable Engineering authority.

Engineering Baseline is the immutable Engineering intake artifact created from the Draft IOF Package.

## Immutable Intake Doctrine

Engineering shall never modify the Draft IOF Package.

Engineering shall never certify the Draft IOF Package as Engineering truth.

Engineering shall create an immutable Engineering Baseline from the Draft IOF Package, then derive the Engineering Package from that Baseline.

The Engineering Baseline contains references only. It never duplicates Commercial Repository truth, route geometry, workbook body, proposal body, estimate body, customer inventory, runtime caches, map state, or Draft IOF payload bodies.

## Required Lifecycle

Commercial Release Package

-> Draft IOF Package

-> Engineering Baseline

-> Engineering Package

-> Engineering Revision

-> Engineering Certification

-> Certified IOF Package

For this sprint, Engineering Revision mirrors the Engineering Package until Engineering Change Sets are introduced.

## Authority Boundaries

Commercial owns:

- Commercial Repository
- Commercial Revision
- Commercial Change Sets
- Commercial Release Package
- Draft IOF Package

Engineering owns:

- Engineering Baseline
- Engineering Package
- Engineering Revision
- Station Projection review
- Object placement review
- Budget confirmation
- Certification
- Certified IOF Package

Runtime owns:

- ScopeVersion creation after executed Service Order

## Reference Model

Engineering Baseline references:

- Commercial Release Package
- Draft IOF Package
- Commercial Revision
- Commercial Revision Hash
- Commercial Release Hash
- Route Repository
- Station Projection
- Object Manifest
- Estimate
- Workbook
- Proposal
- Product Doctrine
- Engineering Doctrine

No geometry duplication is allowed.

No workbook duplication is allowed.

No proposal duplication is allowed.

No ScopeVersion creation occurs.

## Certification Doctrine

Engineering Certification consumes Engineering authority.

The Engineering Baseline is immutable.

The Engineering Package is the working container.

The Engineering Revision is the certification surface. Until Engineering Change Sets exist, the Engineering Revision mirrors the Engineering Package.

Certified IOF Package output remains compatible with the existing Service Order and future ScopeVersion lifecycle.
