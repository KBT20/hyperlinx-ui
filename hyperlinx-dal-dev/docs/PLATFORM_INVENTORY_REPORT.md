# DAL Platform Inventory Report

Date: 2026-06-14

Scope: root Hyperlinx UI is reference-only. Implementation target is `hyperlinx-dal-dev/`.

## 1. Design

- File locations: `src/DMredlinedev.tsx`, `src/DesignMode.tsx`, `src/core/iof/governance.ts`, `src/core/iof/types.ts`.
- Purpose: proposed route ingestion, stationing, civil/BOM/financial modeling, IOF package assembly.
- Inputs: design route CSV/GeoJSON/KML/KMZ, sites, route assumptions, economics.
- Outputs: route coordinates, stations, approved ScopeVersion package, budget and BOM models.
- API dependencies: IOF `/scope/assemble`, Chicago baseline APIs in legacy paths.
- State dependencies: root `App.tsx` route/site/station/opportunity handoff.
- Graph dependencies: proposed route stationing; baseline graph must remain separate.
- ScopeVersion dependencies: strong dependency through `createApprovedScopePackage`.
- Copy safely: no, too coupled to production behavior.
- Rewrite for DAL: yes, as a DAL DesignCandidate layer later.
- Shared DAL library later: stationing/math helpers can be extracted after tests.

## 2. Prism

- File locations: `src/Prism/PrismMode.tsx`, `src/types/fiberlightBeta.ts`, `src/types/opportunity.ts`, `src/llm/prism.ts`.
- Purpose: baseline selection, site campaign scoring, serviceability, opportunity batching.
- Inputs: stored baseline metadata, baseline graph details, target sites, thresholds.
- Outputs: serviceability results, opportunity batches/seeds.
- API dependencies: Chicago baselines/uploads, IOF `/graph/edge`, `/scope/:id`, AI proxy.
- State dependencies: root opportunity handoff and active baseline state.
- Graph dependencies: `buildServiceabilityResults`, graph edge/node distance.
- ScopeVersion dependencies: existing baseline scope references and future child scopes.
- Copy safely: no, mixed legacy/prod concerns.
- Rewrite for DAL: yes, v1 implemented in DAL from `InventoryGraph`.
- Shared DAL library later: nearest asset/serviceability functions.

## 3. Marketplace

- File locations: `src/MarketplaceMode.tsx`, `src/components/ScopeSelector.tsx`.
- Purpose: pricing submission against approved ScopeVersions.
- Inputs: ScopeVersion, stations, budget line items, market pricing assumptions.
- Outputs: pricing close payload.
- API dependencies: IOF `/scope/:id`, `/close`.
- State dependencies: local selected station/pricing state.
- Graph dependencies: route/station display.
- ScopeVersion dependencies: high.
- Copy safely: no, production close contract bound.
- Rewrite for DAL: yes, v1 quote model implemented.
- Shared DAL library later: quote calculations if DAL pricing matures.

## 4. Control

- File locations: `src/ControlPlane.tsx`, `src/utils/graphBuilder.ts`, `src/core/iof/replayEngine.ts`.
- Purpose: load ScopeVersion, close history, activate work, release budget.
- Inputs: ScopeVersion, closes, station IDs.
- Outputs: work activation and budget close events.
- API dependencies: IOF `/scope/:id`, `/closes`, `/close`.
- State dependencies: selected scope, closes, replay state.
- Graph dependencies: derived graph state from stations/edges.
- ScopeVersion dependencies: high.
- Copy safely: no.
- Rewrite for DAL: yes, v1 work item queue implemented.
- Shared DAL library later: replay/state derivation helpers.

## 5. Field

- File locations: `src/FieldMode.tsx`, `src/components/CloseAction.tsx`, `src/components/StationSelector.tsx`, `src/config/roles.ts`.
- Purpose: field close submission with GPS/photo evidence.
- Inputs: ScopeVersion, station/work object, role, GPS/photo/notes.
- Outputs: close payloads and validation calls.
- API dependencies: IOF close/validate/replay/completion endpoints.
- State dependencies: local station/work/evidence state.
- Graph dependencies: route/station display; baseline graph locator not wired.
- ScopeVersion dependencies: high.
- Copy safely: no, production close contract.
- Rewrite for DAL: yes, v1 closure event capture implemented.
- Shared DAL library later: closure schema and evidence metadata.

