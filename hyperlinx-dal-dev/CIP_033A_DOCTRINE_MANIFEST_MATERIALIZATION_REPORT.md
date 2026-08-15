# CIP-033A Doctrine Manifest Materialization Report

Date: 2026-07-09

## Objective

Verify and harden Doctrine Object Instantiation Engine materialization so every Product Doctrine engineering object is persisted through the Draft IOF Package and restored through the Engineering Package handoff.

## Root Finding

The Doctrine Object Instantiation Engine already produced materialized doctrine objects, station sequencing, derived spans, and linear asset attachments.

The weak point was the handoff projection path. Server-side station projection could still build its Station Object Manifest from mixed legacy lists such as `objects`, `structures`, or `proposedIofUnits`, and could fall back to a synthetic route-centerline object. That allowed placeholder rows to survive even when the Doctrine Object Manifest existed.

## Materialization Contract

Each Doctrine-instantiated object now carries direct handoff fields:

- deterministic `objectId`
- `doctrineObjectType`
- `stationAddress`
- `geographicCoordinate`
- `parentSpanId`
- `parentRouteId`
- `executionSequenceId`
- `closeSequenceId`
- `paymentSequenceId`
- `dependencyList`
- `evidenceRequirements`
- `currentLifecycleState`
- `engineeringAuthority`
- `doctrineQuantitySource`

## Draft IOF Package

Draft IOF station projection now requires the Doctrine Object Manifest.

It reads materialized objects from:

- `doctrineInstantiatedObjects`
- `doctrineObjectManifest.instantiatedObjects`
- `engineeringObjectManifest.instantiatedObjects`

It no longer creates placeholder station objects when the manifest is missing.

## Station Object Manifest

The Station Object Manifest now records:

- Doctrine Object Manifest ID
- materialized doctrine object count
- doctrine quantity schedule count
- station object manifest count
- quantity schedule match flag
- materialization authority

Submission readiness fails if the Station Object Manifest count does not match the Product Doctrine materialized object count.

## Engineering Package

The Engineering Package remains reference-only.

It now carries manifest references and counts:

- `doctrineObjectManifestId`
- `engineeringObjectManifestId`
- `doctrineMaterializedObjectCount`
- `stationObjectManifestCount`
- `doctrineQuantityScheduleCount`
- `doctrineManifestAuthority`

Repository reference integrity verifies those values against the restored Draft IOF Package.

## Engineering Projection

Engineering Certification projection now consumes objects only after a Doctrine Object Manifest exists.

If the manifest is missing, projection returns no engineering objects and emits a projection validation warning instead of falling back to proposed units.

## Spine Object Catalog

The Spine Object Catalog now displays actual materialized doctrine objects from the manifest.

Legacy Audit Object Manifest placeholder rows are hidden whenever materialized doctrine objects are present.

## Certification Gate

Engineering Certification already blocks certification when:

- Doctrine Object Manifest is missing
- Doctrine Object Manifest validation fails
- quantity placement is missing
- station sequencing is missing or invalid
- derived spans are missing
- linear asset span attachments are missing

## Unchanged Areas

CIP-033A does not change:

- pricing
- ScopeVersion
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence
- Product Doctrine quantity logic

## Files Modified

- `src/products/DoctrineObjectInstantiationEngine.ts`
- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-packages.js`
- `src/engineering/EngineeringCertificationProjection.ts`
- `src/components/engineering/SpineObjectCatalogPanel.tsx`
- `cip033a-doctrine-manifest-materialization-validation.mjs`
- `CIP_033A_DOCTRINE_MANIFEST_MATERIALIZATION_REPORT.md`

## Validation Results

Validation script:

`node cip033a-doctrine-manifest-materialization-validation.mjs`

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

`node cip033-doctrine-quantity-placement-station-sequencing-validation.mjs`

Result:

`PASS`
