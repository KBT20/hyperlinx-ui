# PD-006 Engineering Change Set Doctrine

Date: 2026-07-08

## Constitutional Doctrine

Engineering truth is now separated into three layers:

Engineering Baseline

-> Engineering Change Sets

-> Engineering Revision

The Engineering Baseline is immutable intake authority. It is created from the Commercial Draft IOF Package through the Engineering Baseline process and is never edited directly.

Engineering Change Sets are the only permitted mechanism for modifying Engineering Revision state.

Engineering Revision is the editable engineering authority rebuilt from:

- Engineering Baseline references
- Active Engineering Change Set patches

Engineering Certification certifies the Engineering Revision, not the Engineering Package and not the Draft IOF Package.

## Baseline Authority

Engineering Baseline remains immutable and reference-only.

It may reference:

- Commercial Release Package
- Draft IOF Package
- Commercial Revision
- Route Repository
- Station Projection
- Object Manifest
- Estimate
- Workbook
- Proposal
- Product Doctrine
- Engineering Doctrine

It must not duplicate geometry, workbook bodies, proposal bodies, pricing output, or mutable workspace state.

## Change Set Authority

Engineering Change Sets are additive patch records.

Every Engineering Patch contains only:

- `patchId`
- `revisionId`
- `patchType`
- `targetObjectId`
- `targetProperty`
- `oldValue`
- `newValue`
- `createdBy`
- `createdAt`
- `reason`
- `authority`
- `validationState`

Patch records must not contain Engineering Package objects, route geometry, station arrays, map state, workbook bodies, proposal bodies, Draft IOF bodies, pricing output, runtime caches, or ScopeVersion state.

## Revision Authority

Engineering Revision is a projection, not a repository mutation.

The revision is rebuilt by replaying active Engineering Change Sets against immutable Engineering Baseline references. Discarded and inactive Change Sets do not affect the revision projection.

Engineering Revision carries:

- Engineering Baseline Hash
- Engineering Revision Hash
- Active Patch Count
- Applied Patch Count
- Replay Time
- Projection Time
- Certification Readiness diagnostics

## Certification Authority

Certified IOF Package references:

- Engineering Baseline
- Engineering Revision
- Engineering Change Sets
- Engineering Certification
- Certification Evidence
- Certification Hash

Certified IOF Package must not duplicate engineering objects as an alternate mutable authority.

## Protected Boundaries

This doctrine does not modify:

- Commercial Repository
- Commercial Revision
- Commercial Change Sets
- Commercial Release Package
- Draft IOF Package generation
- ScopeVersion
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence
- station projection
- pricing formulas
- certification rules

## Canonical Flow

Engineering operates as:

Engineering Baseline

-> Engineering Change Sets

-> Engineering Patch Engine

-> Engineering Revision Projection

-> Engineering Revision

-> Engineering Certification

-> Certified IOF Package

No Engineering component shall modify the Engineering Baseline directly.

No mutable Engineering Package shall remain the source of engineering authority.
