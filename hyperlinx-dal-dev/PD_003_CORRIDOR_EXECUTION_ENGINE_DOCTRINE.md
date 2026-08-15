# PD-003 Corridor Execution Engine Doctrine

Date: 2026-07-07

## Constitutional Position

Large commercial corridors are not runtime monoliths.

The corridor is the product, but the runtime must execute the corridor through deterministic segment authority:

Commercial truth remains in Commercial repositories.
Engineering authority remains in Engineering Certification.
ScopeVersion remains blocked until signed Service Order authority exists.

The Corridor Execution Engine is a projection runtime. It does not create ScopeVersion, inventory, Marketplace, Control, Field, Operational Twin, or Operational Intelligence authority.

## Core Doctrine

Long routes must not be assembled, rendered, reasoned, or recalculated as one large in-memory object.

The runtime partitions corridors into deterministic segments, executes segment workers, checkpoints completed work, and exposes aggregate and viewport projections.

## Segment Streaming

Segments target 25 miles and must not exceed 50 miles unless source geometry itself is malformed.

Deterministic breakpoints include:

- POP
- ILA boundary
- Bookend
- Construction method change
- Municipality
- County
- State
- Operator breakpoint

Every segment carries:

- segment identity
- station range
- node range
- length
- geometry hash
- simplified geometry
- visible geometry
- construction summary
- material summary
- labor summary
- cost summary
- station summary
- ILA summary
- bookend summary
- constraint summary
- risk summary
- validation state
- build status
- checkpoint reference
- cache key

## Lazy Materialization

The runtime materializes only:

- selected segment
- visible viewport segments
- adjacent segments
- active workbook section
- selected ILA
- selected engineering object

Everything else remains cold checkpointed data.

## Runtime Tiers

Hot:
Visible or selected segments.

Warm:
Adjacent segments likely to be needed next.

Cold:
Checkpointed segments not currently visible or selected.

## Projection Authority

Commercial workbook execution uses segment summaries.

Proposal preview uses aggregate projection only.

Detailed schedules and full route exports are generated asynchronously on demand.

## Checkpoint Doctrine

Every completed segment creates a checkpoint.

If a segment fails, completed segments remain valid and recoverable. Retry starts from the failed segment instead of rebuilding the entire corridor.

## Diagnostics Doctrine

Runtime diagnostics are gated behind `DEBUG_RUNTIME_DIAGNOSTICS=true` or `VITE_DEBUG_RUNTIME_DIAGNOSTICS=true`.

Operators see structured runtime status in Commercial Planning:

- initial render time
- corridor partition time
- worker queue depth
- checkpoint count
- cache hits and misses
- visible segment count
- rendered station and object counts
- workbook calculation time
- proposal generation time
- worker utilization

## Prohibited Behavior

The Corridor Execution Engine shall not:

- create ScopeVersion
- mutate Engineering authority
- mutate Commercial repository truth
- change pricing formulas
- change Proposal lifecycle
- rebuild route generation
- force full map rerender for one viewport change
- recalculate the full workbook for one segment update
- regenerate OSRM routes during restore
