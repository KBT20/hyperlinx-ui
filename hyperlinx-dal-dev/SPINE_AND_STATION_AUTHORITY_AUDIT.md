# SPINE_AND_STATION_AUTHORITY_AUDIT

Constitutional Engineering Audit: Spine and Station Authority

Audit scope: current platform state only. This document does not propose new features and does not describe a target design. It identifies what exists today in the route geometry, spine, station, object, projection, and rendering chain.

## Constitutional Principle

Geometry draws the route.

Measured Spine establishes authority.

Stations bring the route to life.

Objects attach to stations.

ScopeVersion governs only what has first been stationed.

## Executive Finding

IOF currently contains several partial engineering reference mechanisms:

- Product Doctrine creates a spine record and station records for Point-to-Point Long Haul packages.
- Commercial package assembly persists geometry, centerline, centerline route, spine, stations, graph, objects, and quantities when those artifacts are supplied by doctrine or commercial draft inputs.
- Engineering Certification projects Draft IOF Package geometry, station records, objects, constraints, and route segments into `MapKernel`.
- A dedicated `RouteStationingEngine` exists under ScopeVersion logic and can generate interpolated stations from a certified route.
- Corridor generation logic can create a `StationedCorridor` with stations, segments, objects, and takeoff from a centerline.

Those mechanisms are not one continuous constitutional engineering reference system. The active Draft IOF Package to Engineering Certification pipeline does not guarantee a persistent station-to-coordinate mapping, does not guarantee every object has an explicit persisted station reference, and does not currently regenerate stationing when an Engineering Certification route redline is recorded.

## Pipeline Trace

```text
Route Geometry
        |
        v
Spine
        |
        v
Station Generation
        |
        v
Station Persistence
        |
        v
Object Attachment
        |
        v
Engineering Projection
        |
        v
Map Rendering
```

### Route Geometry

Commercial route geometry enters the package through:

- `src/commercial/CommercialCorridorDraftEngine.ts`
  - `buildCommercialCorridorDraft()`
  - Converts OSRM route result geometry into DAL coordinates.
  - Persists route miles, route feet, route segments, station count, and station interval from transparent estimating quantities.

- `src/products/pointToPointLongHaulDoctrine.ts`
  - `assemblePointToPointLongHaulDoctrine()`
  - Reads `input.osrmRoute.geometry` into `centerline`.
  - Uses `routeFeet` and `routeMiles` from the OSRM route.

- `src/commercial/IOFPackageAssemblyEngine.ts`
  - `assembleDraftIofPackage()`
  - Selects `packageCenterline` from product doctrine centerline, commercial draft geometry, quick quote geometry, or commercial candidate geometry.
  - Persists:
    - `geometry: LineString`
    - `geometryCoordinateCount`
    - `centerline`
    - `centerlineRoute`
    - `osrmRoute`
    - `route`

Current state: route geometry is persisted as a Draft IOF Package artifact.

### Spine

The spine is created in two places.

Primary creation:

- `src/products/pointToPointLongHaulDoctrine.ts`
  - `assemblePointToPointLongHaulDoctrine()`
  - Creates a `ProductDoctrineSpine` when A site, Z site, centerline, and route feet exist.
  - The spine contains:
    - `spineId`
    - `topology`
    - `networkClass`
    - `aSiteId`
    - `zSiteId`
    - `centerlineId`
    - `routeMiles`
    - `routeFeet`
    - `noScopeVersionCreation`

Fallback creation:

- `src/commercial/IOFPackageAssemblyEngine.ts`
  - `assembleDraftIofPackage()`
  - Uses `doctrineAssembly?.spine` if present.
  - Otherwise creates a fallback spine object from `packageCenterline` with `spineId`, `topology`, `networkClass`, `centerlineId`, `routeMiles`, and `routeFeet`.

Important limitation: the product doctrine spine contract is primarily metadata. It does not itself carry the authoritative station index, measure system, or spine geometry as a complete linear referencing object. In Engineering rendering, the visible "Draft IOF spine" is drawn from `projection.routeCoordinates`, not from a separate spine geometry authority.

