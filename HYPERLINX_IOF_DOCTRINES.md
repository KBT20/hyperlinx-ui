# Hyperlinx / IOF Doctrines

Date: 2026-06-13

Purpose: architecture and product doctrine for Baseline Graph, spatial closure, Field execution, Twin replay, hyperscaler reporting, Prism opportunity discovery, and IOF governance.

Scope: documentation only. These doctrines describe intended system boundaries and operating rules. They do not modify application logic, Design, Prism, Field, Twin, Marketplace, Control, or IOF package generation.

## Doctrine 1: Design Is Frozen Unless Bug Fixes Are Required

Design is the current working route-to-ScopeVersion authority. It already performs proposed route upload, stationing, economics, BOM, civil modeling, SVA, IOF package generation, and `/scope/assemble` submission.

Design should be frozen except for bug fixes.

New platform work should not destabilize Design. Baseline Graph, Prism, Field, Twin, Marketplace, Control, accounts, and backend graph storage should develop around Design instead of refactoring it prematurely.

## Doctrine 2: Baseline Graph Is Authoritative Inventory Truth

Existing carrier infrastructure is represented by `BASELINE_GRAPH`, not by `routeCoords`.

The Baseline Graph represents immutable carrier network inventory:

```text
Baseline Graph
  -> Carrier network inventory
  -> Edges
  -> Nodes
  -> Stations
  -> Spatial reference truth
```

The Baseline Graph is not a design route, not a ScopeVersion route, and not an economic proposal.

The graph must remain unchanged by Design calculations, Prism discovery, Field work, Twin replay, or AI interpretation.

## Doctrine 3: Baseline Graph And Design Route Are Different Objects

Baseline Graph and Design Route must remain separate concepts.

Baseline Graph:

- Existing network inventory.
- Immutable infrastructure truth.
- Used for nearest edge, nearest node, station lookup, serviceability, and opportunity discovery.
- Does not create economics, BOM, construction scope, or route stationing.

Design Route:

- Proposed new construction geometry.
- May become a ScopeVersion.
- May generate stationing, BOM, economics, construction model, financial model, and IOF package.

No system should convert Baseline Graph geometry into a Design Route simply to make existing UI logic work.

## Doctrine 4: Every Authoritative Close Resolves To A Spatial Address

Every authoritative event must resolve to a spatial address.

Valid spatial addresses include:

- Baseline graph edge.
- Baseline graph node.
- Graph station.
- ScopeVersion station.
- Route segment.
- Work package object.
- GPS-observed close location tied back to a known station or segment.

If an event cannot resolve to a spatial address, it is not authoritative construction truth.

## Doctrine 5: Field Closes Against Stations, Not Loose Footage

Field production must be station-based.

Field should not report loose, unauditable footage as the primary truth. Production entries must close against station intervals, graph stations, ScopeVersion stations, or other spatially resolved work objects.

Expected Field closure pattern:

```text
Crew action
  -> station interval
  -> close event
  -> replay state
  -> Twin truth
  -> billing / as-built / reporting
```

Footage may be a quantity on the close, but the close itself must remain spatially addressed.

## Doctrine 6: Locator Is A Primary Field Data Actor For HDD

For HDD workflows, locator data is primary field evidence.

Locator input may include:

- Bore path observations.
- Depth.
- Offset.
- station range.
- utility conflict notes.
- GPS points.
- photos or evidence references.

Locator closes should be actor-scoped, role-scoped, and tied to station or graph addresses. Locator data should feed Field, Twin, QA, as-built, and hyperscaler reporting.

## Doctrine 7: Duration Is Derived From State Change, Not Manual Entry

Duration should be computed from close events and state transitions.

Manual duration fields are secondary at best. Authoritative duration comes from replayable events:

```text
work.activated
  -> production.started
  -> production.paused
  -> production.resumed
  -> production.completed
  -> qa.accepted
```

Twin should derive duration, bottlenecks, and production velocity from close history rather than trusting manually entered summaries.

## Doctrine 8: Twin Is Closure-Derived State, Not A Dashboard

Twin is not merely a dashboard.

Twin is the replayed state of ScopeVersion truth plus close history. It should represent what the system can prove from authoritative closes.

Twin state should be derived from:

- ScopeVersion canonical truth.
- Baseline Graph reference when applicable.
- close history.
- station and work-object state transitions.
- financial and production closes.
- evidence and QA closes.

Twin should avoid displaying estimated or advisory values as authoritative unless they can be traced to closed events.

## Doctrine 9: Replay Is A Core Product Capability

Replay is not a debugging feature. Replay is a core IOF capability.

The system must be able to reconstruct state from:

```text
ScopeVersion
  + Close history
  + Replay rules
  = Current operational truth
```

Replay supports:

- auditability.
- dispute resolution.
- production reporting.
- billing support.
- as-built reconstruction.
- Twin state.
- Control governance.
- hyperscaler reporting.

If a state cannot be replayed, it should not be treated as authoritative.

## Doctrine 10: Hyperscaler Reporting Is A Lens Over Closure State

Hyperscaler reporting should be a lens over authoritative closure state, not a separate reporting universe.

Reports should derive from:

- Baseline Graph proximity.
- ScopeVersion extension geometry.
- station progress.
- production closes.
- QA closes.
- duration replay.
- capacity, power, diversity, and serviceability context.

Hyperscaler views should emphasize:

- distance to network.
- low-latency path evidence.
- route diversity.
- execution status.
- risk and blockers.
- closure-backed progress.
- replayable audit trail.

