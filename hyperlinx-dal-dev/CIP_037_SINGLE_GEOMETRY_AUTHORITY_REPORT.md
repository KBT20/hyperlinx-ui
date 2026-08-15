# CIP-037 Single Geometry Authority Report

Date: 2026-07-09

## Objective

Eliminate duplicate geometry throughout the IOF lifecycle.

The lifecycle now treats `MeasuredCenterline` as the single geometry authority for projected objects, projected spans, Commercial map rendering, Engineering projection, Certified IOF references, and ScopeVersion promotion gates.

## Constitutional Geometry Rule

The immutable sequence is:

```text
Customer Addresses
-> OSRM Route
-> Measured Centerline
-> Station Spine
-> Doctrine Math
-> Object Placement
-> Projected Spans
-> Draft IOF Package
-> Engineering
-> Certified IOF Package
-> ScopeVersion
-> Field
-> As-Built
-> Twin
```

Everything downstream references the same measured spine. No projected span now carries independent coordinate arrays.

## Measured Centerline Authority

`DoctrineProjectionEngine` now emits `DOCTRINE_PROJECTION_VERSION = "37.0"`.

The `measuredCenterline` artifact stores the authoritative measured spine:

- `measuredCenterlineId`
- `spineId`
- `geometryHash`
- `routeLengthFeet`
- `segments`
- `cumulativeMeasureIndex`
- `singleGeometryAuthority: true`

Draft IOF package persistence strips duplicate geometry fields from the package envelope and persists the measured centerline as an immutable projection artifact.

## Object Placement

Every projected doctrine object carries:

- `objectId`
- `measure`
- `coordinate`
- `stationAddress`
- `coordinateAuthority: "MEASURED_CENTERLINE"`

Coordinates are resolved through measured-spine math and remain attached to the object as the resolved address, not as an independent route geometry.

## Span Authority

Projected spans now carry:

- `spanId`
- `measuredCenterlineId`
- `startMeasure`
- `endMeasure`
- `startObjectId`
- `endObjectId`
- `containedAssets`
- `dependencies`
- `renderAuthority: "MEASURED_CENTERLINE_CLIP"`
- `independentGeometryProhibited: true`

Projected spans no longer store coordinate arrays.

## Rendering

Added render helpers:

- `src/rendering/MeasuredSpineRenderer.ts`
- `src/rendering/ProjectedSpanRenderer.ts`

Commercial and Engineering span rendering now clips the measured centerline:

```text
renderSpan(measuredCenterline, span)
```

Commercial render order is:

```text
Measured Spine
-> Highlighted Span
-> Doctrine Objects
-> Labels
```

The previous projected-span line is now a highlighted portion of the measured spine.

## Geometry Integrity Diagnostics

Commercial and Engineering now display visible Geometry Authority diagnostics:

- Geometry Authority
- Measured Centerline
- Independent Geometry
- Projected Objects
- Projected Spans
- Objects On Spine
- Maximum Drift
- Independent Span Geometry
- Commercial render validation
- Engineering render validation
- Field render validation
- Twin render validation

Expected healthy state:

```text
Measured Centerline: PASS
Independent Geometry: 0
Objects On Spine: N / N
Maximum Drift: 0.00 ft
Independent Span Geometry: 0
```

## Commercial Projection Surface

The Commercial map projection surface was restored after the geometry merge.

Commercial now exposes visible toggles for:

- Measured Spine
- Projected Spans
- Projected Objects
- Station Graph
- Object Address

Projected Objects, Projected Spans, Station Graph, and Object Address overlays render independently. Projected Spans and Station Graph edges continue to render by clipping the measured centerline instead of carrying independent geometry.

Commercial hover and selected-feature payloads now include:

- doctrine
- quantity source
- station
- measure
- lifecycle state
- execution sequence
- labor template
- material template
- evidence template
- dependencies
- payment sequence
- close sequence

Commercial Projection Diagnostics now renders separately from Commercial Doctrine Diagnostics.

## Certification Gate

Engineering Certification now blocks when:

- Geometry Authority diagnostics are missing.
- Geometry Authority is not `PASS`.
- Any projected span contains independent geometry.
- Maximum drift is greater than zero.
- Any object is not on the measured spine.

## ScopeVersion Gate

ScopeVersion promotion now refuses promotion when Geometry Authority is not `PASS`.

ScopeVersion records carry geometry authority references:

- `measuredCenterlineId`
- `projectedObjectManifestId`
- `stationGraphId`
- `stationAuthorityIds`
- `geometryAuthority: "MEASURED_CENTERLINE"`
- `geometryAuthorityDiagnostics`

ScopeVersion does not import or run Doctrine Projection math.

## Unchanged Areas

CIP-037 does not change:

- Product Doctrine quantity logic
- pricing formulas
- Commercial Change Sets
- Engineering Change Sets
- Marketplace
- Control
- Field workflows
- Operational Intelligence

## Files Modified

- `src/products/DoctrineProjectionEngine.ts`
- `src/rendering/MeasuredSpineRenderer.ts`
- `src/rendering/ProjectedSpanRenderer.ts`
- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/api/teralinxRuntime.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx`
- `src/components/workspaces/proposednetwork/ProposedGraphInspectorPanel.tsx`
- `src/engineering/EngineeringCertificationProjection.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/styles.css`
- `server/routes/_shared.js`
- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-packages.js`
- `server/routes/engineering-certification.js`
- `server/routes/certification-ledger.js`
- `server/scopeversion-authority-engine.js`
- `cip034-doctrine-projection-engine-validation.mjs`
- `cip034b-spine-math-object-placement-validation.mjs`
- `cip037-single-geometry-authority-validation.mjs`
- `cip037-commercial-projection-surface-validation.mjs`
- `CIP_037_SINGLE_GEOMETRY_AUTHORITY_REPORT.md`

## Validation Results

Validation script:

`node cip037-commercial-projection-surface-validation.mjs`

Result:

`PASS`

Geometry validation script:

`node cip037-single-geometry-authority-validation.mjs`

Result:

`PASS`

TypeScript:

`npx tsc --noEmit -p tsconfig.json`

Result:

`PASS`

Regression validation:

`node cip034-doctrine-projection-engine-validation.mjs`

Result:

`PASS`

`node cip034b-spine-math-object-placement-validation.mjs`

Result:

`PASS`

`node cip036-osrm-completion-iof-assembly-commercial-map-projection-validation.mjs`

Result:

`PASS`

`node cip035-happy-path-scopeversion-validation.mjs`

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
