# CONSTITUTIONAL_WORKSPACE_AUDIT

Date: 2026-07-03
Program: CIP-010 - Constitutional Workspace Rationalization, Performance Audit & Foundation Review

## Scope

This audit reviews the workspaces available from `src/dal/DALNavigation.tsx` and the runtime outlet in `src/dal/DALApp.tsx`.

## Constitutional Lifecycle Assessment

The platform has a coherent lifecycle, but the navigation currently mixes lifecycle workspaces, discovery tools, diagnostics, and platform administration as equal first-level items.

Recommended lifecycle spine:

1. Evidence Intake: Translate, Teralinx Route.
2. Commercial Review: Commercial Planning, Proposal Readiness.
3. Discovery and Decision: Portfolio, Prism, Candidate Sites, Network Affinity, Site Decision.
4. Engineering: Engineering Certification.
5. Constitutional Truth: ScopeVersion.
6. Execution: Marketplace, Control, Field.
7. Operations: Twin, Operational Intelligence.
8. System: Inventory Graphs, Inventory Recovery, Graph Viewer, Graph Extensions.

## Workspace Findings

### Commercial Planning

Commercial Planning is strategically important, but it is too large and owns too much runtime orchestration. It should answer:

- What are we selling?
- What are we building?
- Is it financially sound?
- Is it constitutionally complete?
- Is it ready for Engineering?

It should not own:

- object placement truth,
- engineering certification,
- payment authorization,
- ScopeVersion creation,
- Control/Field/Twin execution,
- long-lived constitutional assembly loops.

Move heavy constitutional assembly out of Commercial render and expose a cached Draft IOF Package artifact.

### Engineering Certification

Engineering is the correct owner for:

- object presence,
- object address,
- object placement,
- dependency satisfaction,
- legal sequence,
- certifiability.

The current Engineering projection has the right constitutional ingredients. The UI should become more object-centric:

- object workbench,
- address queue,
- dependency graph,
- sequence validation,
- exception ledger,
- map/object synchronization.

### ScopeVersion

ScopeVersion should remain the boundary where constitutional truth begins. It should not be created from Commercial or Engineering preview state until:

- Draft IOF Package is assembled and versioned,
- Engineering certification is complete,
- object addressing is complete or explicitly excepted,
- kernel execution graph is valid,
- closure expectations are present,
- ScopeVersion readiness gate passes.

### Execution Workspaces

Marketplace, Control, Field, Twin, and OI are appropriately downstream. They should stay lighter until the foundation is stable. Their runtime projections should read certified ScopeVersion/package state rather than recomputing upstream doctrine.

### Diagnostics and Admin

Inventory Recovery, Graph Viewer, and Graph Extensions are valuable but should not compete with constitutional lifecycle workspaces in the primary nav. They belong in a collapsed System or Diagnostics section.

## Keep, Move, Defer, Lazy-Load

| Category | Workspaces | Action |
| --- | --- | --- |
| Keep primary | Commercial Planning, Engineering Certification, ScopeVersion, Control, Field, Twin, Operational Intelligence. | Keep, but lazy-load heavy bodies. |
| Keep as intake/discovery | Translate, Portfolio, Site Decision. | Keep visible but grouped by lifecycle. |
| Merge | Preliminary Proposal, Teralinx Route, Candidate Sites, Network Affinity, Prism. | Merge into Commercial/Portfolio/Site Decision groupings unless independent authority emerges. |
| Move to System | Inventory Graphs, Inventory Recovery, Graph Viewer, Graph Extensions. | Collapse outside primary lifecycle. |
| Defer expansion | Marketplace, Field mobile/detail, OI deep analytics. | Maintain basic downstream flow until ScopeVersion foundation is stable. |

## Workspace Data Ownership Principles

1. Commercial owns commercial records and proposal readiness, not engineering truth.
2. Engineering owns certifiability, not ScopeVersion lifecycle creation.
3. ScopeVersion owns constitutional truth and lifecycle.
4. Control owns work authorization after ScopeVersion approval.
5. Field owns evidence-backed closure through closure authority.
6. Twin and OI own read-only projections.
7. Map workspaces own view state, not source authority.

## Render Stability Findings

The largest render-stability risks are:

- Commercial default workspace executes heavy memo chains at startup.
- Reasoning panel is mounted for every workspace and receives a broad context object.
- Operational Intelligence computes large aggregate projections without memoization.
- MapKernel duplicates primitive derivation for render, metrics, and audit.
- Some renderers log during projection.

## Navigation Recommendation

Replace the flat list with grouped sections:

| Group | Items |
| --- | --- |
| Intake | Translate, Route Intake |
| Commercial | Commercial Planning, Proposal Readiness |
| Discovery | Portfolio, Prism, Candidate Sites, Network Affinity |
| Decision | Site Decision |
| Engineering | Engineering Certification |
| Constitutional Truth | ScopeVersion |
| Execution | Marketplace, Control, Field |
| Operations | Twin, Operational Intelligence |
| System | Inventory Graphs, Inventory Recovery, Graph Viewer, Graph Extensions |

The nav should default to Commercial Planning only as a lightweight shell. It should not eagerly mount every commercial subsystem.

