# Hyperlinx System Inventory and Roadmap Audit

Date: 2026-06-13

Scope: documentation and discovery only. This inventory is based on the current repository state in `hyperlinx-ui`, including `src`, `server`, shared core modules, API clients, and the active Design/Baseline Graph work.

## 1. Executive Summary

### Current Platform State

Hyperlinx is a React/Vite beta platform with six primary UI modes:

- Design
- Prism
- Marketplace
- Control
- Field
- Twin

The app shell lives in `src/App.tsx` and shares selected route, sites, stations, and opportunity batch state between modes. Most persistent workflows rely on two remote service families:

- Chicago API at `http://64.34.93.5:3001`
- IOF API at `http://64.34.93.5:4000`

The strongest current system is Design. It can ingest design routes, generate stationing, model route economics, create an IOF package, and post to `/scope/assemble`.

The largest active transition is Baseline Graph. Carrier inventory is being moved away from `routeCoords` and toward immutable `BASELINE_GRAPH` infrastructure used by Prism and future ScopeVersion extensions.

### Major Working Systems

- Design route ingestion for CSV/GeoJSON design routes.
- Design stationing for proposed routes.
- Design civil, BOM, node, SVA, demand, and financial models.
- IOF package generation from approved Design routes.
- Field close submission against loaded ScopeVersions.
- Control loading of ScopeVersion and close history.
- Twin loading of ScopeVersion and close history, with local replay and AI operator integration.
- Marketplace basic station selection and pricing close submission.
- Chicago upload/ingestion client for large files.

### Partially Working Systems

- Translate ingestion and normalization.
- Baseline Graph KMZ/KML ingestion and rendering.
- Prism baseline/campaign serviceability workflow.
- Graph station foundation and nearest station lookup.
- LLM operator surfaces for Prism/Twin.
- Backend storage and graph storage contracts.
- Authentication and permissions.

### Known Gaps

- No real authentication, account isolation, or persisted user roles in the UI.
- Hardcoded service endpoints are spread across files.
- Baseline Graph persistence is currently summary-first; full graph storage/retrieval contract needs backend completion.
- Prism has both legacy route-sweep logic and newer baseline graph serviceability logic.
- ScopeVersion extension creation from Baseline Graph is not implemented.
- Field locator workflow is not yet integrated with Baseline Graph stations.
- Twin duration/production telemetry is derived, not authoritative.
- Automated tests are minimal or absent for the platform-critical workflows.

### Top Priorities

1. Complete Baseline Graph ingestion, storage, rendering, validation, and graph retrieval.
2. Stabilize Prism serviceability against Baseline Graph edges and nodes.
3. Define ScopeVersion extension workflow from Baseline Graph opportunity batches.
4. Integrate Field locator station lookup and production reporting.
5. Mature Twin duration tracking and replay from authoritative closes.
6. Add account, role, and permission architecture.
7. Freeze Design except for bug fixes.

## 2. Translate

### Status

Partial.

Translate exists inside `src/DMredlinedev.tsx` as the right-side `StellaOS Translate` panel rather than as a separate module.

### Capabilities

- CSV ingestion through `Papa.parse`.
- JSON/GeoJSON preview parsing.
- KML/KMZ parsing through JSZip and `@tmcw/togeojson`.
- TXT/MD advisory parsing.
- PDF/DOCX/XLSX placeholder capture with no structured extraction.
- Large Dataset Mode toggle and Chicago upload pipeline.
- Advisory inference of network type, role, product type, constraints, product hints, and budget assumptions.
- Send-to-Design handoff for routes, sites, inferred product/network type, and budget assumptions.
- Linkage to server-side large dataset baseline IDs.

### Components

- `src/DMredlinedev.tsx`
  - `parseTranslateFile`
  - `createPreviewFromUpload`
  - `previewFromJson`
  - `previewFromCsv`
  - `buildPreviewFromText`
  - `handleTranslateUpload`
  - `applyTranslatePreview`
  - `LargeDatasetDiagnosticsPanel`
- `src/api/ingestion.ts`
  - `uploadRawDataset`
  - `startIngestion`
  - `getIngestionJob`
  - `cancelIngestionJob`
