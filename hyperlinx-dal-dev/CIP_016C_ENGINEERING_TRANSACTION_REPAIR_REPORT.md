# CIP-016C Engineering Transaction Repair Report

Date: 2026-07-07

## Objective

Repair the Commercial to Engineering repository transaction so Submit to Engineering commits a reference-only Engineering Package, verifies it from disk, updates Commercial status only after verification, and makes the package visible in Engineering Certification.

No ScopeVersion, Marketplace, Control, Field, Operational Twin, Operational Intelligence, or inventory behavior was added.

## Root Cause

The Engineering Package serializer was reference-only after CIP-016B, but the Commercial UI submit helper still sent the full Draft IOF Package object to the submit endpoint.

That meant the browser could attempt to serialize route geometry, workbook/proposal projections, Draft IOF content, map state, station data, and cached runtime state before the server-side Engineering Repository transaction began.

## Exact Failing Line

The failing pre-repair line was in `src/api/teralinxRuntime.ts`, inside `submitDraftIofPackageToEngineering`:

```ts
body: JSON.stringify(input),
```

The caller in `src/components/workspaces/GoogleRfpWorkspace.tsx` passed:

```ts
{ draftPackage: draftSource }
```

That combination made the client serialize the full Draft IOF Package during Submit to Engineering.

## Why Invalid String Length Occurred

`Invalid string length` occurred because `JSON.stringify(input)` could receive a very large or recursive Draft IOF Package payload. The Engineering Repository was never reached, so no Engineering Package JSON was committed and Engineering Certification had no pending package to discover.

## Before Transaction Flow

1. Commercial UI selected an approved Draft IOF Package.
2. UI called Submit to Engineering with the full Draft IOF object.
3. API helper ran `JSON.stringify(input)`.
4. Large serialization failed with `Invalid string length`.
5. The server transaction did not complete.
6. Engineering Repository JSON was not committed.
7. Engineering Certification showed no pending package.

## After Transaction Flow

1. Commercial UI validates readiness from local state.
2. API helper posts only a small reference transaction request.
3. Server loads the saved Draft IOF Package from the repository.
4. Server validates Proposal, Estimate, Workbook, Draft IOF Package, and Route Repository references.
5. Server builds a reference-only Engineering Package.
6. Server serializes only the Engineering Package.
7. Server writes Engineering Repository JSON.
8. Server reloads the Engineering Package from disk.
9. Server verifies all canonical Engineering Package references.
10. Commercial status updates to `SUBMITTED_TO_ENGINEERING`.
11. Response returns the Engineering Package ID and transaction log.
12. Engineering Certification discovers the pending Engineering Package from the Engineering Repository.

## Engineering Repository Commit Log

Engineering Repository commit log:

The transaction log now emits:

- STEP 1 Validate Commercial Package
- STEP 2 Build Engineering Package
- STEP 3 Serialize Engineering Package
- STEP 4 POST `/api/engineering/packages`
- STEP 5 Engineering API receives request
- STEP 6 Normalize Engineering Package
- STEP 7 Write Engineering Repository JSON
- STEP 8 Flush file
- STEP 9 Reload Engineering Package
- STEP 10 Verify Engineering Package
- STEP 11 Update Commercial status
- STEP 12 Return Engineering Package ID

Each failure response includes step, file, line number, object type, payload size, exception, stack trace, and the transaction log collected up to the failure.

## Repository Verification Log

Repository verification log:

After write, the server reloads the Engineering Package from `server/data/engineering-packages` and verifies:

- `engineeringPackageId`
- `opportunityId`
- `routeRepositoryId`
- `draftIOFPackageId`
- `proposalId`
- `estimateId`
- `commercialWorkbookId`
- `referenceHash`
- `repositoryType`
- `engineeringStatus`
- `referenceOnly`

Commercial status does not update until this verification succeeds.

## Engineering Certification Discovery Confirmation

Engineering Certification discovery confirmation:

Engineering Certification lists pending work from the Engineering Repository with:

`listEngineeringPackages({ openOnly: true })`

The queue resolves each Engineering Package reference back to its Draft IOF Package without route regeneration, estimate regeneration, workbook regeneration, proposal regeneration, inventory creation, or ScopeVersion creation.

## Files Modified

- `server/routes/_shared.js`
- `server/routes/engineering-packages.js`
- `server/routes/commercial-iof-packages.js`
- `src/api/teralinxRuntime.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `cip016c-engineering-transaction-validation.mjs`
- `CIP_016C_ENGINEERING_TRANSACTION_REPAIR_REPORT.md`

## Validation Results

Validation script:

`node cip016c-engineering-transaction-validation.mjs`

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