## Doctrine 11: Prism Discovers Opportunity Against Baseline Graphs

Prism should discover opportunity from Baseline Graph inventory.

Candidate workflow:

```text
Candidate Site
  -> nearest graph edge
  -> nearest graph node
  -> nearest graph station
  -> distance to network
  -> serviceability
  -> extension opportunity
```

Prism should not require a Design Route to evaluate candidate sites against existing infrastructure.

Prism outputs are advisory until converted into an approved ScopeVersion extension through the governed IOF path.

## Doctrine 12: ScopeVersions Extend Truth, They Do Not Rewrite Truth

ScopeVersions may extend Baseline Graph truth, but they do not mutate it.

Expected architecture:

```text
Baseline Graph
  -> immutable existing infrastructure

Opportunity
  -> candidate extension

ScopeVersion
  -> proposed new geometry
  -> economics
  -> work packages
  -> stationing
  -> closes
```

A ScopeVersion may reference a parent baseline graph ID and graph version. It may create new proposed geometry. It must not rewrite existing Baseline Graph geometry.

## Doctrine 13: Human And Machine Outputs Are Advisory Until Closed

AI, Translate, Prism, and operator recommendations are advisory until they become governed IOF truth.

Advisory outputs may include:

- inferred network type.
- candidate opportunity rankings.
- route suggestions.
- budget hints.
- risk summaries.
- construction recommendations.
- hyperscaler narratives.

They become authoritative only through approved ScopeVersions, validated closes, replayable state transitions, or other governed IOF events.

## Doctrine 14: Production Reporting Supports Billing And As-Built

Production reporting must support billing, audit, and as-built reconstruction.

Production closes should include:

- actor.
- account.
- role.
- station range or spatial address.
- work type.
- quantity.
- timestamp.
- GPS evidence when available.
- photo or file evidence when available.
- QA status.
- references to ScopeVersion or Baseline Graph context.

Production reporting should be replayable into billing support, closeout packages, as-built records, and Twin state.

## Doctrine 15: Accounts And Roles Are First-Class

Accounts and roles are core architecture, not optional UI details.

Every authoritative event should eventually be actor-scoped and account-scoped:

```text
actorId
accountId
role
permissions
scopeVersionId
baselineId
closeType
spatialAddress
```

Client-side role checks are UX only. Server-side authorization must be the source of enforcement.

Roles should support FiberLight internal users, vendors, field crews, locators, admins, marketplace participants, and customer-facing reporting consumers.

## Doctrine 16: FiberLight Construction Operations UI

Hyperlinx is a construction operations system, not only a planning tool.

The UI should support real operational work:

- inventory ingestion.
- opportunity discovery.
- design approval.
- work activation.
- field production.
- locator evidence.
- QA.
- closeout.
- billing support.
- Twin replay.
- Control governance.

Interfaces should prioritize dense, scannable, operational workflows over marketing-style presentation.

## Doctrine 17: Baseline Inventory And Production Routes May Coexist

Existing inventory and new production geometry may coexist, but they must remain distinct.

Example:

```text
Baseline Graph edge
  -> existing carrier fiber

ScopeVersion extension
  -> proposed lateral / build / upgrade

Field close
  -> production against ScopeVersion station or graph-linked work object
```

The map may render both layers, but the data model must preserve their separate identities.

## Doctrine 18: Implementation Separation Of Responsibilities

Long-term implementation should separate responsibilities currently concentrated in large UI files.

Target boundaries:

- Baseline Graph ingestion, validation, storage, and rendering.
- Design proposed-route economics and ScopeVersion approval.
- Prism serviceability and opportunity discovery.
- Field station-based production closure.
- Twin replay and reporting.
- Control governance.
- Marketplace pricing and procurement.
- Shared API clients and typed contracts.
- Account and role enforcement.

Separation should happen after active Baseline Graph work stabilizes and should avoid destabilizing Design.

## Doctrine 19: Production Truth

Chicago is the authoritative IOF runtime.

Development features shall be validated in a non-production environment before promotion.

Customer inventory, baselines, ScopeVersions, field closures, replay data, and operational telemetry constitute production truth and shall not be displaced by development deployments.

Promotion path:

```text
Development
  -> Integration/Test
  -> Production
```

Never:

```text
Development
  -> Production
```

Production deployments must preserve existing customer truth unless a governed migration, backup, rollback path, and explicit promotion approval are in place.

## Patent Alignment Notes

These notes are architectural alignment points only. They are not legal advice and do not make legal conclusions.

### Deterministic Execution

The IOF model emphasizes deterministic state reconstruction:

```text
ScopeVersion + Close history + Replay rules -> Current truth
```

Deterministic replay supports auditability, operational confidence, and verifiable state.

### Closure-Based Mutation

Authoritative state changes should occur through governed close events, not informal UI edits or advisory outputs.

### Spatial Addressing

Spatially addressed closes create a verifiable link between work, location, actor, evidence, and replay state.

### Role-Constrained Execution

Actor, account, role, and permission context should be attached to authoritative events. Execution authority should be constrained by server-side permissions.

### Replayable Audit History

Replayable close history is the foundation for Twin state, Control governance, billing support, as-built reconstruction, and dispute review.

### Bounded Synthesis

AI and optimization systems can generate recommendations, summaries, rankings, and proposed actions. These outputs remain bounded and advisory until converted into governed IOF truth.

### Human Authority

Human approval and accountable close submission remain central. Machine outputs may assist decisions, but authoritative mutation flows through approved ScopeVersions and validated closes.