- API calls:
  - `POST /api/uploads`
  - `POST /api/uploads/:uploadId/ingest`
  - `GET /api/ingestion-jobs/:jobId`

### Known Issues

- Translate is embedded in Design, making ownership and testing harder.
- PDF/DOCX/XLSX are not actually extracted.
- Translate can produce advisory `routeCoords`, which must remain separate from immutable baseline graph inventory.
- Large dataset upload depends on Chicago backend behavior and response shape.
- The UI uses status strings and diagnostics, but no durable ingest audit log is stored client-side.
- KML/KMZ support has recently been instrumented for ingest tracing but still needs production validation with FiberLight KMZ data.
- No schema validation for uploaded advisory payloads.
- No user-facing validation queue or extraction confidence workflow.

## 3. Design

### Status

Working, with caution.

Design is the most complete system in the current codebase. It should be treated as stable and frozen except for bug fixes.

### Capabilities

- Proposed route upload from CSV, GeoJSON, and JSON.
- Route coordinate extraction.
- Optional OSRM snap-to-streets.
- Route stationing with station labels such as `0+00`.
- Route diversity modeling.
- Civil construction model.
- BOM model.
- Node and power model.
- Demand sets.
- ICDE/SVA scoring.
- Financial model and budget line items.
- Design approval workflow.
- IOF package generation through `createApprovedScopePackage`.
- POST to IOF `/scope/assemble`.
- Existing network registration as `EXISTING_NETWORK`.
- Large dataset ingestion to Chicago for stored baseline inventory.

### Components

- `src/DMredlinedev.tsx`
  - Route parsing: `getAllLineCoordsFromGeoJSON`, `routeCoordsFromCsvRows`
  - Stationing: `buildStationPoints`, `designStationsFromRoute`
  - Routing: `osrmRouteThroughWaypoints`
  - Civil model: `buildCivilModel`
  - BOM model: `buildBomModel`
  - Node model: `buildNodeInfrastructureModel`
  - Financial model: `buildFinancialModel`
  - SVA: `buildSVAResult`, `buildRouteNodes`
  - Approval: `approveDesign`
- `src/core/iof/governance.ts`
  - `createApprovedScopePackage`
  - default constraints, objects, close taxonomy, state model
- `src/core/iof/types.ts`
- API calls:
  - `POST /scope/assemble`
  - Chicago baseline APIs for inventory registration.

### Known Issues

- `DMredlinedev.tsx` is very large and owns many unrelated concerns: Translate, Design, Baseline Graph, map rendering, economics, ingestion, and UI controls.
- Many diagnostics are console-based and noisy.
- Design route economics are model-driven and not calibrated against live unit-cost databases.
- OSRM route calls use public OSRM service.
- Existing network/baseline handling and proposed design handling live in the same file.
- Design uses hardcoded default corridor/segment from `App.tsx`.
- No automated regression test suite covers IOF approval, economics, or stationing.

### Recommendation

Freeze Design unless bug fixes are required.

Justification: Design contains the critical approved ScopeVersion and economics path. It already produces IOF packages and downstream systems depend on its shape. New development should focus on Baseline Graph, Prism, Field, Twin, and accounts rather than destabilizing Design.

## 4. Baseline Graph

### Status

Partial and actively under development.

### Capabilities

- Dataset type `BASELINE_GRAPH`.
- Recursive KML/KMZ geometry discovery through `extractLineStringsRecursive`.
- Graph generation from LineStrings through `buildBaselineGraph`.
- Graph nodes and edges with edge length and endpoint IDs.
- Graph station foundation through `GraphStation` and generated station labels.
- Nearest graph station lookup through exported `findNearestStation`.
- Dedicated MapLibre source/layer:
  - `baseline-graph-source`
  - `baseline-graph-layer`
- Dedicated graph station source/layers:
  - `baseline-graph-stations-source`
  - `baseline-graph-station-dots`
  - `baseline-graph-station-labels`
- Zoom-based station label intervals:
  - below 13: no labels
  - 13-15: 1000 ft
  - 15-17: 100 ft
  - above 17: 10 ft
- Baseline Graph mode disables heavy Design calculations.
- Summary-only baseline save payload to avoid 413 payload failures.

