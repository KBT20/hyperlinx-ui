# CIP-025 Commercial Revision Authority Report

Date: 2026-07-08

## Objective

Introduce explicit Commercial Revision authority before Commercial Change Sets are implemented.

This refactor does not implement Change Sets. It establishes the constitutional surface that future Change Sets will target.

## Current Authority Audit

Before CIP-025, Commercial behaved as:

Opportunity -> Commercial Route Repository -> Estimate -> Workbook -> Proposal -> Draft IOF Package

That allowed mutable workspace state and proposal projections to act as de facto revision authority.

## Repository Authority

Commercial Repository truth remains immutable and repository-owned.

It continues to contain Opportunity, Route Repository, Estimate references, Workbook references, commercial assumptions, and product doctrine references.

Repository truth is not edited directly by the new Revision or Release package serializers.

## Commercial Revision Architecture

Added `CommercialRevision` as a reference-only editable commercial authority.

Stored at:

`server/data/commercial-revisions`

Canonical endpoint:

`/api/commercial/revisions`

The serializer uses an explicit whitelist and rejects non-reference fields. It does not persist route geometry, proposal bodies, workbook bodies, estimate bodies, pricing output, or workspace state.

## Commercial Release Package Architecture

Added `CommercialReleasePackage` as the frozen commercial handoff.

Stored at:

`server/data/commercial-release-packages`

Canonical endpoint:

`/api/commercial/release-packages`

The Release Package references:

- Commercial Revision
- Route Repository
- Estimate
- Workbook
- Proposal
- Product Doctrine
- Commercial Doctrine
- Revision Hash
- Evidence References

It is reference-only, immutable, and does not duplicate Commercial Repository truth.

## Proposal Authority Flow

Proposal save now records:

Commercial Revision -> Proposal Projection -> Proposal Repository

Proposal pricing, workbook, and visible proposal output are preserved. The repository record gains authority references and diagnostics only.

## Draft IOF Authority Flow

Draft IOF assembly now records:

Commercial Revision -> Commercial Release Package -> Draft IOF Package

The existing Draft IOF assembly payload is preserved, but the package now carries the Release Package reference and authority diagnostics.

## Constitutional Boundary Validation

Preserved:

- ScopeVersion remains unchanged.
- Marketplace remains unchanged.
- Control remains unchanged.
- Field remains unchanged.
- Twin remains unchanged.
- Operational Intelligence remains unchanged.
- Pricing calculations remain unchanged.
- Proposal output remains unchanged.
- Workbook output remains unchanged.
- Draft IOF output remains unchanged except authority metadata.

## Engineering Compatibility Verification

Engineering Package remains reference-only and now carries:

- `commercialRevisionId`
- `commercialReleasePackageId`
- `commercialRevisionHash`
- `commercialReleaseHash`

Engineering Certification authority is not changed. It still opens Engineering Repository packages and restores Draft IOF / Route / Proposal / Estimate / Workbook references through repository resolution.

## Files Modified

- `server/routes/commercial-revisions.js`
- `server/routes/_shared.js`
- `server/index.js`
- `server/routes/proposal-drafts.js`
- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-certification.js`
- `server/routes/engineering-packages.js`
- `src/api/teralinxRuntime.ts`
- `src/repositories/commercialRepositories.ts`
- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `cip025-commercial-revision-authority-validation.mjs`
- `CIP_025_COMMERCIAL_REVISION_AUTHORITY_REPORT.md`

## Validation Results

Validation script:

`node cip025-commercial-revision-authority-validation.mjs`

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
