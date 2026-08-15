# PD-007 Certification Ledger Doctrine

Date: 2026-07-08

## Constitutional Authority

Engineering Certification is an immutable event.

The Certification Ledger is the constitutional authority for that event.

The Certified IOF Package is not certification truth. It is a transportable projection derived from the Certification Ledger.

## Lifecycle

Engineering now completes as:

Engineering Baseline

-> Engineering Revision

-> Engineering Change Sets

-> Engineering Certification

-> Certification Ledger

-> Certified IOF Package

## Certification Ledger

Each Certification Ledger entry records:

- `certificationId`
- `engineeringBaselineId`
- `engineeringRevisionId`
- `engineeringRevisionHash`
- `commercialReleasePackageId`
- `commercialRevisionId`
- `commercialRevisionHash`
- `certificationEvidenceHash`
- `certificationTimestamp`
- `certifiedBy`
- `reviewStatus`
- `engineeringDoctrineVersion`
- `commercialDoctrineVersion`
- `stationProjectionHash`
- `objectManifestHash`
- `packageHash`
- `result`
- `certifiedPackageId`

The ledger is immutable after creation. A later correction requires a new certification event, not mutation of the prior ledger entry.

## Certified IOF Package

Certified IOF Package is a reference-only projection.

It references:

- Certification Ledger
- Engineering Revision
- Engineering Baseline
- Commercial Release Package
- Commercial Revision
- Proposal
- Estimate
- Workbook
- Product Doctrine
- Engineering Doctrine
- Evidence Manifest

It must not duplicate repository truth, engineering objects, commercial truth, Draft IOF bodies, route geometry, station arrays, workbook bodies, proposal bodies, or ScopeVersion state.

## Certification Evidence

Certification evidence is represented by `CertificationEvidenceManifest`.

This is the evidence model for Engineering Certification.

It references:

- station review
- object review
- doctrine validation
- quantity validation
- dependency validation
- engineering notes
- reviewer comments
- validation results

Evidence is referenced by ID/hash. Evidence bodies remain outside the Certified IOF Package projection.

## Certification Rules

Engineering Certification may certify only Engineering Revision.

Engineering Certification shall not certify:

- Engineering Package
- Draft IOF Package
- Commercial Release Package

Those artifacts are intake or upstream authority, not certification authority.

## Runtime Boundary

The repository reference model is ledger-first: Certified IOF Package projections resolve authoritative inputs through Certification Ledger references.

CIP-029 does not implement Service Orders.

CIP-029 does not implement Runtime Promotion.

ScopeVersion remains blocked until a signed Service Order exists and Runtime performs constitutional promotion.

## Protected Boundaries

This doctrine does not modify:

- Commercial Repository
- Commercial Revision
- Commercial Change Sets
- Commercial Release Package
- Draft IOF Package generation
- Engineering Baseline
- Engineering Revision
- Engineering Change Sets
- ScopeVersion
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence

## End-To-End Test Pause

After CIP-029, feature development should pause for an end-to-end constitutional test.

The test should verify that each artifact is immutable after transfer, each next artifact references the previous artifact, IDs and hashes are preserved, repository truth is not mutated, restore works from repository references, and projections can be regenerated deterministically.
