# CIP-018B Engineering Projection Validation Hardening Report

Date: 2026-07-07

## Objective

Repair Engineering Package projection so missing or undefined object properties produce deterministic validation warnings instead of JavaScript runtime exceptions.

Projection is deterministic. Validation establishes truth. Missing data produces diagnostics, not uncaught exceptions.

## Root Cause

The workspace-level projection boundary could catch projection failures, but the projection layer still contained unsafe normalization sites.

The failure:

`Cannot read properties of undefined (reading 'toUpperCase')`

was caused by downstream projection helpers calling `.toUpperCase()` on fields that can be absent in restored repository objects, especially object addressing and spine object layer fields.

## Unsafe Calls Located

Engineering projection uppercase paths were audited in:

- `src/engineering/EngineeringCertificationProjection.ts`
- `src/runtime/ConstitutionalAssemblyScheduler.ts`
- `src/scopeversion/ConstitutionalLayerIntegrity.ts`
- `src/scopeversion/ScopeVersionObjectFactory.ts`
- `src/scopeversion/ScopeVersionLifecycleGuard.ts`

The unsafe Engineering projection calls were:

- `objectAddressLayer(objectType, addressType)`
- `spineObjectLayer(objectType, objectClass, reviewStatus)`

ScopeVersion uppercase usage already normalizes through `String(...)` or guards non-string lifecycle state before uppercase.

## Validator Repair

Projection Validation now owns required projection field checks.

Added deterministic projection warnings for missing fields:

- `engineeringPackage.objects[index].objectType`
- `engineeringPackage.objectAddresses[index].objectType`
- `engineeringPackage.objectAddresses[index].addressType`
- `engineeringPackage.addressedReviewObjects[index].reviewType`
- `engineeringPackage.instantiatedSpineObjects[index].objectType`
- `engineeringPackage.instantiatedSpineObjects[index].objectClass`

Each warning records:

- property path
- missing field
- object ID when known
- layer when known
- default applied
- deterministic message

## Projector Repair

Projection helpers now normalize before uppercase:

- `normalizedProjectionString`
- `normalizedProjectionUpper`
- `requiredProjectionString`
- `requiredProjectionUpper`
- `projectionLabel`

Defaults applied:

- missing object type: `ENGINEERING_OBJECT`, `SPINE_OBJECT`, or `UNKNOWN`
- missing address type: `UNKNOWN`
- missing review type: `UNASSIGNED_REVIEW`
- missing object class: `UNKNOWN`

Projection continues with warnings.

## Runtime Diagnostics

The Engineering UI now imports projector warnings from `projection.projectionValidationWarnings` and displays them in the readiness panel.

The operator sees:

`Projection Validation missing required property engineeringPackage.objectAddresses[0].objectType. Default applied: UNKNOWN. Projection continued with warnings.`

instead of:

`Cannot read properties of undefined (reading 'toUpperCase')`

## Station Planning

Station Planning remains gated by repository validation and projection readiness.

Missing optional projection fields now warn. They do not crash projection and do not corrupt repository state.

## ScopeVersion

No ScopeVersion creation was added.

ScopeVersion normalization paths were audited for unsafe uppercase usage. Existing ScopeVersion uppercase calls are guarded or use string fallback conversion.

## Files Modified

- `src/engineering/EngineeringCertificationProjection.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `cip018b-engineering-projection-validation-hardening-validation.mjs`
- `CIP_018B_ENGINEERING_PROJECTION_VALIDATION_HARDENING_REPORT.md`

## Validation Results

Validation script:

`node cip018b-engineering-projection-validation-hardening-validation.mjs`

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

Git reported existing CRLF normalization warnings, but no whitespace errors.