### Components

- `src/types/fiberlightBeta.ts`
  - `BaselineGraphGeometry`
  - `BaselineGraphNode`
  - `BaselineGraphEdge`
  - `GraphStation`
  - `BaselineGraph`
  - `extractLineStringsRecursive`
  - `buildBaselineGraph`
  - `generateGraphStations`
  - `findNearestStation`
  - `buildServiceabilityResults`
- `src/DMredlinedev.tsx`
  - `handleImportBaselineGraph`
  - KMZ/KML ingest trace
  - `baselineGraphFeatureCollection`
  - `bboxFromBaselineGraph`
  - graph source/layer map rendering
  - summary-only `createBaseline` payload
- `src/api/baselines.ts`
  - `CreateBaselinePayload`
  - `normalizeBaseline`
  - `listBaselines`
  - `createBaseline`
  - `loadBaseline`

### Known Issues

- Full graph persistence and retrieval contract is not finalized. Current save path intentionally avoids raw graph geometry to prevent 413 payloads.
- Summary-only persistence means reloading a graph from Chicago may not return renderable edges unless the backend stores graph data out-of-band.
- Current graph builder splits edges by coordinate segment; it does not yet validate topology, duplicate features, directionality, or metadata.
- KML parser diagnostics are exhaustive but not yet validated against known FiberLight KMZ success logs.
- Graph station generation is a foundation, not a locator workflow.
- Nearest station lookup is exported but not wired into Field.
- Graph editing is intentionally absent.
- Graph versioning is absent.
- Carrier metadata model is minimal.
- No backend graph tile or chunked graph streaming layer exists in the UI.

### Missing Features

- Graph validation.
- Graph versioning.
- Carrier metadata schema.
- Immutable graph storage with chunked/source-object persistence.
- Graph retrieval by baseline ID.
- Graph simplification for rendering without mutating source geometry.
- Graph edit/change proposal workflow.
- Server-side nearest edge/node/station services.
- Spatial indexing.
- Baseline-to-ScopeVersion extension creation.

## 5. Prism

### Status

Partial.

Prism has a working candidate campaign and serviceability path for normal baselines, with emerging graph integration. Legacy route sweep and quick quote logic still exists and is disabled for Baseline Graph mode.

### Capabilities

- Stored baseline selection from Chicago.
- Baseline geometry load.
- Baseline Graph metadata load path.
- Candidate site upload from CSV/GeoJSON/JSON.
- Large target site campaign ingestion through Chicago.
- Serviceability analysis through `buildServiceabilityResults`.
- Graph edge/node distance outputs when active baseline has graph edges.
- Selection of opportunity candidates.
- Opportunity batch creation.
- Send opportunity batch to Design.
- Legacy route sweep proposal generation.
- Quick quote model.
- LLM chat and target sweep hooks.
- Map visualization through React Leaflet.

### Components

- `src/Prism/PrismMode.tsx`
  - `loadSelectedBaseline`
  - `handleCampaignUpload`
  - `buildServiceabilityResults` integration
  - `createOpportunityBatch`
  - `sendBatchToDesign`
  - `generateQuickQuote`
  - `runLLMSweep`
  - `persistEdge`
- `src/types/fiberlightBeta.ts`
  - site campaign, serviceability, opportunity batch types
- `src/types/opportunity.ts`
  - Opportunity domain model
- API calls:
  - Chicago baselines
  - Chicago uploads/ingestion
  - `POST /api/twin` for chat-like AI calls
  - IOF `/scope/:scopeVersion`
  - IOF `/graph/edge`

### Known Issues

- Prism has mixed responsibilities: legacy approved-scope route sweep, baseline serviceability, graph serviceability, quick quote, chat, and opportunity batching.
- Baseline Graph mode depends on backend returning graph edges; summary-only baseline persistence may not be enough for reload.
- LLM routes are inconsistent: server exposes `/api/prism`, but Prism chat uses `/api/twin` in places.
- `runPrismLLM` imports OpenAI client code that is not clearly used in the browser-safe path.
- Opportunity creation is in-memory until sent to Design; no durable opportunity repository is evident.
- Serviceability lacks server-side spatial indexing and may become expensive for large graph edge counts.

