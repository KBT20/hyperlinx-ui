# CIP-018A Engineering Repository Validation & Projection Hardening Report

Date: 2026-07-07

## Objective

Engineering Certification is now repository-backed. CIP-018A hardens restore and projection so incomplete repository or object data produces diagnostics instead of runtime crashes.

No Station Planning functionality, ScopeVersion creation, Marketplace, Control, Field, Operational Twin, or Operational Intelligence behavior was added.

## Repository Validation

Engineering Certification now decorates restored Engineering Packages with an `engineeringRepositoryValidation` readiness report before projection begins.

The report validates:

- Engineering Package
- Draft IOF Package
- Proposal
- Workbook
- Estimate
- Route Repository
- Object Validation
- Repository Integrity
- Ready for Station Planning
- Ready for Certification

Missing required repository references are reported as `FAIL`. Missing optional projection metadata is reported as `WARNING`.

## Projection Hardening

The Engineering Certification workspace now uses a guarded projection path:

1. Restore Engineering Package from Engineering Repository.
2. Validate repository references.
3. Safely schedule Engineering projection.
4. Validate projected objects.
5. Render readiness diagnostics.
6. Continue certification when warnings are non-blocking.

Missing object fields now display warnings such as:

`Missing Object Type. Object: OBJECT-12345. Layer: Undefined. Continuing certification.`

Projection failures render `Projection Validation Failure` and keep the repository-backed package open.

## Null Safety

The workspace projection path now avoids direct assumptions around partial object arrays and string lists in the object inspector and certification refresh path.

The guarded projection wrapper catches unexpected projection exceptions before React render.

## Baseline Graph Audit

The runtime already had `/api/inventory-graphs`; the client connectivity path expected `/api/baseline-graphs`.

Decision:

`/api/baseline-graphs` should exist as a compatibility alias for the inventory graph repository and return JSON, including an empty list when no graphs exist.

404 from baseline graph services no longer blocks Engineering Certification.

## Reasoning Fallback

Engineering Certification does not call `/v1/models` or `/api/reasoning/health`.

When reasoning is unavailable, the readiness report shows:

`Reasoning Unavailable. Using deterministic doctrine.`

## Files Modified

- `server/routes/engineering-certification.js`
- `server/routes/inventory-graphs.js`
- `src/api/dalConnectivity.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `cip018a-engineering-repository-validation-hardening-validation.mjs`
- `CIP_018A_ENGINEERING_REPOSITORY_VALIDATION_PROJECTION_HARDENING_REPORT.md`

## Validation Results

Validation script:

`node cip018a-engineering-repository-validation-hardening-validation.mjs`

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

## Google DFW Route 12

Validated against:

`ENG-PKG-DRAFT-IOF-ACCEPTED-PROPOSAL-google-1783379652948`

Result:

- Engineering Package restores from Engineering Repository.
- Required repository references pass.
- Route Repository remains the source for route geometry.
- Projection hardening is active.
- `/api/baseline-graphs` returns JSON.
- ScopeVersion remains blocked and was not created.
