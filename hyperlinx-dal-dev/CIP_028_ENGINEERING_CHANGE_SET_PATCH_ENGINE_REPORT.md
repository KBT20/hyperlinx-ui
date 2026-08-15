# CIP-028 Engineering Change Set Patch Engine Report

Date: 2026-07-08

## Objective

Implement the constitutional Engineering Change Set model.

Engineering Baseline remains immutable. Engineering Revision is now the editable engineering authority. Engineering Change Sets are the only mechanism for modifying Engineering Revision.

## Engineering Constitutional Doctrine

Engineering now follows:

Engineering Baseline

-> Engineering Change Sets

-> Engineering Patch Engine

-> Engineering Revision Projection

-> Engineering Revision

-> Engineering Certification

-> Certified IOF Package

Engineering Package remains an intake container. It is not the mutable engineering authority.

## Patch Architecture

Added:

- `EngineeringChangeSet`
- `EngineeringPatch`
- `EngineeringPatchEngine`
- `EngineeringPatchValidator`
- `EngineeringRevisionProjection`
- `EngineeringRevisionHistory`
- `EngineeringPatchReplay`

Supported patch domains:

- stationing
- objects
- engineering constraints
- fiber engineering
- evidence and review status

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

No Engineering Package objects, geometry arrays, station arrays, proposal bodies, workbook bodies, Draft IOF bodies, runtime caches, or ScopeVersion state are persisted in Engineering Change Sets.

## Revision Architecture

Engineering Revision is rebuilt from immutable Engineering Baseline references plus active Engineering Change Sets.

The revision projection reports:

- Engineering Baseline Hash
- Engineering Revision Hash
- Active Patch Count
- Applied Patch Count
- Replay Time
- Projection Time
- Certification Readiness

Discarded and inactive Change Sets are ignored during projection.

## Replay Strategy

Patch replay is deterministic.

Patches are sorted by `createdAt` and projected into bounded domains:

- stationing
- object changes
- constraints and exceptions
- fiber engineering
- evidence

Replay never mutates Engineering Baseline, Engineering Package, Draft IOF Package, Commercial truth, pricing, station projection, or ScopeVersion.

## Certification Integration

Engineering Certification now submits an Engineering Revision projection with certification.

Certified IOF Package references:

- Engineering Baseline
- Engineering Revision
- Engineering Change Sets
- Engineering Certification Evidence
- Certification Hash

The certification server resolves Engineering Change Sets from the Engineering Change Set Repository when needed and records Engineering Revision authority on the Certified IOF Package.

## UI Integration

The existing Engineering Certification UI remains in place.

Current engineering actions stage Engineering Change Set patches:

- object budget/configuration changes
- engineering budget approval
- constraint creation
- object movement
- route redline placement
- doctrine exception creation

The operator does not browse repositories manually.

## Protected Boundaries

Not modified by CIP-028:

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

## Files Modified

- `server/routes/engineering-change-sets.js`
- `server/routes/_shared.js`
- `server/index.js`
- `server/routes/engineering-certification.js`
- `src/api/teralinxRuntime.ts`
- `src/repositories/commercialRepositories.ts`
- `src/engineeringChangeSet/EngineeringChangeSet.ts`
- `src/engineeringChangeSet/EngineeringPatchValidator.ts`
- `src/engineeringChangeSet/EngineeringPatchEngine.ts`
- `src/engineeringChangeSet/index.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `server/data/engineering-change-sets/.gitkeep`
- `cip028-engineering-change-set-validation.mjs`
- `PD_006_ENGINEERING_CHANGE_SET_DOCTRINE.md`
- `CIP_028_ENGINEERING_CHANGE_SET_PATCH_ENGINE_REPORT.md`

## Validation Results

Validation script:

`node cip028-engineering-change-set-validation.mjs`

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