### Missing Features

- Durable opportunity store.
- Server-side graph nearest edge/node service.
- Rank explanations tied to graph metrics.
- Opportunity approval lifecycle.
- Child ScopeVersion generation from a selected opportunity.
- Prism-specific API contract distinct from Twin.
- Batch edit/review workflow for large campaigns.

## 6. Marketplace

### Status

Partial.

Marketplace provides a basic pricing and vendor-assumption surface but is not yet a full marketplace.

### Capabilities

- ScopeVersion selection.
- Scope load from IOF.
- Station selection.
- Budget line item display from approved Design budget model.
- Editable market unit cost and market amount per budget line item.
- Price-per-foot and production-rate entry.
- Pricing close submission through `/close` with close type `pricing.submitted`.
- Map display of route and stations through React Leaflet.

### Components

- `src/MarketplaceMode.tsx`
- `src/components/ScopeSelector.tsx`
- API calls:
  - `GET /scope/:scopeVersion`
  - `POST /close`

### Known Issues

- No vendor/account management.
- No bid comparison workflow.
- No quote attachment workflow.
- No authentication or vendor role isolation.
- Station grouping is simple and not tied to work package generation.
- Market pricing assumptions are submitted as closes but not clearly replayed into Design/Control decisions.

### Missing Features

- Vendor profiles.
- Bid packages.
- Quote versioning.
- Marketplace approval workflow.
- Procurement status.
- Contracting and award logic.
- Integration with Control funding gates beyond close history.

## 7. Control

### Status

Partial.

Control can load a ScopeVersion, inspect closes, derive state, activate work, and release budget, but it is still an operational prototype.

### Capabilities

- ScopeVersion selection.
- Scope and close history load.
- Canonical truth normalization.
- IOF replay state computation.
- Graph state derivation using `deriveState`.
- Station activation through `work.activated` close.
- Budget release through `budget.released` close.
- Summary metrics for station state and events.
- Graph debug panel integration.

### Components

- `src/ControlPlane.tsx`
- `src/components/ScopeSelector.tsx`
- `src/components/GraphDebugPanel.tsx`
- `src/utils/graphBuilder.ts`
- `src/core/iof/replayEngine.ts`
- `src/core/graph/state.ts`
- API calls:
  - `GET /scope/:scopeVersion`
  - `GET /closes`
  - `POST /close`

### Known Issues

- Graph state helper is lightweight and has unreachable code after a return.
- Budget release is a close event but not clearly permission-gated.
- Control uses scope/station normalization logic separate from Field and Twin.
- No real admin roles or approval chains.
- No operational scheduling, crew assignment, or exception queue.

### Missing Features

- Work package assignment.
- Crew routing.
- Supervisor approval.
- Budget governance rules.
- Operational dependency graph.
- Field dispatch integration.

## 8. Field

### Status

Partial.

Field supports ScopeVersion loading and close submission with GPS/photo evidence, but lacks full locator integration and production reporting depth.

### Capabilities

- ScopeVersion selection.
- Station selector.
- Scope load from IOF.
- Close history load.
- Station/object work selection.
- Role permission checks from `ROLE_PERMISSIONS`.
- GPS capture through browser geolocation.
- Photo capture through file input/base64 preview.
- Close submission through `/close`.
- Close validation through `/iof/validate`.
- Replay execution load through `/iof/replay/exec/:closeId`.
- Station completion load.
- Corridor completion load.
- Ledger chain check.
- Map display of route, stations, selected work, and GPS-observed closes.

### Components

- `src/FieldMode.tsx`
- `src/components/ScopeSelector.tsx`
- `src/components/StationSelector.tsx`
- `src/components/CloseAction.tsx`
- `src/config/roles.ts`
- IOF helpers:
  - `createApprovedScopePackage`
  - `computeScopeReplayState`
  - close helpers
- API calls:
  - `GET /scope/:scopeVersion`
  - `GET /closes`
  - `POST /close`
  - `POST /iof/validate`
  - `GET /iof/replay/exec/:closeId`
  - `GET /iof/station/:stationId/completion`
  - `GET /iof/corridor/:corridorId/completion`
  - `GET /iof/replay/chain/:corridorId`

