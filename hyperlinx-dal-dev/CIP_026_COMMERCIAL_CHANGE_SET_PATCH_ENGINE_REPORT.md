# CIP-026 Commercial Change Set Patch Engine Report

Date: 2026-07-08

## Objective

Implement the constitutional Commercial Change Set model.

Commercial Repository remains immutable. Commercial Revision is the editable authority. Commercial Change Sets are the only new mechanism for representing Commercial Revision edits.

Engineering Change Sets were not implemented.

## Constitutional Doctrine

Commercial now follows:

Commercial Repository

-> Commercial Revision

-> Commercial Change Set(s)

-> Patch Engine

-> Commercial Revision Projection

-> Workbook / Estimate / Proposal / Commercial Release Package / Draft IOF Package

No Commercial component should treat mutable workspace state as repository truth.

## Patch Architecture

Added:

- `CommercialChangeSet`
- `CommercialPatch`
- `CommercialPatchEngine`
- `CommercialPatchValidator`
- `CommercialRevisionProjection`
- `CommercialRevisionHistory`
- `CommercialPatchReplay`

Patch records are whitelisted to:

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

No repository objects, geometry arrays, proposal bodies, workbook bodies, estimate bodies, Draft IOF bodies, map objects, or runtime caches are persisted in patches.

## Revision Architecture

Commercial Revision remains reference-only, but it now carries Change Set projection metadata:

- `changeSetIds`
- `activePatchCount`
- `appliedPatchCount`
- `repositoryHash`
- `revisionHash`
- `projectionHash`
- `patchReplayTimeMs`
- `projectionTimeMs`

The revision hash is rebuilt from repository references plus active Change Set patch identity.

## Projection Architecture

`buildCommercialRevisionProjection` rebuilds a disposable projection from:

- immutable Commercial Repository references
- Commercial Revision references
- active Commercial Change Sets

The projection exposes:

- construction percentages
- rates
- engineering assumptions
- risk records
- route edit records
- commercial impact summaries
- replay/projection diagnostics

## Replay Strategy

Patch replay is ordered by patch creation timestamp.

Discarded and inactive Change Sets are ignored.

Replay never mutates repository truth and never recalculates pricing formulas.

## Comparison Strategy

Compare Revision compares projected patch results only:

- construction percentages
- rates
- assumptions
- costs
- revenue
- proposal impact
- engineering impact

Raw JSON is not compared.

## UI Integration

The existing Route Edit Session controls remain the operator workflow.

Existing edit actions now also stage Commercial Change Set patches. Save Revision persists the Change Set through the Commercial Change Set Repository. Compare Revision, Discard Revision, and Restore Original operate against Commercial Revision Projection semantics.

No modal editor or separate edit mode was added.

## Repository API

Added:

- `GET /api/commercial/change-sets`
- `GET /api/commercial/change-sets/:changeSetId`
- `POST /api/commercial/change-sets`
- `POST /api/commercial/change-sets/:revisionId/replay`
- `POST /api/commercial/change-sets/:revisionId/compare`
- `POST /api/commercial/change-sets/:revisionId/discard`
- `POST /api/commercial/change-sets/:revisionId/restore-original`

Physical storage:

`server/data/commercial-change-sets`

## Boundary Confirmation

Not modified by CIP-026:

- ScopeVersion
- Engineering Package
- Engineering Certification authority
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence
- pricing formulas
- proposal calculations

Commercial-side Proposal and Draft IOF paths now receive Commercial Revision projection metadata without changing output calculations.

## Validation Results

Validation script:

`node cip026-commercial-change-set-validation.mjs`

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
