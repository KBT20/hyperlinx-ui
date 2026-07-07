# PD-002 Station Projection Doctrine

Date: 2026-07-07

## Doctrine

The station graph is the constitutional coordinate system of the Draft IOF Package.

Raw latitude and longitude are geographic evidence. They are not the execution authority for Engineering object placement.

Station Authority is the engineering placement authority.

## Submission Rule

A Draft IOF Package shall not be admitted into Engineering Certification until Commercial submission has restored the Route Repository and persisted:

- Measured Centerline
- Station Graph
- Station Authority IDs
- Station Object Manifest
- Projected Object Manifest

Every IOF object must be projected onto station authority before the Engineering Package is created.

## Required Station Record

Each station record must include:

- `stationId`
- `routeRepositoryId`
- `segmentId`
- `stationValue`
- `measureFeet`
- `coordinate`
- `bearing`
- `stationLabel`
- `authorityHash`

## Required Projected Object Record

Each projected IOF object must include:

- `objectId`
- `objectType`
- `routeRepositoryId`
- `segmentId`
- `stationId`
- `stationValue`
- `offset`
- `side`
- `orientation`
- `projectedCoordinate`
- `sourceObjectId`
- `engineeringDisposition`
- `projectionStatus`
- `projectionHash`

No object may remain coordinate-only.

## Engineering Movement

Engineering may move objects by changing:

- `stationValue`
- `offset`
- `side`
- `orientation`

The kernel recalculates coordinates from station authority. Engineering does not directly manipulate raw coordinates as placement truth.

## Repository Boundary

The Engineering Package is a reference-only handoff envelope. It references the station projection artifacts by ID and does not embed station graph bodies, route geometry arrays, proposal bodies, workbook bodies, estimate bodies, or Draft IOF Package bodies.

ScopeVersion remains blocked until executed Service Order authority exists.