### Station Generation

There are three station-generation mechanisms in the codebase. They do not currently form one constitutional system.

#### Product Doctrine Stations

Location:

- `src/products/pointToPointLongHaulDoctrine.ts`
  - `buildStations()`
  - Called by `assemblePointToPointLongHaulDoctrine()`

Algorithm:

- `stationCount = Math.max(2, Math.floor(routeFeet / stationIntervalFeet) + 1)`
- Default interval is `input.stationIntervalFeet ?? 5280`
- `stationFeet = index * stationIntervalFeet`, except the final station is set to `routeFeet`
- `milepost = stationFeet / 5280`
- Coordinate is selected by `coordinateAt(centerline, ratio)`

Constitutional note: `coordinateAt()` chooses a coordinate by ratio across the centerline coordinate array. It does not interpolate by measured distance along the route. This means station coordinates can reflect coordinate-array distribution rather than measured route stationing.

#### Commercial Draft Fallback Stations

Location:

- `src/commercial/IOFPackageAssemblyEngine.ts`
  - `buildStationObjects()`

Algorithm:

- Uses `draft.stationCount`
- Uses `draft.stationIntervalFeet`
- Creates station records with:
  - `stationId`
  - `routeId`
  - `stationIndex`
  - `stationFeet`
  - `milepost`
  - `source`
  - `authority`

Important limitation: fallback station records do not include coordinates. Engineering projection later assigns coordinates dynamically from route geometry.

#### ScopeVersion RouteStationingEngine

Location:

- `src/scopeversion/RouteStationingEngine.ts`
  - `generateRouteStationsFromCertifiedRoute()`

Algorithm:

- Default interval: `DEFAULT_LATERAL_STATION_INTERVAL_FEET = 100`
- Computes route length with haversine distance.
- Walks measures from `0` to `routeFeet` at interval.
- Always includes origin and final route feet.
- Uses `interpolateRouteCoordinate()` to interpolate coordinate at `measureFeet`.
- Produces `RouteStation` records with:
  - `stationId`
  - `scopeVersionId`
  - `certifiedRouteId`
  - `routeId`
  - `measureFeet`
  - `stationLabel`
  - `coordinate`
  - `stationState`

Constitutional note: this is the closest thing to a dedicated stationing engine. However, it is not the current source of Draft IOF Package station authority, and the Sprint 21 ScopeVersion authority engine maps certified package stations directly rather than invoking this stationing engine.

#### Corridor StationedCorridor Generation

Location:

- `src/corridor/CorridorGenerationEngine.ts`
  - `generateStationedCorridorFromCenterline()`
  - `buildStations()`

Algorithm:

- Station interval depends on network class:
  - Campus: 250 feet
  - Metro: 500 feet
  - Middle mile: 1000 feet
  - Default/long haul: 2500 feet
- Uses `coordinateAtDistance()` to interpolate along route distance.
- Creates `CorridorStation` records with `stationId`, `stationLabel`, `stationFeet`, `stationMiles`, `lat`, `lng`, `coordinate`, and `inventoryObjectIds`.

Constitutional note: this is a real stationed corridor generator, but its returned artifact is marked `salesEstimateOnly`, `noEngineeringCertification`, `noScopeVersionCreation`, and `noInventoryMutation`. It is not the constitutional Engineering Certification station authority.

### Station Persistence

Draft IOF Package persistence currently includes station arrays but not a guaranteed station authority index.

Location:

- `src/commercial/IOFPackageAssemblyEngine.ts`
  - `assembleDraftIofPackage()`
  - Persists `stations`

- `server/routes/engineering-certification.js`
  - `normalizeDraftPackage()`
  - Preserves `stations: asArray(raw.stations)`

- `server/routes/engineering-certification.js`
  - `buildPackageManifest()`
  - Adds station manifest entries from `record.stations`

Persisted today:

