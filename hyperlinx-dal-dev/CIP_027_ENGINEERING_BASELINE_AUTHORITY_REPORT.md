# CIP-027 Engineering Baseline Authority Report

Date: 2026-07-08

## Objective

Introduce Engineering Baseline as the immutable Engineering authority created from the Commercial Draft IOF Package.

This CIP does not implement Engineering Change Sets. It establishes the authority surface that Engineering Change Sets will target later.

## Constitutional Authority Model

The lifecycle now resolves as:

Commercial Release Package

-> Draft IOF Package

-> Engineering Baseline

-> Engineering Package

-> Engineering Revision

-> Engineering Certification

-> Certified IOF Package

Commercial owns Commercial truth. Engineering owns Engineering truth. ScopeVersion remains a future Runtime authority after executed Service Order.

## Engineering Baseline Architecture

Added `EngineeringBaseline` as a reference-only, immutable repository artifact.

Canonical endpoint:

`/api/engineering/baselines`

Physical storage:

`server/data/engineering-baselines`

Authority fields:

- `engineeringBaselineId`
- `engineeringBaselineManifestId`
- `engineeringBaselineProjectionId`
- `engineeringBaselineHash`
- `authority = ENGINEERING_BASELINE_AUTHORITY`
- `repositoryType = ENGINEERING_BASELINE`
- `referenceOnly = true`
- `immutable = true`

## Immutable Intake Doctrine

Engineering Baseline is created from the Draft IOF Package during Commercial to Engineering submission.

The Baseline never duplicates:

- route geometry
- workbook body
- proposal body
- estimate body
- Draft IOF body
- map state
- React state
- runtime caches
- customer inventory

If an Engineering Baseline already exists with the same hash, it is reused. If the same Baseline ID is submitted with different immutable references, persistence fails.

## Repository Reference Model

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

Station Projection remains preserved through station graph, station authority, station object manifest, and projected object manifest references.

## Engineering Package Derivation

Commercial submit now performs:

1. Validate Commercial Package.
2. Freeze submitted Draft IOF Package revision.
3. Create Engineering Baseline.
4. Persist and reload Engineering Baseline.
5. Build Engineering Package from the Baseline.
6. Persist and reload Engineering Package.
7. Verify Baseline, Package, Revision, and repository references.

The Engineering Package now carries:

- `engineeringBaselineId`
- `engineeringBaselineHash`
- `engineeringBaselineManifestId`
- `engineeringBaselineProjectionId`
- `derivedFromBaseline = true`
- `engineeringRevisionId`
- `engineeringRevisionState = MIRRORS_ENGINEERING_PACKAGE`
- `engineeringAuthority = ENGINEERING_BASELINE`

For this sprint, Engineering Revision mirrors the Package until Engineering Change Sets are implemented.

## Certification Compatibility

Engineering Certification validates Engineering Baseline before projection begins.

The Engineering Certification UI displays:

- Engineering Baseline ID
- Engineering Baseline Hash
- Draft IOF Package ID
- Engineering Package ID
- Engineering Revision ID
- Engineering Authority
- Baseline Validation
- Repository References

Certified IOF Package output remains unchanged.

## Boundary Confirmation

Unchanged by CIP-027:

- Commercial Repository
- Commercial Revision
- Commercial Change Sets
- Commercial Release Package
- ScopeVersion
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence
- pricing calculations
- Proposal generation output
- Draft IOF generation output

ScopeVersion unchanged.

Commercial unchanged.

Pricing unchanged.

## Files Modified

- `server/routes/engineering-baselines.js`
- `server/routes/_shared.js`
- `server/index.js`
- `server/routes/engineering-packages.js`
- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-certification.js`
- `src/api/teralinxRuntime.ts`
- `src/repositories/commercialRepositories.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `server/data/engineering-baselines/.gitkeep`
- `cip027-engineering-baseline-authority-validation.mjs`
- `PD_006_ENGINEERING_BASELINE_DOCTRINE.md`
- `CIP_027_ENGINEERING_BASELINE_AUTHORITY_REPORT.md`

## Validation Results

Validation script:

`node cip027-engineering-baseline-authority-validation.mjs`

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
