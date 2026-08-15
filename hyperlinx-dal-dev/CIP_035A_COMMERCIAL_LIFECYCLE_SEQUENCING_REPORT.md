# CIP-035A Commercial Lifecycle Sequencing Report

Date: 2026-07-09

## Objective

Repair Commercial lifecycle sequencing so Initial IOF Package Assembly runs only after Commercial constitutional authorities exist.

This sprint changes sequencing only. It does not change Product Doctrine, quantity logic, pricing, route generation, Engineering Certification, ScopeVersion, Marketplace, Control, Field, Twin, or Operational Intelligence.

## Root Cause

Automatic IOF Package Assembly could start immediately after Route Repository commit.

The Draft IOF reference-only serializer correctly blocked the save because the preview did not yet have:

`commercialRevisionId`

That produced:

`Draft IOF reference-only save blocked: missing commercialRevisionId`

## Repaired Sequence

The Commercial flow is now:

```text
Generate Route
-> Commit Route Repository
-> Create or restore Commercial Revision
-> Create or restore Commercial Release Package
-> Automatic IOF Package Assembly
-> Persist Repository References
-> Save Draft IOF Package
-> Commercial Ready
```

## Commercial Revision Authority

The Commercial workspace now resolves Commercial Revision authority before Draft IOF save.

If an existing revision matches the Route Repository / Opportunity / Proposal, it is restored.

If none exists, the workspace creates one through the existing Commercial Revision repository API.

The revision carries:

- `commercialRevisionId`
- `revisionId`
- `repositoryId`
- `routeRepositoryId`
- `proposalId`
- `estimateId`
- `workbookId`
- `revisionHash`
- `authority: COMMERCIAL_REVISION`

## Commercial Release Package Authority

After Commercial Revision exists, the workspace resolves Commercial Release Package authority.

If an existing release package matches the revision and route, it is restored.

If none exists, the workspace creates one through the existing Commercial Release Package repository API.

The release package carries:

- `commercialReleasePackageId`
- `commercialRevisionId`
- `routeRepositoryId`
- `proposalId`
- `workbookId`
- `estimateId`
- `releaseHash`
- `authority: COMMERCIAL_RELEASE_PACKAGE`

## Automatic IOF Assembly

Automatic IOF Assembly now waits for:

- Route Repository: PASS
- Commercial Revision: PASS
- Commercial Release Package: PASS

Only then does it save the Draft IOF Package.

The existing Product Doctrine assembly, object instantiation, station placement, span derivation, linear asset attachment, and artifact persistence paths are unchanged.

## Single Assembly Rule

Automatic assembly is keyed by:

`routeRepositoryId`

If the route already has a Draft IOF Package with Commercial Revision and Commercial Release references, the workspace restores that package and skips reassembly.

## Reference-Only Gate

Draft IOF reference-only save now requires both:

- `commercialRevisionId`
- `commercialReleasePackageId`

The Draft IOF Package still stores repository references only and does not embed route geometry, workbook rows, projected objects, station graphs, or lifecycle diagnostics as truth.

## Visible Lifecycle Panel

Added a Commercial Lifecycle panel showing:

- Route Repository
- Commercial Revision
- Commercial Release Package
- Automatic IOF Assembly
- Draft IOF Save

Blocked rows show:

- missing authority
- missing ID
- blocking prerequisite
- repair recommendation

## Files Modified

- `src/api/teralinxRuntime.ts`
- `src/repositories/commercialRepositories.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `cip035-happy-path-scopeversion-validation.mjs`
- `cip035a-commercial-lifecycle-sequencing-validation.mjs`
- `CIP_035A_COMMERCIAL_LIFECYCLE_SEQUENCING_REPORT.md`

## Validation Results

Validation script:

`node cip035a-commercial-lifecycle-sequencing-validation.mjs`

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

Regression validation:

`node cip035-happy-path-scopeversion-validation.mjs`

Result:

`PASS`
