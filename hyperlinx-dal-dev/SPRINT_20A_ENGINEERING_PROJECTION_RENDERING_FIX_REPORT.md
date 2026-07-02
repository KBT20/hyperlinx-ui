# Sprint 20A Fix - Engineering Projection Rendering

## Issue

Engineering Certification could receive a Draft IOF Package, but the map could appear blank when the broader DAL runtime attempted `/api/baseline-graphs` and received `404`.

## Fix

- Commercial Draft IOF Package assembly now persists routed geometry as a certified package artifact:
  - `geometry: { type: "LineString", coordinates }`
  - `geometryCoordinateCount`
  - `centerline`
  - `centerlineRoute`
  - `spine`
- Engineering Certification rendering now depends on `EngineeringCertificationProjection` only.
- The projection extracts package-native geometry from:
  - canonical `geometry.coordinates`
  - `centerline`
  - `centerlineRoute`
  - `osrmRoute`
  - product doctrine assembly centerline
  - `spine`
  - route segments
  - station coordinates
  - encoded geometry references
  - dependency graph geometry when present
- The MapKernel spec now includes package-native centerline, spine, graph edges, stations, objects, and constraints.
- PD-001 geometry now deterministically fails when zero coordinates are projected and passes only when package geometry projects.
- Baseline graph APIs are not imported or called by the Engineering Certification render path.

## Verification

- `npx tsc --noEmit`
- `node sprint20a-engineering-projection-rendering-validation.mjs`
- `npm run build`

The validation script assembles a 1,615-coordinate OSRM fixture, confirms those coordinates are persisted in the Draft IOF Package, and confirms Engineering projects all 1,615 coordinates.