## 6. Twin

- File locations: `src/TwinMode.tsx`, `src/core/iof/replayEngine.ts`, `src/core/iof/financialReplayEngine.ts`.
- Purpose: replay visualization, station state, anomaly/recommendation summaries.
- Inputs: ScopeVersion, closes, financial assumptions.
- Outputs: derived state, timeline, operator responses.
- API dependencies: IOF scope/closes, Chicago `/api/twin`.
- State dependencies: selected scope, closes, operator console.
- Graph dependencies: route/station map.
- ScopeVersion dependencies: high.
- Copy safely: no.
- Rewrite for DAL: yes, v1 read-only state visualization implemented.
- Shared DAL library later: timeline and progress summarizers.

## 7. Translate

- File locations: `src/DMredlinedev.tsx`.
- Purpose: parse advisory and route files into design/baseline previews.
- Inputs: CSV, JSON/GeoJSON, KML/KMZ, text, large uploads.
- Outputs: route/site previews, inferred assumptions.
- API dependencies: Chicago upload/ingestion APIs.
- State dependencies: root Design props and preview state.
- Graph dependencies: KML/KMZ baseline graph parser.
- ScopeVersion dependencies: indirect through Design.
- Copy safely: no, embedded in Design.
- Rewrite for DAL: yes, v1 implemented independently.
- Shared DAL library later: parser primitives after validation.

## 8. Inventory Graphs

- File locations: `src/api/baselineGraphs.ts`, `server/index.js`, `src/types/fiberlightBeta.ts`.
- Purpose: imported carrier infrastructure graph persistence and retrieval.
- Inputs: parsed graph nodes/edges/stations/routes.
- Outputs: metadata, chunks/full graph, inventory scope reference.
- API dependencies: root currently targets Chicago `/api/baseline-graphs`.
- State dependencies: Prism/Design graph memory.
- Graph dependencies: central.
- ScopeVersion dependencies: inventory-scope concept only.
- Copy safely: no, endpoint names and Chicago coupling differ.
- Rewrite for DAL: yes, DAL `/api/inventory-graphs` with fallback implemented.
- Shared DAL library later: graph chunking/normalization.

## 9. Baseline Graphs

- File locations: `src/types/fiberlightBeta.ts`, `src/DMredlinedev.tsx`, `src/api/baselineGraphs.ts`.
- Purpose: immutable imported carrier graph creation, stationing, serviceability source.
- Inputs: KML/KMZ/GeoJSON LineStrings.
- Outputs: graph geometry, nodes, edges, stations.
- API dependencies: Chicago baseline graph persistence in root.
- State dependencies: current baseline graph state and Prism memory.
- Graph dependencies: central.
- ScopeVersion dependencies: future extension flow.
- Copy safely: logic can inspire DAL, but no direct import.
- Rewrite for DAL: yes.
- Shared DAL library later: graph math and stationing.

## 10. ScopeVersion Architecture

- File locations: `src/core/iof/*`, `src/components/ScopeSelector.tsx`.
- Purpose: canonical truth package and replay.
- Inputs: approved design route package, close history.
- Outputs: ScopeVersion, replay state, closes.
- API dependencies: IOF `/scope/assemble`, `/scope/:id`, `/iof/scopeVersions`.
- State dependencies: root selected scope state.
- Graph dependencies: proposed route graph/stations.
- ScopeVersion dependencies: authoritative production behavior.
- Copy safely: no.
- Rewrite for DAL: yes, v1 DAL-safe ScopeVersion utilities implemented.
- Shared DAL library later: canonical truth model once stable.

## 11. IOF Package Creation

- File locations: `src/core/iof/governance.ts`, `src/core/iof/iofPackage.ts`.
- Purpose: approved package generation for production ScopeVersions.
- Inputs: corridor/segment/route/stations/budget/constraints.
- Outputs: canonical IOF package.
- API dependencies: IOF assemble endpoint in callers.
- State dependencies: Design approval state.
- Graph dependencies: stationing and route geometry.
- ScopeVersion dependencies: critical.
- Copy safely: no.
- Rewrite for DAL: no production parity yet; build DAL v1 separately.
- Shared DAL library later: only after schema governance.