- Spine: yes, if product doctrine or fallback creates it.
- Station list: yes.
- Station index: partially, because station records often include `stationIndex`.
- Station-to-coordinate mapping: only when station records include `coordinate`, `lat/lng`, or geometry.

Not guaranteed today:

- A separate station index object.
- A canonical station-to-coordinate map.
- A stationing metadata block that binds interval, route length, geometry hash, origin, endpoint, and station version.
- A mandatory relation from every station to the spine as a measured linear reference.

### Object Attachment

Object attachment is mixed.

Product doctrine object contracts:

- `src/products/ProductDoctrineContracts.ts`
  - `ProductDoctrineObject`
  - Has `objectId`, `objectType`, `label`, optional `parentId`, `quantity`, `unit`, and `metadata`.
  - It does not require `stationId`, `coordinate`, `measureFeet`, or `spineId` as top-level fields.

Product doctrine object creation:

- `src/products/pointToPointLongHaulDoctrine.ts`
  - Spine object parent: none.
  - Route segment objects parent: spine.
  - Conduit and fiber objects parent: route segment.
  - Structures and crossings parent: spine.

Corridor inventory objects:

- `src/corridor/CorridorInventoryObject.ts`
  - These do have `stationId`, `stationLabel`, `lat`, and `lng`.
  - They are created by `CorridorGenerationEngine`, which is sales/proposed and not Engineering Certification authority.

Engineering Certification projection:

- `src/engineering/EngineeringCertificationProjection.ts`
  - `normalizeObjects()`
  - Reads explicit `stationId` or `station` from the object or metadata.
  - If no explicit station exists, assigns a fallback station by object index using `nearestStation()`.
  - Reads explicit object coordinates if present.
  - If no object coordinate exists, uses the station coordinate fallback.

Current state: not every object is explicitly attached to a station in persisted package data. Some objects attach to a parent spine or route segment. Some attach to a station. Some receive a station dynamically during Engineering projection.

### Engineering Projection

Location:

- `src/engineering/EngineeringCertificationProjection.ts`

Geometry enters Engineering projection through:

- `routeCoordinatesFromPackage()`
  - Reads package `geometry`
  - Then centerline fields
  - Then centerline route
  - Then OSRM route
  - Then product doctrine assembly geometry
  - Then customer request snapshots
  - Then proposed unit geometry
  - Then spine geometry if any
  - Then route segments
  - Then geometry reference parsing

Stations enter Engineering projection through:

- `normalizeStations()`
  - Reads `draft.stations`
  - Uses `station.stationFeet`, `station.measureFeet`, or `station.feet`
  - Uses explicit station coordinate if present
  - Otherwise assigns a coordinate from the route coordinate array by station index ratio

Objects enter Engineering projection through:

- `normalizeObjects()`
  - Reads `draft.objects`, `draft.structures`, and `engineeringObjects`
  - Falls back to `draft.proposedIofUnits`
  - Uses explicit station references when present
  - Otherwise assigns station by object index ratio

Graph primitives enter Engineering projection through:

- `packageGraphPrimitives()`
  - Uses package route segments or doctrine route segments if they exist.
  - Reads `fromStationId` and `toStationId`.
  - If no graph primitives exist and stations have coordinates, creates station-to-station edges from projected station coordinates.

Current state: Engineering projection can render the package, but it can also synthesize station coordinates and object station placement for rendering when those relationships are missing from persisted package data.

### Map Rendering

Location:

- `src/engineering/EngineeringCertificationProjection.ts`
  - `renderCertificationSpec()`

- `src/mapkernel/MapKernel.tsx`

Rendering path:

```text
Draft IOF Package
        |
        v
buildEngineeringCertificationProjection()
        |
        v
renderCertificationSpec()
        |
        v
MapKernel specs={[projection.mapSpec]}
        |
        v
Engineering Canvas
```

Rendered primitives:

- Centerline line from projected route geometry.
- Spine line from projected route coordinates.
- Graph edges from route segments or station-to-station fallback.
- Station points and station labels from projected stations.
- Object points from projected objects.
- Constraint points from station references.

