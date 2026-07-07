# CIP-016B Engineering Package Serialization Repair Report

Date: 2026-07-07

## Objective

Repair Submit to Engineering so the Engineering Package is a small, reference-only handoff envelope.

Engineering Package is not the engineering design. Engineering design begins after Engineering Certification restores the package and resolves repository references.

## Root Cause

The `Invalid string length` failure was caused by Engineering Package reference validation stringifying full Commercial records.

The previous resolver used broad object scanning against loaded Opportunity and Draft IOF Package records. Those records can contain large route geometry, station arrays, workbook snapshots, proposal bodies, map state, caches, and other runtime projections. Even when the final Engineering Package was intended to be small, validation could attempt to serialize very large Commercial state during submit.

## Offending Fields Removed

The repaired serializer rejects or strips non-reference fields, including:

- `commercialGeometry`
- `convertedRuntimeGeometry`
- route geometry arrays
- station arrays
- map/Leaflet objects
- React state
- proposal body
- workbook body
- estimate body
- Draft IOF Package body
- Route Repository snapshot body
- Customer inventory body
- runtime caches
- circular or oversized payloads

## Final Engineering Package Schema

The persisted Engineering Package contains only:

- `engineeringPackageId`
- `customerId`
- `customerTwinId`
- `opportunityId`
- `routeRepositoryId`
- `proposalId`
- `commercialWorkbookId`
- `estimateId`
- `draftIOFPackageId`
- `productDoctrineId`
- `submittedBy`
- `submittedById`
- `submittedAt`
- `commercialStatus`
- `engineeringStatus`
- `serviceOrderState`
- `scopeVersionState`
- `stationPlanId`
- `futureInventoryManifestId`
- `certifiedIOFPackageId`
- `referenceHash`
- `referenceIntegrity`
- `authority`
- `repositoryType`
- `referenceOnly`
- `noScopeVersionCreation`
- `createdAt`
- `updatedAt`

`stationPlanId`, `futureInventoryManifestId`, and `certifiedIOFPackageId` remain null placeholders until future Engineering repositories create them.

## Repository Save Flow

1. Commercial validates Proposal, Estimate, Workbook, Draft IOF Package, and Route Repository readiness.
2. Commercial submits the Draft IOF Package ID.
3. Server builds `engineeringPackageRecordForRepository(input)`.
4. Serializer explicitly whitelists allowed fields.
5. Payload guard logs top-level keys, serialized byte size, and largest fields.
6. Payload guard rejects forbidden or oversized fields.
7. Engineering Package is saved to `server/data/engineering-packages`.
8. Engineering Package is reloaded to verify persistence.
9. Commercial Opportunity status is updated to `SUBMITTED_TO_ENGINEERING`.

## Repository Restore Flow

Engineering Certification opens the Engineering Package from the Engineering Repository, then resolves references:

1. Engineering Package
2. Draft IOF Package
3. Route Repository
4. Proposal
5. Estimate
6. Workbook

Commercial does not pass full objects directly into Engineering Certification.

## Payload Size

Reference-only threshold:

`16 KB`

Validation serializes a deliberately oversized input containing thousands of geometry and station records plus embedded proposal/workbook/estimate bodies. The serializer strips those fields and emits a reference-only record under the threshold.

Measured validation payload:

`1030 bytes`

## ScopeVersion and Inventory

ScopeVersion remains blocked:

`BLOCKED_UNTIL_SIGNED_SERVICE_ORDER`

CIP-016B does not create inventory. Future sprint work may add:

- Station Plan Repository
- Future Inventory Manifest Repository
- Certified IOF Package completion

## Files Modified

- `server/routes/engineering-packages.js`
- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-certification.js`
- `src/api/teralinxRuntime.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `cip016b-engineering-package-serialization-validation.mjs`
- `CIP_016B_ENGINEERING_PACKAGE_SERIALIZATION_REPAIR_REPORT.md`

## Validation Results

Validation script:

`node cip016b-engineering-package-serialization-validation.mjs`

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