## 12. Graph Rendering

- File locations: `src/DMredlinedev.tsx`, `src/Prism/PrismMode.tsx`, `src/DesignMode.tsx`.
- Purpose: visualize route/graph/stations.
- Inputs: GeoJSON routes, graph edges/stations.
- Outputs: MapLibre/Leaflet layers.
- API dependencies: none directly.
- State dependencies: active graph/route state.
- Graph dependencies: high.
- ScopeVersion dependencies: route/station display.
- Copy safely: no, renderer choices mixed with app state.
- Rewrite for DAL: yes, `GraphMap` canvas v1 implemented.
- Shared DAL library later: viewport filtering/simplification.

## 13. Map Rendering

- File locations: `src/DesignMode.tsx` MapLibre, `src/Prism/PrismMode.tsx` Leaflet.
- Purpose: UI geospatial context.
- Inputs: route positions, station/site points.
- Outputs: interactive map.
- API dependencies: tile providers/public OSRM in related logic.
- State dependencies: local map refs.
- Graph dependencies: route/graph geometry.
- ScopeVersion dependencies: station map.
- Copy safely: no.
- Rewrite for DAL: yes, canvas map v1; production-grade map later.
- Shared DAL library later: geometry projection utilities.

## 14. Route Rendering

- File locations: `src/DMredlinedev.tsx`, `src/DesignMode.tsx`, `src/Prism/PrismMode.tsx`.
- Purpose: route line visualization.
- Inputs: route coordinates or graph route geometries.
- Outputs: map line layers.
- API dependencies: none directly.
- State dependencies: active route/baseline.
- Graph dependencies: route geometry.
- ScopeVersion dependencies: route canonical truth.
- Copy safely: partially as reference only.
- Rewrite for DAL: yes.
- Shared DAL library later: simplification and fit-bounds.

## 15. Stationing Logic

- File locations: `src/DMredlinedev.tsx`, `src/DesignMode.tsx`, `src/types/fiberlightBeta.ts`.
- Purpose: generate station points along routes/edges.
- Inputs: route coordinates, interval feet.
- Outputs: station labels and points.
- API dependencies: none.
- State dependencies: design/current graph.
- Graph dependencies: high.
- ScopeVersion dependencies: proposed-route stations.
- Copy safely: no direct copy; behavior can be mirrored.
- Rewrite for DAL: v1 station generation implemented in Translate.
- Shared DAL library later: yes.

## 16. Field Closure Logic

- File locations: `src/FieldMode.tsx`, `src/core/iof/closeHelpers.ts`.
- Purpose: create and replay close events.
- Inputs: station/work object/evidence.
- Outputs: close records and replay maps.
- API dependencies: IOF close APIs.
- State dependencies: Field local state.
- Graph dependencies: station references.
- ScopeVersion dependencies: high.
- Copy safely: no.
- Rewrite for DAL: v1 closure events implemented.
- Shared DAL library later: close validation helpers.

## 17. Twin State Visualization

- File locations: `src/TwinMode.tsx`.
- Purpose: station status, timeline, financial replay, operator console.
- Inputs: closes, ScopeVersion, financial model.
- Outputs: derived operational view.
- API dependencies: IOF and Chicago AI.
- State dependencies: selected station/scope.
- Graph dependencies: route/station map.
- ScopeVersion dependencies: high.
- Copy safely: no.
- Rewrite for DAL: v1 state visualization implemented.
- Shared DAL library later: operational timeline summaries.

## 18. Marketplace Pricing Or Opportunity Logic

- File locations: `src/MarketplaceMode.tsx`, `src/Prism/PrismMode.tsx`, `src/types/opportunity.ts`.
- Purpose: pricing closes and opportunity readiness.
- Inputs: ScopeVersion, opportunity/serviceability context.
- Outputs: quotes/closes/opportunity batches.
- API dependencies: IOF closes, root Prism APIs.
- State dependencies: local pricing and opportunity state.
- Graph dependencies: serviceability.
- ScopeVersion dependencies: high for Marketplace.
- Copy safely: no.
- Rewrite for DAL: v1 deterministic quote implemented.
- Shared DAL library later: quote and opportunity schemas.

