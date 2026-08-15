# Corridor Execution Audit

Date: 2026-07-07

## Objective

Verify that Corridor Execution owns large-corridor runtime behavior and does not duplicate repository truth, Engineering authority, or ScopeVersion authority.

## Implemented Corridor Execution Ownership

`src/corridorExecution` owns:

- `CorridorExecutionEngine`
- `CorridorExecutionSession`
- `CorridorPartitionEngine`
- `CorridorSegmentWorker`
- `CorridorCheckpointStore`
- `CorridorAggregateProjection`
- `CorridorViewportProjection`
- `CorridorPerformanceMetrics`
- `CorridorCache`

## Ownership Verification

### Partitioning

Owner:
`CorridorPartitionEngine`

Evidence:

- Preferred segment length is 25 miles.
- Max segment length is 50 miles.
- Breakpoints include POP, ILA boundary, Bookend, construction method change, municipality, county, state, and operator breakpoint.

Status:
`PASS`

### Workers

Owner:
`CorridorSegmentWorker`

Responsibilities:

- segment summary work
- construction mix summary
- material summary
- labor summary
- cost summary
- station summary
- ILA summary
- validation state
- checkpoint creation

Status:
`PASS`

### Streaming

Owner:
`CorridorExecutionEngine`

Evidence:

- Progressive states:
  - `INITIALIZING_CORRIDOR`
  - `PARTITIONING_CORRIDOR`
  - `BUILDING_SEGMENTS`
  - `CALCULATING_AGGREGATE`
  - `READY`
  - `FAILED`
- Worker queue yields through `requestIdleCallback` or `setTimeout`.

Status:
`PASS`

### Checkpointing

Owner:
`CorridorCheckpointStore`

Evidence:

- Every processed segment creates a checkpoint.
- Recovery helper returns checkpointed segments.

Status:
`PARTIAL`

Reason:
Checkpoints are in-process only and not restart-safe.

### Viewport Projection

Owner:
`CorridorViewportProjection`

Evidence:

- Uses `geometryForViewport`.
- Produces visible segment IDs, visible geometry, rendered station count, rendered object count, materialized tier, and adjacent segment IDs.
- `ProposedNetworkMapPanel` can consume `corridorViewportProjection`.

Status:
`PASS`

### Segment Cache

Owner:
`CorridorCache`

Evidence:

- Cache key includes customer twin, customer, corridor, import hash, geometry hash, segment hash, and workbook hash.
- Cache caps at 50 records.

Status:
`PASS`

### Aggregation

Owner:
`CorridorAggregateProjection`

Evidence:

- Produces total length, estimated cost, revenue, lifecycle value, margin, construction mix, unknown count, confidence, ILA count, and bookend count.
- Marks workbook summary as executing from segment summaries.
- Marks proposal summary as aggregate-only with async detailed schedules.

Status:
`PASS`

### Retry

Owner:
`CorridorExecutionEngine`

Evidence:

- Failure captures failed segment ID and completed count.
- Completed checkpoints remain available in checkpoint store.

Status:
`PARTIAL`

Reason:
Retry semantics exist conceptually but no durable retry queue exists.

## Duplicate Implementations / Boundary Risks

Potential duplicates that need doctrine separation:

| File / Area | Purpose | Risk |
|---|---|---|
| `src/corridor/CorridorGenerationEngine.ts` | corridor generation/reference architecture | Could be confused with Corridor Execution |
| `src/engineering/RouteEngineeringDraftEngine.ts` | Engineering draft geometry/station review | Valid Engineering domain, but should not rebuild Commercial corridor execution |
| `src/commercial/CommercialOsrmRoutingEngine.ts` | OSRM route generation | Correct pre-repository route creation, not execution streaming |
| `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx` | map viewport rendering | Still virtualizes graph centerline and proposal paths independently |
| `src/performance/MapVirtualization.ts` | generic map LOD projection | Shared projection utility, not corridor owner |
| `src/commercial/IlaPlanningEngine.ts` | ILA planning/memoization | Estimate/ILA domain, not corridor streaming owner |

## Workspace Rebuild Audit

Commercial Planning still builds `corridorExecutionGeometry` from:

- active financial draft geometry
- generated route repository snapshot geometry
- temporary imported route geometry
- quick quote geometry

This is acceptable as a bridge, but the long-term target is:

Route Repository ID

-> Corridor Execution Engine

-> segment/viewport projection

-> UI

not:

React full geometry

-> Corridor Execution Engine

-> UI

## Authority Boundary

Corridor Execution correctly declares:

- `noScopeVersionCreation: true`
- `noEngineeringAuthorityMutation: true`
- `repositoryTruthUnchanged: true`

No inspected corridor execution file mutates:

- Route Repository
- Opportunity Repository
- Proposal Repository
- Engineering Repository
- ScopeVersion
- Marketplace
- Control
- Field

## Persistence Readiness

Segment model:
`READY`

Aggregate projection:
`READY`

Viewport projection:
`READY`

Checkpoint model:
`PARTIALLY READY`

Reason:
The object model is ready, but the store is in-process. Decide whether checkpoints are durable resumable work or disposable cache.

## Recommendation

Before PostgreSQL migration:

1. Decide whether `corridor_checkpoints` are durable.
2. Move long route geometry reads from React state to route repository/PostGIS segment slices.
3. Create a repository-backed segment read API if segment persistence is required.
4. Keep `CorridorExecutionEngine` as the single Commercial streaming runtime.
5. Document the difference between route generation, route edit patches, corridor execution, engineering draft review, and map virtualization.