### Known Issues

- `userRole` is hardcoded to `admin`.
- No login, crew account, or real permission context.
- GPS is captured manually from browser, not continuously tracked.
- Photo capture is client-side only; durable photo storage contract is unclear.
- Baseline Graph locator lookup is not connected to Field.
- Production quantity, depth, offset, placement, and inspection data are not fully modeled.
- Close taxonomy is loaded from ScopeVersion but Field also has local role assumptions.

### Missing Features

- Crew accounts.
- Locator accounts.
- Offline mode.
- Durable photo/evidence storage.
- Production entry by station chain.
- Baseline Graph nearest station lookup.
- QA/inspection workflow.
- Conflict resolution and resubmission workflow.

## 9. Twin

### Status

Partial.

Twin can load ScopeVersion truth and close history, derive replay state, show station status, compute financial replay, and call a Twin Operator LLM service.

### Capabilities

- ScopeVersion selection.
- Scope and closes load.
- Route/station map view.
- Close history display.
- Station status derivation.
- Local anomaly and recommendation inference.
- Financial replay using `computeFinancialState`.
- Twin Operator chat through `/api/twin`.
- Operator/human console modes.
- Selected station close history inspection.

### Components

- `src/TwinMode.tsx`
- `src/core/iof/replayEngine.ts`
- `src/core/iof/financialReplayEngine.ts`
- `src/core/iof/closeHelpers.ts`
- `server/index.js`
  - `POST /api/twin`
- API calls:
  - `GET /scope/:scopeVersion`
  - `GET /closes`
  - `POST /api/twin`

### Known Issues

- Duration tracking is inferred, not an authoritative duration ledger.
- Twin AI service uses a local/remote LLM proxy with hardcoded backend URL.
- Operator tool call only has a simple `getScopeVersion` tool.
- Close counts/statuses can drift because close taxonomy and status derivation are split across modules.
- No production telemetry pipeline.
- No durable twin snapshots.

### Missing Features

- Duration tracking by work state.
- Production telemetry ingestion.
- Replay timeline visualization.
- State diffing and drift detection.
- Twin snapshot/version persistence.
- Crew/productivity analytics.
- Hyperscaler/carrier reporting views.

## 10. Backend Services

### Status

Partial and split across remote services.

The repository includes a local Express server in `server/index.js`, but the UI primarily calls remote Chicago and IOF services.

### APIs Discovered

#### Chicago API Client

Base: `http://64.34.93.5:3001`

- `GET /api/baselines`
- `POST /api/baselines`
- `GET /api/baselines/:id`
- `POST /api/uploads`
- `POST /api/uploads/:uploadId/ingest`
- `GET /api/uploads/:uploadId/status`
- `GET /api/ingestion-jobs/:jobId`
- `POST /api/ingestion-jobs/:jobId/cancel`
- `POST /api/twin`
- `POST /api/chat`
- `POST /api/prism` in server, though current Prism UI often calls `/api/twin`.

#### IOF API Client

Base: `http://64.34.93.5:4000`

- `POST /scope/assemble`
- `GET /scope/:scopeVersion`
- `GET /scopeversion/:scopeVersionId` in server-side tool call
- `GET /iof/scopeVersions`
- `GET /closes`
- `POST /close`
- `POST /iof/validate`
- `GET /iof/replay/exec/:closeId`
- `GET /iof/station/:stationId/completion`
- `GET /iof/corridor/:corridorId/completion`
- `GET /iof/replay/chain/:corridorId`
- `POST /graph/edge`

### Services and Files

- `src/config/api.ts`
- `src/api/baselines.ts`
- `src/api/ingestion.ts`
- `server/index.js`
- `server/index.backup.js`
- `src/llm/llmGateway.ts`
- `src/llm/prism.ts`

### Known Issues

- API base URLs are hardcoded in multiple files.
- Frontend and server disagree on some endpoints (`/api/prism` versus `/api/twin` for Prism AI behavior).
- The local Express server is mostly an LLM proxy and not a full backend.
- There is no local implementation of Chicago baseline/upload APIs in this repo.
- Graph storage contract is incomplete for large immutable infrastructure.
- Error handling is ad hoc and mostly UI status strings plus console logs.
- No API client test suite.