## 19. Control Activation/Deactivation Logic

- File locations: `src/ControlPlane.tsx`, `src/core/iof/closeHelpers.ts`.
- Purpose: station activation and budget release closes.
- Inputs: selected station/scope.
- Outputs: close events.
- API dependencies: IOF `/close`.
- State dependencies: replay activation maps.
- Graph dependencies: station IDs.
- ScopeVersion dependencies: high.
- Copy safely: no.
- Rewrite for DAL: v1 work item statuses implemented.
- Shared DAL library later: status machine.

## 20. Shared Utilities

- File locations: `src/utils/graphBuilder.ts`, `src/core/iof/*`, `src/core/graph/*`.
- Purpose: graph transforms, replay, package helpers.
- Inputs: scope, closes, geometry.
- Outputs: derived state and package data.
- API dependencies: indirect.
- State dependencies: mode callers.
- Graph dependencies: high.
- ScopeVersion dependencies: high.
- Copy safely: selective only after tests.
- Rewrite for DAL: yes where needed.
- Shared DAL library later: yes.

## 21. API Clients

- File locations: `src/config/api.ts`, `src/api/baselines.ts`, `src/api/ingestion.ts`, `src/api/baselineGraphs.ts`.
- Purpose: Chicago/IOF client calls.
- Inputs: payloads, IDs, files.
- Outputs: backend responses.
- API dependencies: hardcoded or env-backed production/demo endpoints.
- State dependencies: callers.
- Graph dependencies: baseline graph client.
- ScopeVersion dependencies: IOF clients.
- Copy safely: no.
- Rewrite for DAL: yes, `src/api/dalClient.ts`.
- Shared DAL library later: typed client contracts.

## 22. Local Storage Usage

- File locations: `src/types/fiberlightBeta.ts`, `src/api/baselineGraphs.ts`.
- Purpose: beta persistence/fallback for campaigns/graphs.
- Inputs: serialized app records.
- Outputs: local records.
- API dependencies: fallback only.
- State dependencies: browser storage.
- Graph dependencies: graph metadata/details.
- ScopeVersion dependencies: minimal.
- Copy safely: as concept only.
- Rewrite for DAL: yes, temporary fallback clearly marked.
- Shared DAL library later: only for dev/test.

## 23. State Containers

- File locations: `src/App.tsx`, mode-local `useState`, DAL `src/dal/DALState.tsx`.
- Purpose: root mode routing and cross-mode handoff.
- Inputs: selected mode/scope/graph/opportunities.
- Outputs: props to modes.
- API dependencies: none directly.
- State dependencies: high.
- Graph dependencies: baseline/design handoff.
- ScopeVersion dependencies: selected scope.
- Copy safely: no.
- Rewrite for DAL: yes, DAL separate state container implemented.
- Shared DAL library later: no, app-specific.

## 24. Data Models/Types

- File locations: `src/types/fiberlightBeta.ts`, `src/types/opportunity.ts`, `src/core/iof/types.ts`, `src/core/graph/types.ts`.
- Purpose: baseline graph, campaigns, opportunities, IOF types.
- Inputs: domain records.
- Outputs: compile-time contracts.
- API dependencies: indirect.
- State dependencies: broad.
- Graph dependencies: high.
- ScopeVersion dependencies: high.
- Copy safely: partial reference only.
- Rewrite for DAL: yes, `hyperlinx-dal-dev/src/types/dal.ts`.
- Shared DAL library later: yes, once DAL contracts stabilize.

## 25. Technical Debt Or Production Coupling

- File locations: root-wide.
- Purpose: known coupling across UI modes and backend constants.
- Inputs: production/demo service assumptions.
- Outputs: deployment risk.
- API dependencies: Chicago and IOF endpoints.
- State dependencies: root shared app state and mode-local duplication.
- Graph dependencies: baseline graph persistence/retrieval incomplete.
- ScopeVersion dependencies: production IOF package path.
- Copy safely: no.
- Rewrite for DAL: yes; isolate first, extract later.
- Shared DAL library later: only after DAL test coverage.

