# SPRINT_20B_SPINE_STATION_AUTHORITY_REPORT

## Executive Summary

Sprint 20B establishes the constitutional engineering reference system that must exist before ScopeVersion authority.

The platform now creates and persists first-class spine and station authority artifacts inside the Draft IOF Package:

- `measuredSpine`
- `stationAuthority`
- `stationIndex`
- `stationToCoordinateMap`
- `objectStationAttachments`
- `stationIndexedGraph`

Engineering Certification now consumes those artifacts directly. Geometry can still render for compatibility, but PD-001 no longer treats geometry-only rendering as sufficient authority. A PASS now requires the persisted measured spine, complete station authority, object attachment status, and a station-indexed graph.

ScopeVersion remains out of scope for Sprint 20B.

## Audit Finding Addressed

The Sprint 20A audit concluded that IOF had route geometry, partial station arrays, fallback projection logic, and downstream station models, but did not yet possess one constitutional engineering reference system.

Sprint 20B addresses that finding by separating responsibilities:

- Geometry draws the route.
- Measured Spine establishes authority.
- Stations bring the route to life.
- Objects attach to stations.
- ScopeVersion governs only what has first been stationed.

## New Authority Artifacts

Contracts were added in `src/spine/SpineAuthorityContracts.ts`.

Required authority labels now exist:

- `MEASURED_SPINE_AUTHORITY`
- `STATION_AUTHORITY`
- `OBJECT_STATION_ATTACHMENT_AUTHORITY`
- `STATION_INDEXED_GRAPH_AUTHORITY`

The new engines are:

- `src/spine/MeasuredSpineEngine.ts`
- `src/spine/StationAuthorityEngine.ts`
- `src/spine/ObjectStationAttachmentEngine.ts`
- `src/spine/StationIndexedGraphEngine.ts`
- `src/spine/SpineAuthorityRegenerationEngine.ts`

## Measured Spine Model

`MeasuredSpineEngine` creates a measured linear spine from persisted route geometry.

It computes:

- `geometryHash`
- `routeLengthFeet`
- `routeLengthMiles`
- `coordinateCount`
- segment lengths
- cumulative start/end measures
- bearing
- geometry index boundaries
- cumulative measure index

Distance is computed along geometry using measured segment distance. Stations are not sampled by coordinate-array ratio.

## Station Authority Model

`StationAuthorityEngine` creates stations from the measured spine.

Defaults:

- `ENGINEERING`: 100 feet
- `MAJOR`: 5280 feet

Station rules now enforced:

- First station is `0+00`.
- Final station is always included.
- Measures are monotonic.
- Coordinates are interpolated by measured distance.
- Labels use standard station notation such as `0+00`, `1+00`, `10+00`, `1691+18`.
- Every station carries coordinate, lat, lng, measure, segment, station class, geometry hash, and authority.

## Object Attachment Model

`ObjectStationAttachmentEngine` assigns every object an attachment status.

Supported methods:

- `EXPLICIT_STATION`
- `EXPLICIT_MEASURE`
- `EXPLICIT_COORDINATE_NEAREST_STATION`
- `DERIVED_FROM_PARENT_SEGMENT`
- `DERIVED_FROM_DOCTRINE_RULE`
- `UNRESOLVED`

Unresolved objects remain visible for Engineering review, but PD-001 object attachment compliance fails unless the object is explicitly excepted.

## Station-Indexed Graph Model

`StationIndexedGraphEngine` creates a graph separate from the package dependency graph.

Edges now carry:

- `fromStationId`
- `toStationId`
- `fromMeasureFeet`
- `toMeasureFeet`
- `segmentId`
- `spineId`
- `routeId`
- `packageId`
- `geometryHash`

This graph is the station authority graph for Engineering Certification rendering and PD-001 compliance.

## Draft IOF Package Persistence Changes

`src/commercial/IOFPackageAssemblyEngine.ts` now persists:

- `measuredSpine`
- `stationAuthority`
- `stationIndex`
- `stationToCoordinateMap`
- `objectStationAttachments`
- `stationIndexedGraph`

Existing package artifacts remain:

- `geometry`
- `centerline`
- `centerlineRoute`
- `routeLength`
- `objects`
- `structures`
- `constraints`
- `productDoctrine`
- `quantitySummary`

Commercial still does not create ScopeVersion.

## Engineering Projection Changes

`src/engineering/EngineeringCertificationProjection.ts` now consumes:

- `measuredSpine`
- `stationAuthority`
- `stationIndexedGraph`
- `objectStationAttachments`

Engineering renders:

- centerline
- measured spine
- complete station authority
- major station labels
- station-indexed objects
- station-indexed graph edges

Projection fallbacks remain for older packages, but fallbacks do not create PD-001 authority.

## Doctrine Compliance Changes

PD-001 now distinguishes true authority from renderability.

Required PASS conditions:

- Geometry: PASS only if `measuredSpine.geometryHash` exists and `coordinateCount > 1`.
- Spine: PASS only if `measuredSpine.routeLengthFeet > 0`.
- Stationing: PASS only if `stationAuthority` exists and station count matches interval logic.
- Station-to-coordinate: PASS only if every authorized station has coordinate, lat, lng, measure, and label.
- Object attachment: PASS only if every object has an attachment method other than `UNRESOLVED`, or an approved exception.
- Graph: PASS only if `stationIndexedGraph` exists and all edges reference valid stations.

This removes false PASS conditions where geometry rendered but station authority was absent.

## Reroute Regeneration Core

`regenerateAuthorityFromGeometry()` was added in `src/spine/SpineAuthorityRegenerationEngine.ts`.

It deterministically creates:

- new measured spine
- new station authority
- new station index
- new station-to-coordinate map
- new station-indexed graph
- updated object station attachments
- regeneration audit record

No reroute UI was created.

## Validation Results

Commands run:

- `npx tsc --noEmit`: PASS
- `node sprint20b-spine-station-authority-validation.mjs`: PASS, 58 checks
- `npm run build`: PASS

Build note: Vite reported the existing large chunk warning after a successful build.

## Remaining Gaps Before ScopeVersion

Sprint 20B creates the authority artifacts required before ScopeVersion, but does not implement downstream lifecycle promotion.

Remaining gaps before ScopeVersion authority:

- Certified IOF Package must preserve the measured spine and station authority without mutation.
- Engineering redline acceptance must call the deterministic regeneration core.
- Accepted reroutes must regenerate object attachments and station-indexed graph before certification.
- ScopeVersion must refuse any Certified IOF Package missing station authority.
- Field and Operational Twin must consume station authority from ScopeVersion, not raw geometry.

## Constitutional Result

A Draft IOF Package now contains a measured spine and constitutional station authority.

Engineering Certification renders from those artifacts.

Every station has a coordinate and measure.

Every object has a station attachment status.

PD-001 distinguishes true station authority from geometry-only rendering.

ScopeVersion remains out of scope.
