# Sprint 20A Final Fix - Engineering Projection Rendering

## Issue

Engineering Certification received the Draft IOF Package and displayed package metadata, including route length, stations, graph nodes, objects, structures, and engineering status. The canvas could still show zero projected route coordinates.

The exact break was in the split between the length path and the geometry path:

- Engineering route length displayed from `projection.routeLength`.
- `projection.routeLength` is calculated from `quantitySummary.routeFeet` or `commercialSummary.routeFeet`.
- Map rendering depends on `routeCoordinatesFromPackage()` producing coordinates and `renderCertificationSpec()` adapting them into MapKernel primitives.
- Some persisted Draft IOF Package shapes were not explicitly covered by the extractor, so route length could be populated while renderable route geometry remained empty.
- The MapKernel spec carried primitives, but it did not also carry a canonical Draft IOF LineString Feature for audit and validation.

This was a projection extraction and MapKernel handoff issue. It was not a lifecycle issue, not a ScopeVersion issue, and not a baseline graph issue.

## Route Length Source

Engineering displays route length from:

```text
EngineeringCertificationWorkspace
        ↓
projection.routeLength
        ↓
quantitySummary.routeFeet || commercialSummary.routeFeet
```

This explains why route length can display even when `routeCoordinates.length === 0`.

## Geometry Source

Commercial Draft IOF Package assembly persists routed geometry as package authority:

- `geometry: { type: "LineString", coordinates }`
- `geometryCoordinateCount`
- `centerline`
- `centerlineRoute`
- `osrmRoute`
- `spine`

Engineering now treats those persisted package fields as the only route rendering authority. It does not regenerate geometry from proposal, OSRM, baseline graph discovery, customer inventory, or ScopeVersion.

## Projection Extraction Fix

`EngineeringCertificationProjection` now extracts route coordinates from all supported persisted Draft IOF Package shapes:

- `geometry.coordinates`
- `geometry.geometry.coordinates`
- `centerline`
- `centerline.coordinates`
- `centerline.geometry.coordinates`
- `centerlineRoute.coordinates`
- `centerlineRoute.geometry.coordinates`
- `osrmRoute.coordinates`
- `osrmRoute.geometry.coordinates`
- `productDoctrineAssembly.centerline`
- `productDoctrineAssembly.osrmRoute`
- `commercialDraftSnapshot.geometry`
- `customerRequests[].commercialDraftSnapshot.geometry`
- `proposedIofUnits[].geometry`
- `proposedIofUnits[].geometryReferences` when coordinates are embedded
- package `spine`
- route entries and route segments when they contain embedded geometry
- package `geometryReferences` when coordinates are embedded

Coordinates are normalized to `[lng, lat]`. Invalid coordinates are rejected.

Station points are no longer promoted into route geometry. Stations still render as station artifacts, but they cannot make PD-001 Geometry pass without a real projected route LineString.

## MapKernel Spec Fix

MapKernel expects:

```text
MapKernelRenderSpec[]
        ↓
spec.primitives[]
        ↓
line / point / label / polygon primitives
```

The Engineering Certification map still passes:

```tsx
<MapKernel specs={[projection.mapSpec]} />
```

The projection now also creates a canonical render Feature:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": []
  },
  "properties": {
    "source": "DRAFT_IOF_PACKAGE",
    "authority": "ENGINEERING_CERTIFICATION",
    "layer": "ENGINEERING_CENTERLINE"
  }
}
```

That Feature is carried on `mapSpec.features` for audit and validation. The same coordinates are adapted into MapKernel line primitives so the Engineering canvas renders immediately.

## PD-001 Fix

PD-001 Geometry now has only two deterministic outcomes:

```text
PASS
Coordinates > 1
Projected YES
```

or:

```text
FAIL
Coordinates 0
Projected NO
Reason: No geometry present in Draft IOF Package.
```

No PASS condition is allowed with zero projected route coordinates.

## Baseline Graph Dependency

Engineering Certification rendering does not import, call, wait on, or depend on `/api/baseline-graphs`.

The legacy baseline graph discovery path may still exist elsewhere as a non-blocking comparison or inventory discovery fallback. It is not part of Draft IOF Package rendering authority.

## Guarded Diagnostics

Guarded diagnostics are available with local storage:

```text
hyperlinx:debug:engineering-certification = 1
hyperlinx:debug:map-kernel = 1
```

When enabled, diagnostics report:

- package id
- route length feet
- package geometry coordinate count
- extracted route coordinate count
- map spec feature count
- map spec primitive count
- MapKernel received feature count

## Verification

Passed:

- `node sprint20a-engineering-projection-rendering-validation.mjs`
- `npx tsc --noEmit`
- `npm run build`

The validation script asserts:

- Commercial assembly persists a 1,615-coordinate Draft IOF Package fixture.
- Engineering projection extracts all 1,615 coordinates.
- PD-001 Geometry PASS occurs only with more than one projected coordinate.
- PD-001 Geometry FAIL occurs with zero route coordinates.
- Station-only packages do not promote stations into route geometry.
- MapKernel-compatible spec contains one LineString Feature with 1,615 coordinates.
- Engineering Certification rendering does not call or require `/api/baseline-graphs`.