Current state: `MapKernel` renders primitives and does not create authoritative geometry, stationing, or object attachment. That is correct for rendering, but it means any missing station authority must already exist before rendering if it is to be constitutional.

## Direct Audit Answers

### 1. Where is the Spine created?

The primary spine is created in `src/products/pointToPointLongHaulDoctrine.ts` inside `assemblePointToPointLongHaulDoctrine()`.

A fallback spine is created in `src/commercial/IOFPackageAssemblyEngine.ts` inside `assembleDraftIofPackage()` when product doctrine did not provide one but package centerline geometry exists.

Engineering rendering creates a visual spine primitive from projected route coordinates. That rendered line is not a separate constitutional spine authority.

### 2. Is there a dedicated Stationing Engine?

Yes, but not in the active Draft IOF Package to Engineering Certification path.

The dedicated stationing engine is `src/scopeversion/RouteStationingEngine.ts`. It generates `RouteStation` records from a `CertifiedRoute`.

There are also station generators in:

- `src/products/pointToPointLongHaulDoctrine.ts`
- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/corridor/CorridorGenerationEngine.ts`

These are separate mechanisms with different intervals and different coordinate algorithms.

### 3. Dedicated Stationing Engine Details

`src/scopeversion/RouteStationingEngine.ts`:

- Algorithm: haversine route length, measured station intervals, distance-based interpolation along geometry.
- Default interval: 100 feet.
- Station values:
  - `measureFeet` is the station measure.
  - `stationId` is generated from measure feet.
  - `stationLabel` is generated in `station+remainder` format.
  - `coordinate` is interpolated from the certified route geometry at the measure.

`src/products/pointToPointLongHaulDoctrine.ts`:

- Algorithm: station count from route feet and interval, coordinate selected by route coordinate-array ratio.
- Default interval: 5280 feet.
- Station values:
  - `stationFeet = index * interval`, except final station equals route feet.
  - `milepost = stationFeet / 5280`.
  - `coordinate` is selected from the centerline array by ratio, not by measured interpolation.

`src/commercial/IOFPackageAssemblyEngine.ts` fallback:

- Algorithm: station count and interval from commercial draft quantities.
- Interval: `draft.stationIntervalFeet`.
- Station values:
  - `stationFeet = index * interval`.
  - `milepost = stationFeet / 5280`.
  - No coordinate is persisted.

`src/corridor/CorridorGenerationEngine.ts`:

- Algorithm: distance-based station generation from centerline route.
- Interval:
  - Campus: 250 feet.
  - Metro: 500 feet.
  - Middle mile: 1000 feet.
  - Default/long haul: 2500 feet.
- Station values:
  - `stationFeet`
  - `stationMiles`
  - `lat/lng`
  - `coordinate`

This corridor stationing is marked sales/proposal only and not Engineering Certification authority.

### 4. If No Dedicated Constitutional Stationing Exists, Are Lat/Lon Vertices Being Mistaken For Stations?

Partially, yes.

The platform does create station records, so raw route vertices are not literally stored as stations in every path. However, in the active Draft IOF Package and Engineering Certification projection path, station coordinates can be assigned by sampling the route coordinate array rather than by measured linear interpolation.

Examples:

- Product doctrine station coordinates use `coordinateAt(centerline, ratio)`.
- Engineering projection assigns missing station coordinates with `coordinateAt(routeCoordinates, index, rawStations.length)`.

That means latitude/longitude vertices can become de facto station coordinate anchors when persisted station-to-coordinate mapping is absent.

### 5. Does Every Object Attach To Latitude/Longitude, Geometry Vertex, Station, Or Spine?

No.

Current object attachment varies by source:

| Object source | Latitude/longitude | Geometry vertex | Station | Spine |
| --- | --- | --- | --- | --- |
| Product doctrine spine object | No | No | No | It is the spine object |
| Product doctrine route segment object | No | No | Indirect through segment metadata | Parent spine |
| Product doctrine conduit/fiber object | No | No | No required station | Parent route segment |
| Product doctrine structure/crossing object | No | No | No required station | Parent spine |
| Corridor inventory object | Yes, via station lat/lng | No | Yes | Indirect through stationed corridor |
| Engineering projected object | Sometimes explicit, otherwise station fallback | No formal vertex binding | Sometimes explicit, otherwise dynamic fallback | Optional parent reference |
| Object moved in Engineering Certification | No required coordinate update | No | Yes, station reference is patched | Existing parent remains |

Current state: object location is not uniformly constitutional. Some objects are station-attached, some are spine/segment-attached, and some are dynamically placed for Engineering rendering.

### 6. Can An Object Currently Answer `Station = ?` Without Computing It Dynamically?

Not universally.

An object can answer `Station = ?` without dynamic computation only when its persisted record contains `stationId`, `station`, or station metadata.

Objects that do not persist a station reference depend on Engineering projection fallback logic. In that case, `Station = ?` is computed at projection time from object index and station list, not read as an authoritative persisted object property.

ScopeVersion downstream objects expect station authority, but the Sprint 21 authority engine maps stations and objects from the Certified IOF Package. It does not guarantee station attachment for objects that lacked a persisted station reference before promotion.

### 7. Does The Draft IOF Package Persist Spine, Station List, Station Index, Station-To-Coordinate Mapping, Or Only Geometry?

The Draft IOF Package persists more than geometry, but not enough to be a complete constitutional station reference system in all cases.

Persisted:

- `geometry`
- `geometryCoordinateCount`
- `centerline`
- `centerlineRoute`
- `osrmRoute`
- `spine`
- `stations`
- `routeSegments`
- `objects`
- `structures`
- `dependencyGraph`
- `manifest`
- `quantitySummary`

Partially persisted:

- Station index, when station records include `stationIndex`.
- Station-to-coordinate mapping, when station records include `coordinate`, `lat/lng`, or geometry.

Not guaranteed:

- A canonical station index object.
- A station-to-coordinate map for every station.
- A station-to-spine measure table.
- A persisted geometry hash tying stationing to a specific route geometry.

Current state: the package persists geometry and station arrays, but not a guaranteed constitutional station index.

### 8. If A Reroute Occurs Today, What Regenerates?

In Engineering Certification:

- `server/routes/engineering-certification.js`
  - `handleCreateRouteRedline()`

Today a route redline records:

- Redline metadata.
- New package revision number.
- `redlineRevisionHistory`.
- `engineeringRevisionMetadata`.
- `engineeringReadiness = ROUTE_REDLINE_REQUIRES_COMMERCIAL_REVISION`.
- A list of artifacts marked as requiring regeneration.

It does not regenerate:

- Geometry.
- Centerline.
- Spine.
- Graph.
- Stations.
- Object station references.
- Assemblies.
- Quantities.
- Pricing.
- Validation.

In Engineering Certification object movement:

- `handleMoveObject()`

Today an object move changes:

- Object `stationId`.
- Object `station`.
- Object metadata station reference.
- Object move history.

It explicitly does not move station geometry.

In Route Engineering workspace:

- `src/engineering/RouteEngineeringDraftEngine.ts`

Route Engineering can create geometry revisions and regenerate an engineering corridor from preserved commercial baseline geometry. That path recalculates revision preview, financial deltas, segments, and geometry hashes inside the route engineering draft model. It is not currently the same as Draft IOF Package station authority in Engineering Certification.

In proposed corridor redline logic:

- `src/redline/RouteRedlineEngine.ts`

OSRM redline revision can create a new `StationedCorridor` from a revised centerline. That path is proposed graph/sales design logic and not the current constitutional Draft IOF Package certification station authority.

Current state: within Engineering Certification, a reroute records that regeneration is required; it does not perform regeneration.

### 9. Is The Current Graph Indexed By Coordinates Or Station References?

The Draft IOF Package dependency graph is primarily indexed by package reference identifiers, not by station authority.

Location:

- `server/routes/engineering-certification.js`
  - `buildPackageDependencyGraph()`

Graph nodes include:

- Proposal.
- Runtime objects.
- Relationships.
- Proposed IOF units.
- Evidence.
- Geometry reference IDs.
- Draft IOF Package.

Graph edges express dependency/reference relationships such as:

- `REFERENCES_RUNTIME_OBJECT`
- `RELATIONSHIP_CONTEXT`
- `ASSEMBLES_UNIT`
- `SUPPORTED_BY_EVIDENCE`
- `USES_GEOMETRY`
- `PACKAGED_IN_DRAFT_IOF`

Engineering map graph primitives may use station references when route segments include `fromStationId` and `toStationId`. If no route-segment graph exists, Engineering projection creates station-to-station render edges from projected station coordinates.

Current state: the package graph is neither a coordinate-indexed engineering graph nor a constitutional station-indexed graph. It is a package dependency graph with optional station-based route segment rendering.

### 10. Can The Current Architecture Support Engineering, Field, And Operational Twin Without A Constitutional Stationing Engine?

At constitutional authority level: no.

The current architecture can render Engineering packages and can pass station-like data downstream when that data exists. Field and Operational Twin code already expect stable stations with `measureFeet`, station state, object station IDs, and station-ranged closure logic.

However, without one continuous constitutional stationing authority, the following current-state gaps remain:

- Draft package stationing can be generated by different algorithms with different intervals.
- Station coordinates may be sampled from coordinate-array position instead of measured route distance.
- Station-to-coordinate mapping is not guaranteed in persistence.
- Object station references are not guaranteed in persistence.
- Engineering Certification route redlines do not regenerate geometry, stationing, graph, or object station references.
- The package dependency graph is not a station-indexed execution graph.
- ScopeVersion can preserve certified package stations but does not prove those stations came from a single constitutional stationing authority.

Current state: Engineering, Field, and Operational Twin can consume station data, but the platform does not yet possess a single constitutional engineering reference system that guarantees station authority across the lifecycle.

## Constitutional State By Artifact

| Artifact | Current constitutional state |
| --- | --- |
| Route geometry | Persisted in Draft IOF Package and projected into Engineering. |
| Centerline | Persisted in Draft IOF Package. |
| Spine | Persisted as metadata object; rendered from route coordinates. |
| Stations | Persisted as an array; generated by multiple mechanisms. |
| Station index | Partially present as station fields; no standalone canonical index. |
| Station-to-coordinate mapping | Present only when station records include coordinates; otherwise dynamically projected. |
| Objects | Persisted, but not uniformly station-attached. |
| Object station answer | Persisted for some objects; dynamically inferred for others. |
| Graph | Package dependency graph, not constitutional station graph. |
| Reroute authority | Redline metadata exists; full artifact regeneration does not occur in Engineering Certification. |
| ScopeVersion stationing | Downstream station model exists; promotion preserves package stations rather than proving a unified stationing source. |

## Final Constitutional Statement

Does IOF currently possess a constitutional engineering reference system?

No.

IOF currently possesses partial reference artifacts: persisted route geometry, a product doctrine/fallback spine object, station arrays, station-like route segments, object placement projection, and a downstream ScopeVersion stationing engine. These do not yet constitute a single constitutional engineering reference system because station authority is not uniformly generated, persisted, indexed, mapped to coordinates, attached to every object, regenerated on reroute, and carried through the graph as the controlling reference.

Under the constitutional principle above, geometry alone is not enough. A route becomes governable only when a measured spine exists, stations are established on that spine, objects attach to those stations, and ScopeVersion receives only that stationed authority.

Exactly what is missing in the current constitutional state:

- One authoritative stationing source for the Draft IOF to Certified IOF pipeline.
- A spine that functions as a measured linear reference, not only a route metadata object.
- Guaranteed station-to-coordinate persistence.
- Guaranteed station-to-spine measure persistence.
- Guaranteed object-to-station persistence.
- A station-indexed engineering graph.
- Reroute regeneration of geometry, spine, stations, graph, object station references, quantities, and validation inside the certification authority chain.