### Missing Features

- Unified API client layer.
- Environment-based endpoint management throughout all modes.
- Typed backend contracts.
- Graph storage/chunking/tile service.
- Authenticated request handling.
- Server-side spatial operations.
- Durable file/evidence storage.
- Audit/event ledger API documentation.

## 11. Authentication and Accounts

### Current State

Broken or not implemented.

There is no real user login, session, tenant, account, or role system in the current UI.

Existing placeholders:

- `accountId` in Design defaults to `fiberlight-beta`.
- Field has `userRole = "admin"`.
- `ROLE_PERMISSIONS` maps roles to close types in `src/config/roles.ts`.
- Baselines include `accountId`, but enforcement is backend-dependent.

### Missing Features

- User authentication.
- Workspace/account tenant isolation.
- Role assignment.
- Crew accounts.
- Locator accounts.
- Admin accounts.
- Vendor accounts.
- ScopeVersion ownership.
- Permission-gated UI and API calls.
- Audit trail by actor.

### Recommended Direction

- Define account, tenant, and role model before expanding Field/Marketplace/Control.
- Move role and permission checks server-side.
- Keep client role checks for UX only.
- Make every close, ScopeVersion, baseline, graph, and opportunity actor-scoped.
- Separate internal FiberLight users, vendor users, field crews, locators, and admins.

## 12. ScopeVersion Architecture

### Current Behavior

ScopeVersion is created primarily by Design approval:

1. Proposed route is loaded.
2. Stationing is generated.
3. Economics and financial context are computed.
4. `createApprovedScopePackage` builds canonical truth.
5. Design posts to `POST /scope/assemble`.
6. Downstream modes load the ScopeVersion by ID.

Baseline Graph explicitly does not create ScopeVersion routes.

### Creation Paths

- Design route approval: active and working path.
- Existing network registration: stores baseline inventory, not a ScopeVersion design.
- Prism opportunity batch: sends selected sites to Design, but still requires Design to create actual extension geometry and budget.
- Marketplace and Control create closes against existing ScopeVersions, not new ScopeVersions.

### Dependencies

- `src/DMredlinedev.tsx`
- `src/core/iof/governance.ts`
- `src/core/iof/types.ts`
- `src/core/iof/replayEngine.ts`
- IOF API `/scope/assemble`
- IOF API `/scope/:scopeVersion`
- close history APIs

### Known Gaps

- ScopeVersion extension from Baseline Graph is not implemented.
- Opportunity-to-ScopeVersion lifecycle is not durable.
- ScopeVersion ownership and permissions are absent.
- Canonical truth depends on Design-generated stationing and default objects.
- Baseline Graph station chains are not yet ScopeVersion stations.
- No migration/versioning model for canonical truth schema changes.

### Future Requirements

- Explicit parent baseline graph reference.
- Extension geometry separate from baseline inventory.
- ScopeVersion child/parent relationships.
- Durable opportunity approval lifecycle.
- Versioned canonical truth schema.
- Actor and permission metadata.
- Immutable baseline graph reference by baseline ID and graph version.

## 13. Technical Debt

### TECHNICAL_DEBT

#### TD-001: Monolithic Design File

Description: `src/DMredlinedev.tsx` owns Design, Translate, Baseline Graph, rendering, ingestion, economics, and UI controls.

Impact: High change risk and difficult testing.

Severity: High.

Recommended Fix: Split into focused modules after Baseline Graph stabilizes.

Priority: High.

#### TD-002: Hardcoded API Endpoints

Description: API bases are hardcoded in `src/config/api.ts`, `FieldMode`, `TwinMode`, `MarketplaceMode`, `ControlPlane`, and `server/index.js`.

Impact: Deployment and environment drift risk.

Severity: High.

Recommended Fix: Centralize API config and use environment variables.

Priority: High.

#### TD-003: Baseline Graph Storage Contract Incomplete

Description: UI now avoids large graph payloads, but backend graph persistence/retrieval is not fully represented in the repo.

Impact: Graph reload and Prism graph serviceability can fail after page refresh.

