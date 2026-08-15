# CIP-029 Certification Ledger and Immutable Certified IOF Package Report

Date: 2026-07-08

## Objective

Introduce Certification Ledger as the constitutional authority for Engineering Certification.

Engineering Certification is now an immutable event. Certified IOF Package is a projection of the Certification Ledger rather than the repository of certification truth.

## Constitutional Authority

Engineering completes as:

Engineering Baseline

-> Engineering Revision

-> Engineering Change Sets

-> Engineering Certification

-> Certification Ledger

-> Certified IOF Package

Certification Ledger owns the certification event.

Certified IOF Package is transportable engineering output derived from that event.

## Certification Ledger Architecture

Added:

- `CertificationLedger`
- `CertificationLedgerEntry`
- `CertificationLedgerValidator`
- `CertificationLedgerProjection`
- `CertificationEvidenceManifest`
- `CertificationAuthority`

Canonical endpoint:

`/api/engineering/certification-ledger`

Physical storage:

`server/data/certification-ledgers`

The ledger serializer is whitelist-based and rejects duplicated repository truth, embedded station plans, embedded budgets, embedded Draft IOF bodies, embedded Engineering Package bodies, route geometry, runtime caches, and ScopeVersion state.

## Certified IOF Package Architecture

Certified IOF Package is now created by `CertifiedIofPackageProjection`.

The projection references:

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

The projection is marked:

- `referenceOnly`
- `projectionOnly`
- `singleEngineeringTruth`
- `noDuplicatedRepositoryTruth`
- `noEmbeddedCommercialTruth`
- `noEmbeddedEngineeringTruth`
- `noScopeVersionCreation`
- `noServiceOrderCreation`
- `noRuntimePromotion`

## Evidence Model

This section defines the evidence model.

`CertificationEvidenceManifest` references:

- station review
- object review
- doctrine validation
- quantity validation
- dependency validation
- engineering notes
- reviewer comments
- validation results

The manifest produces `certificationEvidenceHash`.

Evidence is referenced by ID/hash. Evidence bodies are not copied into the Certified IOF Package.

## Repository Reference Model

This section defines the repository reference model.

Certification Ledger records:

- Engineering Baseline ID
- Engineering Revision ID and hash
- Engineering Change Set IDs
- Commercial Release Package ID
- Commercial Revision ID and hash
- Route Repository ID
- Proposal ID
- Estimate ID
- Workbook ID
- Product Doctrine ID
- Engineering Doctrine ID
- Evidence Manifest ID and hash
- Certified Package ID
- Certification hash
- Package hash

## Certification Flow

1. Engineering Certification validates package readiness.
2. Engineering Revision and Engineering Change Set references are resolved.
3. Station/object/evidence hashes are generated.
4. Certification Ledger entry is created and persisted.
5. Certified IOF Package projection is derived from the ledger.
6. Certified IOF Package projection is persisted for restore and Service Order readiness.
7. ScopeVersion remains blocked.

## Runtime Diagnostics

Engineering Certification now displays:

- Certification Ledger ID
- Certification Hash
- Engineering Revision Hash
- Commercial Revision Hash
- Evidence Hash
- Certified Package Hash
- Certification Timestamp
- Reviewer

## Protected Boundaries

Not modified by CIP-029:

- Commercial Repository
- Commercial Revision
- Commercial Change Sets
- Commercial Release Package
- Draft IOF Package generation
- Engineering Baseline authority
- Engineering Revision authority
- Engineering Change Set authority
- ScopeVersion authority
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence

## Stop And Test

After CIP-029, feature development should pause for a constitutional end-to-end test using Google Opportunity 12:

Translate

-> Opportunity

-> Commercial Route Repository

-> Commercial Revision

-> Commercial Change Sets

-> Proposal

-> Customer Acceptance

-> Commercial Release Package

-> Draft IOF Package

-> Mandatory Station Projection

-> Engineering Baseline

-> Engineering Revision

-> Engineering Change Sets

-> Engineering Certification

-> Certification Ledger

-> Certified IOF Package

Every transition should prove immutability, reference transfer, ID/hash preservation, no repository truth mutation, restart-safe restore, and deterministic regeneration from authoritative inputs.

## Files Modified

- `server/routes/certification-ledger.js`
- `server/routes/_shared.js`
- `server/index.js`
- `server/routes/engineering-certification.js`
- `src/api/teralinxRuntime.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `server/data/certification-ledgers/.gitkeep`
- `cip029-certification-ledger-validation.mjs`
- `PD_007_CERTIFICATION_LEDGER_DOCTRINE.md`
- `CIP_029_CERTIFICATION_LEDGER_IMMUTABLE_CERTIFIED_IOF_PACKAGE_REPORT.md`

## Validation Results

Validation script:

`node cip029-certification-ledger-validation.mjs`

Result:

`PASS`

TypeScript:

`npx tsc --noEmit -p tsconfig.json`

Result:

`PASS`

Production build:

`npm run build`

Result:

`PASS`

Diff whitespace:

`git diff --check`

Result:

`PASS`

Note: Git reported existing CRLF normalization warnings in the working copy, but no whitespace errors.
