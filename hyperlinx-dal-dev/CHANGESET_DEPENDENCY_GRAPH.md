# Change Set Dependency Graph Audit

Date: 2026-07-07

## Current Implementation

Implemented patch/change-set behavior currently lives in `src/routeEdit`:

- `RouteEditSession`
- `RouteEditPatch`
- `RouteEditProjection`
- `RouteEditReducer`
- `RouteEditImpactEngine`
- `RouteEditRevisionRecord`

This is a route edit patch system. It is not yet a universal Commercial Change Set repository.

## Patch Type Dependency Table

| Patch Type | Affects | Must Not Affect | Recalculation Boundary |
|---|---|---|---|
| `REMOVE_BOOKEND` | Map projection, route summary, endpoint span, ILA spans, estimate cost, proposal preview | Repository truth, full route rebuild, full workbook recalculation, inventory, Engineering objects, ScopeVersion | `AFFECTED_SPANS_ONLY` |
| `RESTORE_BOOKEND` | Map projection, route summary, endpoint span, ILA spans, estimate cost, proposal preview | Repository truth, full route rebuild, full workbook recalculation, inventory, Engineering objects, ScopeVersion | `AFFECTED_SPANS_ONLY` |
| `MOVE_BOOKEND` | Map projection, route summary, endpoint span, ILA spans, estimate cost, proposal preview | Repository truth, full route rebuild, full workbook recalculation, inventory, Engineering objects, ScopeVersion | `AFFECTED_SPANS_ONLY` |
| `MOVE_ILA` | Map projection, ILA spans, estimate cost, proposal preview | Repository truth, full route rebuild, full workbook recalculation, inventory, Engineering objects, ScopeVersion | `AFFECTED_SPANS_ONLY` |
| `REMOVE_ILA` | Map projection, ILA spans, estimate cost, proposal preview | Repository truth, full route rebuild, full workbook recalculation, inventory, Engineering objects, ScopeVersion | `AFFECTED_SPANS_ONLY` |
| `RESTORE_ILA` | Map projection, ILA spans, estimate cost, proposal preview | Repository truth, full route rebuild, full workbook recalculation, inventory, Engineering objects, ScopeVersion | `AFFECTED_SPANS_ONLY` |
| `CHANGE_PLOW_RATE` | Estimate cost, financial model, workbook section, proposal preview | Geometry, stations, repository truth, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `CHANGE_BORE_RATE` | Estimate cost, financial model, workbook section, proposal preview | Geometry, stations, repository truth, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `CHANGE_TRENCH_RATE` | Estimate cost, financial model, workbook section, proposal preview | Geometry, stations, repository truth, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `CHANGE_ROCK_RATE` | Estimate cost, financial model, workbook section, proposal preview | Geometry, stations, repository truth, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `CHANGE_CONSTRUCTION_MIX` | Estimate cost, financial model, workbook section, proposal preview | Geometry, stations, repository truth, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `CHANGE_SEGMENT_UNIT_COST` | Estimate cost, financial model, workbook section, proposal preview | Geometry, stations, repository truth, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `EXCLUDE_SEGMENT` | Map projection, route summary, estimate cost, workbook section, proposal preview | Route repository geometry, inventory, Engineering objects, ScopeVersion | `PATCH_ONLY` |
| `RESTORE_SEGMENT` | Map projection, route summary, estimate cost, workbook section, proposal preview | Route repository geometry, inventory, Engineering objects, ScopeVersion | `PATCH_ONLY` |
| `ADD_MANUAL_COST_ADJUSTMENT` | Estimate cost, financial model, workbook section, proposal preview | Geometry, stations, inventory, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `REMOVE_MANUAL_COST_ADJUSTMENT` | Estimate cost, financial model, workbook section, proposal preview | Geometry, stations, inventory, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `CHANGE_MARGIN_ASSUMPTION` | Financial model, workbook section, proposal preview | Geometry, stations, inventory, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `CHANGE_MONTHLY_REVENUE` | Financial model, workbook section, proposal preview | Geometry, stations, inventory, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |
| `CHANGE_TERM_MONTHS` | Financial model, workbook section, proposal preview | Geometry, stations, inventory, Engineering objects, ScopeVersion | `ESTIMATE_DOMAIN_ONLY` |

## Invariant Evidence

`RouteEditImpactReport` explicitly reports:

- `fullRouteRebuild: false`
- `fullWorkbookRecalculation: false`
- `inventoryReimport: false`
- `kmzProjectionRebuild: false`
- `mapFullRerender: false`

`RouteEditPatch` carries:

- `noRepositoryCommit: true`

`RouteEditSession` carries:

- `repositoryTruthUnchanged: true`
- `noAutoSave: true`
- `noScopeVersionCreation: true`
- `noInventoryMutation: true`

`RouteEditRevisionRecord` carries:

- `patchSetOnly: true`
- `assembledRouteEmbedded: false`
- `repositoryTruthUnchangedUntilExplicitSave: true`

## Current Dependency Flow

Implemented:

Repository route/estimate snapshot

-> RouteEditSession

-> RouteEditPatch

-> RouteEditReducer

-> RouteEditProjection

-> RouteEditImpactReport

-> RouteEditRevisionRecord on explicit save

## Deviation From Target Architecture

Target:

Repository Truth

-> Commercial Change Set

-> Patch Engine

-> Corridor Execution Engine

-> Projection Engine

-> Commercial Projection

-> Workbook / Estimate / Proposal / Engineering Preview / Map

Actual:

Repository Truth and active commercial draft state are loaded directly into `GoogleRfpWorkspace`.

Route edit actions use patch sessions.

Other commercial workflow actions still operate as direct workflow/API actions rather than first-class Change Set records.

## Readiness

Patch model stability: `READY`

Universal Commercial Change Set: `NOT READY`

Persistence readiness: `PARTIALLY READY`

## Required Before PostgreSQL

1. Create `CommercialChangeSet` as a domain object.
2. Persist patch sets in `commercial_change_sets` and `commercial_change_set_patches`.
3. Convert non-route operator changes into Change Set entries.
4. Attach each Change Set to opportunity, route repository, proposal, workbook, estimate, and Draft IOF references.
5. Use Change Set IDs as inputs to projections.
6. Keep repository truth unchanged until explicit commit.