Severity: Critical.

Recommended Fix: Implement chunked immutable graph storage and retrieval contract.

Priority: Critical.

#### TD-004: No Auth or Server-Side Permissions

Description: Role checks are local placeholders; Field uses hardcoded admin.

Impact: Unsafe for real field/vendor/account use.

Severity: Critical.

Recommended Fix: Add authentication, account isolation, server-side authorization.

Priority: Critical.

#### TD-005: Prism AI Endpoint Confusion

Description: Server exposes `/api/prism`, but current Prism UI also calls `/api/twin`.

Impact: Confusing operator behavior and hard-to-debug AI responses.

Severity: Medium.

Recommended Fix: Separate Prism and Twin API contracts.

Priority: Medium.

#### TD-006: Lightweight Graph State Helper Has Unreachable Code

Description: `src/core/graph/state.ts` contains logic after a return statement.

Impact: Confusing state behavior and maintenance risk.

Severity: Medium.

Recommended Fix: Clean up after freeze-sensitive work is complete.

Priority: Medium.

#### TD-007: Sparse Automated Tests

Description: Core workflows have little automated coverage.

Impact: High regression risk across Design, ScopeVersion, Field, Twin, and Graph.

Severity: High.

Recommended Fix: Add focused unit/integration tests for IOF package, stationing, graph ingest, serviceability, and close replay.

Priority: High.

#### TD-008: Duplicate Normalization Logic

Description: Scope/station/close normalization exists across Field, Twin, Control, Prism, API clients, and graph utilities.

Impact: Drift in status and ID behavior.

Severity: Medium.

Recommended Fix: Consolidate shared normalizers.

Priority: Medium.

#### TD-009: Console-Heavy Diagnostics

Description: Many systems rely on console logs for operational tracing.

Impact: Hard to support production ingest and field workflows.

Severity: Medium.

Recommended Fix: Add structured diagnostics and UI-visible audit events.

Priority: Medium.

#### TD-010: Public OSRM Dependency

Description: Design and Prism route snapping use public OSRM endpoints.

Impact: Reliability and rate-limit risk.

Severity: Medium.

Recommended Fix: Move routing to controlled service or disable for authoritative workflows.

Priority: Medium.

#### TD-011: Field Evidence Storage Undefined

Description: GPS/photo data is captured client-side and submitted in close payloads without a clear durable media storage path.

Impact: Field close auditability is incomplete.

Severity: High.

Recommended Fix: Add evidence object storage and evidence metadata schema.

Priority: High.

#### TD-012: Financial Replay Uses Placeholder Assumptions

Description: Twin financial replay can derive economics from defaults if no design/marketplace assumptions are passed.

Impact: Reports may look authoritative while being estimated.

Severity: Medium.

Recommended Fix: Label estimated financials clearly and require source attribution.

Priority: Medium.

## 14. Active Development Priorities

1. Baseline Graph Completion

Rationale: This unlocks FiberLight carrier inventory as immutable source truth and prevents continued misuse of existing networks as design routes.

2. Prism Serviceability

Rationale: Prism becomes the value engine once it can reliably compute candidate site distance to graph edge/node/station and rank opportunities.

3. ScopeVersion Extension from Opportunities

Rationale: Opportunity batches must become proposed extension ScopeVersions without mutating baseline inventory.

4. Field Production Reporting

Rationale: Field closes against stations are where construction truth is captured. This creates operational and audit value.

5. Twin Duration Tracking

Rationale: Twin becomes valuable when it can replay duration, bottlenecks, and production velocity from authoritative close events.

6. User Accounts and Permissions

Rationale: Field, Marketplace, Control, vendor workflows, and customer reporting need actors, accounts, and authorization.

7. Marketplace Enhancements

Rationale: Marketplace is useful after Design budgets and Field work packages are stable.

8. Control Enhancements

Rationale: Control should coordinate execution after Field and permissions mature.

## 15. Recommended Freeze List

### Design

Freeze unless bug fixes are required.

Justification: Design owns the current working route-to-ScopeVersion path.

### IOF Package Generation

Freeze unless schema bugs are discovered.

