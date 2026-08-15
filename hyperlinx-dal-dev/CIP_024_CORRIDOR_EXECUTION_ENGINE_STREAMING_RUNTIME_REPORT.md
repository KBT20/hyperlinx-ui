# CIP-024 Corridor Execution Engine Streaming Runtime Report

Date: 2026-07-07

## Objective

Implement a constitutional runtime layer for large corridor execution so long commercial routes are partitioned, checkpointed, cached, and projected without requiring the UI to assemble or render the full corridor as one object.

## Root Cause

Commercial Planning already had map virtualization and route edit patching, but long corridors still lacked an explicit execution runtime. The UI could hold route geometry, workbook summaries, proposal projections, station arrays, and map rendering concerns near the same workspace boundary. That made large routes vulnerable to lag and crash behavior when the operator loaded or edited assembled corridor data.

## Runtime Architecture

Created `src/corridorExecution` with:

- `CorridorExecutionEngine`
- `CorridorExecutionSession`
- `CorridorPartitionEngine`
- `CorridorSegmentWorker`
- `CorridorCheckpointStore`
- `CorridorAggregateProjection`
- `CorridorViewportProjection`
- `CorridorPerformanceMetrics`
- `CorridorCache`

## Segment Model

Each segment now carries:

- `segmentId`
- `corridorId`
- `sequence`
- `startStation`
- `endStation`
- `startNode`
- `endNode`
- `lengthFeet`
- `lengthMiles`
- `geometryHash`
- `simplifiedGeometry`
- `visibleGeometry`
- `constructionSummary`
- `materialSummary`
- `laborSummary`
- `costSummary`
- `stationSummary`
- `ILASummary`
- `bookendSummary`
- `constraintSummary`
- `riskSummary`
- `validationState`
- `buildStatus`
- `checkpointId`
- `cacheKey`

## Partitioning

The partition engine uses:

- preferred segment length: 25 miles
- max segment length: 50 miles
- deterministic breakpoints for POP, ILA boundary, Bookend, construction method change, municipality, county, state, and operator breakpoint

## Worker Execution

`CorridorSegmentWorker` performs bounded per-segment work:

- geometry preparation
- summary stationing
- ILA candidate counts
- construction mix summaries
- material summaries
- labor summaries
- cost summaries
- validation warnings
- checkpoint creation

Workers yield through `requestIdleCallback` or `setTimeout`, keeping the UI responsive.

## Checkpoints

Every completed segment is persisted into the in-process `CorridorCheckpointStore`.

If a segment fails, completed segments remain recoverable and the engine reports the failed segment instead of invalidating the whole corridor.

## Cache

The cache key includes:

- `customerTwinId`
- `customerId`
- `corridorId`
- `importHash`
- `geometryHash`
- `segmentHash`
- `workbookHash`

Cache hits return aggregate and viewport projections without reprocessing segment workers.

## Lazy Materialization

`CorridorViewportProjection` materializes:

- visible segment geometry
- selected segment
- adjacent segments
- level-of-detail station and object counts

Cold segments remain checkpointed and are not rendered.

## Commercial Aggregate Projection

Commercial Planning now receives:

- total length
- estimated cost
- revenue
- lifecycle value
- margin
- construction mix
- unknown count
- confidence
- ILA count
- bookend count

Workbook summaries execute from segment summaries. Proposal preview consumes the aggregate projection only; detailed schedules remain async/on demand.

## UI Integration

Commercial Planning now starts a background corridor execution session when a route and estimate are available.

The map receives an optional `corridorViewportProjection` and renders the visible geometry slice when present.

The Runtime / Diagnostics panel now shows:

- corridor status
- segment checkpoint progress
- hot/warm/cold segment counts
- partition time
- worker queue depth
- checkpoint count
- cache hits and misses
- visible segment count
- rendered station and object counts
- workbook calculation time
- proposal generation time
- worker utilization

The estimate sidebar also shows corridor segment and visible segment counts.

## Runtime Boundaries

CIP-024 does not modify:

- ScopeVersion
- Engineering authority
- Commercial lifecycle
- pricing formulas
- Proposal lifecycle
- repository truth
- route generation
- Marketplace
- Control
- Field

## Files Modified

- `src/corridorExecution/CorridorExecutionTypes.ts`
- `src/corridorExecution/CorridorPartitionEngine.ts`
- `src/corridorExecution/CorridorSegmentWorker.ts`
- `src/corridorExecution/CorridorCheckpointStore.ts`
- `src/corridorExecution/CorridorCache.ts`
- `src/corridorExecution/CorridorAggregateProjection.ts`
- `src/corridorExecution/CorridorViewportProjection.ts`
- `src/corridorExecution/CorridorPerformanceMetrics.ts`
- `src/corridorExecution/CorridorExecutionEngine.ts`
- `src/corridorExecution/index.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx`
- `PD_003_CORRIDOR_EXECUTION_ENGINE_DOCTRINE.md`
- `cip024-corridor-execution-engine-validation.mjs`
- `CIP_024_CORRIDOR_EXECUTION_ENGINE_STREAMING_RUNTIME_REPORT.md`

## Validation Results

Validation script:

`node cip024-corridor-execution-engine-validation.mjs`

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
