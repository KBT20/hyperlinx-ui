# DAL Platform Plan

Date: 2026-06-14

DAL is the development/staging platform. Chicago remains production/demo truth and is not an implementation target.

## Core Architecture

```text
Inventory Graph
  -> ScopeVersion
  -> Operational State
```

DAL source truth starts with imported carrier inventory. ScopeVersion candidates reference immutable inventory graph IDs. Operational state is produced by opportunities, quotes, work items, field closures, and twin replay events.

## 1. DAL Runtime Shell

- Location: `src/dal/DALApp.tsx`.
- Own app shell, banner, API target display, and workspace outlet.
- Does not import root `App.tsx` or production mode state.

## 2. DAL Navigation

- Location: `src/dal/DALNavigation.tsx`.
- Workspaces: Translate, Inventory Graphs, Graph Viewer, Design, Prism, Marketplace, Control, Field, Twin, Operational Intelligence.
- Navigation changes DAL state only.

## 3. DAL State Container

- Location: `src/dal/DALState.tsx`.
- Holds selected inventory graph, scope version, opportunity, and workspace.
- No shared top-level production state.

## 4. DAL API Layer

- Location: `src/api/dalClient.ts`, `src/config/dalApi.ts`.
- Uses only `VITE_DAL_API`, `VITE_DAL_BASELINE_GRAPH_API`, and `VITE_DAL_INVENTORY_GRAPH_API`.
- Provides temporary localStorage fallback when DAL backend endpoints are missing.

## 5. DAL Translate Layer

- Location: `src/workspaces/TranslateWorkspace.tsx`.
- Parses CSV, KML, KMZ, and GeoJSON into `InventoryGraph`.
- Runs validation before save.

## 6. DAL Validation Layer

- Location: `src/types/dal.ts`, `TranslateWorkspace.tsx`.
- Checks missing coordinates, duplicate nodes/edges, orphan nodes, invalid geometry, empty routes, unconnected routes, excessive duplicate geometry, unsupported structure.
- Produces PASS/WARNING/FAIL.

## 7. DAL Inventory Graph Layer

- Location: `src/workspaces/DALInventoryWorkspace.tsx`, `src/api/dalClient.ts`.
- Lists, loads, deletes local fallback graphs, and sends graphs to Viewer/Prism.
- API target: `/api/inventory-graphs`.

## 8. DAL Graph Viewer Layer

- Location: `src/workspaces/GraphViewerWorkspace.tsx`, `src/components/GraphMap.tsx`.
- Canvas renderer with viewport filtering, sampling, layer toggles, fit bounds, statistics, validation summary, and feature inspector.
- Dense nodes/edges default off.

## 9. DAL ScopeVersion Layer

- Location: `src/scopeversion/scopeVersionUtils.ts`.
- Generates DAL-safe v1 ScopeVersions from InventoryGraph, PrismOpportunity, and FieldClosure.
- Does not attempt production IOF package parity yet.

## 10. DAL Prism Layer

- Location: `src/workspaces/PrismWorkspace.tsx`.
- Consumes selected `InventoryGraph`.
- Performs nearest node/station/edge search, serviceability thresholding, and Opportunity Seed creation.

## 11. DAL Marketplace Layer

- Location: `src/workspaces/MarketplaceWorkspace.tsx`.
- Consumes Opportunity Seed and ScopeVersion candidate context.
- Creates deterministic v1 quote records: NRC, MRC, term, TCV, notes.

## 12. DAL Control Layer

- Location: `src/workspaces/ControlWorkspace.tsx`.
- Creates and updates work items.
- Statuses: PENDING, ACTIVE, ON_HOLD, COMPLETE, CANCELLED.

## 13. DAL Field Layer

- Location: `src/workspaces/FieldWorkspace.tsx`.
- Consumes active work items and selected graph/scope.
- Creates station or segment closure events with footage, crew, date, and notes.

## 14. DAL Twin Layer

- Location: `src/workspaces/TwinWorkspace.tsx`.
- Read-only visualization over work items, field closures, graph/scope references, and timeline.
- Twin does not mutate inventory graph.

## 15. DAL Operational Intelligence Layer

- Location: `src/workspaces/OperationalIntelligenceWorkspace.tsx`.
- Summarizes graphs, opportunities, work, closures, twin state, and readiness.

## Data Promotion Rule

DAL may break during development. Chicago must not. DAL artifacts move through Integration/Test before production promotion.