Justification: Field, Control, Marketplace, and Twin depend on canonical truth shape.

### Economics Engine

Freeze except calibration/data fixes.

Justification: Current economics support downstream budgets and Marketplace assumptions. Refactors should wait until tests exist.

### Design Route Stationing Engine

Freeze except stationing bugs.

Justification: Proposed-route stationing is already part of approved ScopeVersion generation.

### Field Close Submission Contract

Freeze endpoint shape unless coordinated with IOF backend.

Justification: Control and Twin replay depend on close history.

## 16. Dependency Map

### Requested Conceptual Flow

```text
Translate
  -> Design
  -> IOF Package

Baseline Graph
  -> Prism
  -> Opportunity

Opportunity
  -> Design
  -> ScopeVersion

ScopeVersion
  -> Field

Field
  -> Twin

Control
  -> Field

Marketplace
  -> Design
```

### Actual Dependencies Discovered

```text
App.tsx
  -> DMredlinedev
  -> PrismMode
  -> MarketplaceMode
  -> ControlPlane
  -> FieldMode
  -> TwinMode

DMredlinedev
  -> core/iof/createApprovedScopePackage
  -> api/baselines
  -> api/ingestion
  -> CHICAGO_API
  -> IOF_API /scope/assemble

Translate Panel
  -> DMredlinedev local parsers
  -> api/ingestion
  -> optional Design route/sites state

Baseline Graph
  -> types/fiberlightBeta
  -> DMredlinedev MapLibre rendering
  -> api/baselines summary persistence
  -> PrismMode load/serviceability if graph edges returned

PrismMode
  -> api/baselines
  -> api/ingestion
  -> types/fiberlightBeta buildServiceabilityResults
  -> App opportunityBatch handoff
  -> IOF /graph/edge for proposal persistence
  -> Chicago /api/twin for AI chat

Design Approval
  -> core/iof/governance createApprovedScopePackage
  -> IOF /scope/assemble
  -> ScopeSelector /iof/scopeVersions

FieldMode
  -> ScopeSelector
  -> IOF /scope/:id
  -> IOF /closes
  -> IOF /close
  -> IOF validation/replay/completion endpoints
  -> core/iof replay helpers

ControlPlane
  -> ScopeSelector
  -> IOF /scope/:id
  -> IOF /closes
  -> IOF /close
  -> core/iof replay helpers
  -> core/graph deriveState

MarketplaceMode
  -> ScopeSelector
  -> IOF /scope/:id
  -> IOF /close pricing.submitted

TwinMode
  -> ScopeSelector
  -> IOF /scope/:id
  -> IOF /closes
  -> core/iof replay and financial replay
  -> Chicago /api/twin

server/index.js
  -> /api/prism
  -> /api/twin
  -> /api/chat
  -> remote LLM endpoint
  -> IOF scopeversion tool fetch
```

## Leadership Questions

### What is working?

Design route approval, proposed-route stationing, Design economics, IOF package generation, basic Field close submission, basic Control state review, basic Twin replay, Marketplace pricing close submission, and Chicago upload client flows.

### What is partially working?

Translate, Baseline Graph, Prism graph serviceability, Field production reporting, Twin telemetry, Marketplace, Control governance, backend graph storage.

### What is broken?

Authentication, account permissions, durable graph retrieval after summary-only graph save, complete Field locator workflows, durable opportunity lifecycle, and full graph-to-ScopeVersion extension creation.

### What should we stop touching?

Design approval, IOF package shape, Design economics, and proposed-route stationing should be frozen except for bug fixes.

### What should we build next?

Finish Baseline Graph, then Prism serviceability, then ScopeVersion extension generation, then Field locator/production reporting, then Twin duration telemetry.

### What creates the most value for FiberLight?

Immutable carrier inventory, opportunity discovery, accurate serviceability, and field execution closure against stations.

### What creates the most value for hyperscalers?

Reliable distance-to-network analysis, low-latency/path diversity evidence, capacity and power-readiness scoring, and transparent ScopeVersion execution state.

### What creates the most value for carriers?

Baseline graph inventory, reusable ScopeVersion extensions, controlled marketplace pricing, field close evidence, and Twin replay for operational reporting.
