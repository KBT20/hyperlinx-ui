# Hyperlinx DAL Architecture Inventory

Date: 2026-06-16

Scope: DAL development environment only. This inventory audits `hyperlinx-dal-dev/src`, `hyperlinx-dal-dev/server`, `package.json`, `README.md`, and current DAL Markdown doctrine. It does not change Chicago production, root production UI, or existing DAL runtime behavior.

## Executive Summary

DAL has evolved into a separate React/Vite application with its own environment configuration, DAL navigation shell, server-first repositories, IndexedDB fallback, inventory recovery, ScopeVersion doctrine, Map Kernel rendering, Prism site decision, preliminary quote generation, IOF Package persistence, Close Event persistence, Operational Intelligence, and external reasoning fabric discovery.

The strongest architectural move is now clear:

```text
ScopeVersion = Truth
IOF Package = Work
Close Event = Authorized Transformation
Child ScopeVersion = New Truth
Map Kernel = Visual truth lens
Reasoning = Advisory fabric
```

The largest current risk is drift. DAL now has constitutional systems, but older graph-first, GIS-first, and workspace-specific flows still exist beside them. Several UI workflows still operate from `InventoryGraph`, `OpportunitySeed`, `ControlWorkItem`, `FieldClosure`, or local fallback records instead of consistently beginning with a ScopeVersion and moving through IOF Packages.

Server authority is also uneven. The DAL server in this repo currently persists ScopeVersions, IOF Packages, and Close Events. Inventory graph authority is handled through the configured baseline graph API. Candidate sites, graph extensions, opportunity seeds, quotes, work items, field closures, and twin state still rely on remote endpoints when available and IndexedDB fallback when they are not implemented by the configured server.

## 1. Constitutional Truth Layer

### Current Assets

- `src/types/dal.ts`
  - `ScopeVersion`
  - `ScopeVersionTruthType`
  - `ScopeVersionRelationshipType`
  - `ScopeVersionCanonicalTruth`
  - certification, network, geography, engineering, financial, risk, decision, IOF Package, and Close Event types.
- `src/scopeversion/scopeVersionUtils.ts`
  - creates inventory, opportunity, graph extension, site decision, and field closure ScopeVersions.
- `src/scopeversion/scopeVersionCertification.ts`
  - certifies graph-backed ScopeVersions and marks certified records immutable.
- `src/scopeversion/scopeVersionValidation.ts`
  - validates lifecycle transitions and required site decision truth.
- `src/api/scopeVersionRepository.ts`
  - server-first ScopeVersion repository with IndexedDB fallback.
- `server/index.js`
  - file-backed `/api/scopeversions` repository.
- `SCOPEVERSION_CONSTITUTIONAL_DOCTRINE.md`
  - declares ScopeVersion as infrastructure truth.

### Status

Partial to strong.

ScopeVersion doctrine is now explicit and represented in types, repositories, server routes, Map Kernel rendering, Operational Intelligence, and site decision creation. Inventory graphs can become inventory ScopeVersions. Site Decisions can become candidate ScopeVersions. Graph extensions and field closures can create child ScopeVersions.

### Gaps

- ScopeVersion creation paths are spread across `scopeVersionUtils`, `scopeVersionRepository`, `closeevents`, and `server/index.js`.
- Certified immutability is enforced through repository APIs, but not by a database-level append-only ledger.
- `createScopeVersionFromOpportunitySeed` can still create a candidate ScopeVersion without the richer certified Site Decision truth required by `createScopeVersionFromSiteDecision`.
- The Design Synthesis origin is represented doctrinally but remains a placeholder in the DAL shell.
- As-built certification is modeled but not yet an end-to-end workflow.

## 2. Inventory Layer

### Current Assets

- `src/workspaces/TranslateWorkspace.tsx`
  - DAL-only CSV, KML, KMZ, GeoJSON parsing into inventory graph shape.
- `src/workspaces/DALInventoryWorkspace.tsx`
  - inventory list, load, handoff to graph viewer and Prism.
- `src/workspaces/InventoryRecoveryWorkspace.tsx`
  - browser/server discovery, push, pull, synchronize, validate, connectivity checks, import jobs, package import/export, and Map Kernel validation.
- `src/api/dalClient.ts`
  - inventory graph list/load/save adapter.
- `src/api/inventoryRecovery.ts`
  - baseline graph server discovery, chunk upload, chunk pull, synchronization matrix, validation checks.
- `src/api/inventoryImportJobs.ts`
  - `.hyperlinx` package import/export and chunked upload job tracking.
- `src/api/dalStorage.ts`
  - IndexedDB storage with legacy localStorage migration and graph size telemetry.
- `src/validation/inventoryValidation.ts`
  - duplicate, orphan, reference, and geometry validation.

### Status

Partial to strong.

Inventory import, IndexedDB cache/fallback, server synchronization, graph telemetry, `.hyperlinx` packaging, and inventory ScopeVersion generation are implemented. The configured DAL baseline graph API is intended to be the authoritative inventory persistence service.

### Gaps

- `server/index.js` in this repo does not implement `/api/baseline-graphs`, `/api/inventory-graphs`, or inventory chunk routes. Those are expected from the configured DAL1/baseline graph API.
- `DALInventoryWorkspace` still presents graph-first inventory handoff instead of ScopeVersion-first inventory rendering.
- `InventoryRecoveryWorkspace` is the most complete truth path, but it is not yet the single inventory entry point.
- Large graph authority depends on correct remote DAL baseline graph service configuration.
- Candidate, opportunity, and commercial records can still proceed locally without server authority if their endpoints are absent.

## 3. Spatial / Map Layer

### Current Assets

- `src/mapkernel/MapKernel.tsx`
- `src/mapkernel/ScopeVersionRenderer.ts`
- `src/mapkernel/IOFPackageRenderer.ts`
- `src/mapkernel/MapLayerManager.ts`
- `src/mapkernel/MapSelectionManager.ts`
- `src/mapkernel/MapViewportManager.ts`
- `src/mapkernel/MapKernelDiagnostics.ts`
- Legacy/parallel rendering:
  - `src/components/GraphMap.tsx`
  - `src/gis/LeafletMap.tsx`
  - `src/gis/*Layer.tsx`

### Status

Partial.

Map Kernel exists and renders ScopeVersion and IOF Package primitives with shared layers, selection refs, viewport bounds, diagnostics, station labels, and package overlays. `InventoryRecoveryWorkspace` and `PrismSiteDecisionWorkspace` use `ScopeVersionRenderer -> MapKernel`. Operational Intelligence consumes Map Kernel metrics.

### Drift

- `GraphViewerWorkspace`, `GraphExtensionWorkspace`, and `NetworkAffinityWorkspace` still use `GraphMap`.
- `TwinWorkspace` still uses `LeafletMap` and GIS layers.
- `GraphMap` renders InventoryGraph geometry directly and has its own bounds, sampling, layer toggles, selection refs, and rendering logic.
- `LeafletMap` renders route/build path/candidate/attachment/crossing layers separately from ScopeVersionRenderer.

### Required Stabilization

Map Kernel should become the only authoritative rendering path. GraphMap and GIS layers can remain temporary diagnostics, but they should not be allowed to define truth, stationing, selection, or attachment geometry.

## 4. Graph Extension / Serviceability Layer

### Current Assets

- `src/workspaces/GraphExtensionWorkspace.tsx`
- `src/graph/graphDiff.ts`
- `src/engineering/certificationEngine.ts`
- `src/engineering/constructionModel.ts`
- `src/affinity/nearestRouteEngine.ts`
- `src/affinity/nearestNodeEngine.ts`
- `src/affinity/nearestStationEngine.ts`
- `src/affinity/buildPathEngine.ts`
- `src/affinity/attachmentStrategyEngine.ts`
- `src/affinity/networkAffinityEngine.ts`

### Status

Partial.

The codebase includes attachment certification, lateral certification, serviceability assessment, buried construction defaults, graph extension certification, graph diffs, and nearest route/node/station engines. `certifyGraphExtension` snaps extension start geometry to certified inventory attachment and blocks failed extensions from ScopeVersion creation.

### Gaps

- `GraphExtensionWorkspace` still renders through GraphMap rather than Map Kernel.
- Graph extension certification is deterministic and geometry-based, but not yet a full topological graph transaction.
- There is no dedicated nearest edge engine exposed as a canonical shared service, even though attachment certification projects to edge segments internally.
- Route continuity and graph connectivity are stored as certification metadata but are not yet backed by a complete topology validator.
- ScopeVersion child creation from graph extensions exists, but package execution and closure are not yet wired into that workspace.

## 4A. Attachment-Aware Routing / Constraint Layer

### Current Assets

- `src/routing/AttachmentAwareRouteEngine.ts`
  - generates attachment-originated route alternatives:
    - `ATTACHMENT_DIRECT`
    - `CONSTRAINT_AWARE_DOGLEG`
    - `REFERENCE_LAYER_ASSISTED`
    - `ENGINEER_EDITED`
  - explicitly identifies that these are not full OSM or road-network shortest paths.
- `src/routing/ConstraintAnalysisEngine.ts`
  - evaluates proposed geometry against geographic reference layers:
    - streets
    - buildings
    - parcels
    - railroads
    - water
    - terrain
  - produces constraint summary, unresolved constraints, constructability score, recommended actions, and certification readiness.
- `src/components/RouteEngineeringPanel.tsx`
  - displays routing mode, route alternatives, constraint counts, recommended actions, constructability score, and certification readiness.
- `src/serviceability/routeCertification.ts`
  - stores routing mode, constraint summary, unresolved constraints, and certification readiness in route certification snapshots.

### Doctrine

Attachment Authority determines route origin.

Constraint Analysis determines constructability.

Reference Layers influence routing decisions but do not establish network truth.

A route may not be certified unless constraint evidence is visible to the engineer.

### Status

Partial but formalized.

DAL now has a reusable, inspectable routing evidence package. Network Affinity and Prism Site Decision can promote attachment-aware alternatives, rerun constraint analysis after engineer edits, block `BLOCKED` route certification, and persist constraint evidence into child ScopeVersions.

### Gaps

- No true road/ROW graph is available yet.
- Route alternatives are deterministic direct/dogleg/reference-assisted geometries, not shortest-path routing.
- Building, parcel, railroad, water, and terrain layers depend on future imported reference datasets.
- Constraint analysis is geometric and advisory until real jurisdictional/parcel/ROW data is loaded.

## 4B. Constraint Authority Audit

Date: 2026-06-17

Problem found: Decision Evidence, Route Engineering, quote, and preview panels could display constraint counts from different sources. Example drift: Decision Evidence displayed 2 water crossings while Route Engineering displayed 0.

Authoritative sequence:

```text
Route Geometry
  -> ConstraintAnalysisEngine
  -> ConstraintEvidencePackage
  -> Decision Evidence
  -> Route Engineering
  -> Quote
  -> Route Certification
  -> Child ScopeVersion
```

Only `ConstraintAnalysisEngine` may compute route constraint evidence. Other modules may display, pass, persist, or request recalculation from the engine.

| File | Function / Component | Field(s) | Role | Should remain |
| --- | --- | --- | --- | --- |
| `src/routing/ConstraintAnalysisEngine.ts` | `analyzeRouteConstraints` | `summary`, `constraints`, `constructabilityScore`, `certificationReadiness`, `unresolvedConstraints`, `routeGeometryHash` | Computes and owns `ConstraintEvidencePackage` | Yes, sole authority |
| `src/routing/AttachmentAwareRouteEngine.ts` | `makeRoute`, `costImpact` | constraint counts, constructability, unresolved constraints | Calls engine and ranks alternatives from package results | Yes, no independent crossing computation |
| `src/serviceability/routeCertification.ts` | `createRouteCertificationSnapshot` | `constraintEvidenceId`, `constraintEvidencePackage`, `certifiedGeometryHash` | Persists exact package and blocks stale child gate | Yes |
| `src/serviceability/serviceabilityEngine.ts` | `updateServiceabilityLateralGeometry`, `analyzeSiteAgainstInventory` | `constraintAnalysis` | Recalculates by calling engine after route edits/proposals | Yes |
| `src/serviceability/serviceabilityEngine.ts` | `createCandidateScopeVersionFromServiceability` | `constraintEvidencePackage`, `constraintSummary`, `constructabilityScore` | Persists exact package into child ScopeVersion; legacy fields mirror package | Yes |
| `src/components/RouteEngineeringPanel.tsx` | `RouteEngineeringPanel` | water/road/rail counts, readiness, hash | Displays package and blocks stale or missing evidence certification | Yes |
| `src/workspaces/PrismSiteDecisionWorkspace.tsx` | Decision Evidence / Construction / Quote Worksheet / ScopeVersion Preview | crossing counts, constructability, hash | Displays package diagnostics; legacy crossing counters are overridden by package when present | Yes |
| `src/workspaces/PrismSiteDecisionWorkspace.tsx` | `applyCertifiedRouteToScopeVersion` | `constraintEvidencePackage`, `certifiedGeometryHash` | Persists exact package into certified child ScopeVersion | Yes |
| `src/workspaces/NetworkAffinityWorkspace.tsx` | route certification flow | `constraintAnalysis`, `constraintEvidenceStatus` | Calls engine and blocks stale route certification | Yes |
| `src/commercial/quoteEngine.ts` | `scopeCommercialBasis`, `generatePreliminaryQuote` | crossings, `constraintEvidenceId`, `routeGeometryHash` | Reads ScopeVersion package first; quote worksheet references same evidence | Yes |
| `src/spatial/*Engine.ts` | parcel/road/rail/water/constructability engines | parcel, road, rail, water, constructability, risk scores | Advisory spatial intelligence for opportunity analysis | Yes, advisory only unless folded into engine reference layers |
| `src/affinity/*Engine.ts` | build path / affinity strategy | estimated crossings, risk, constructability | Advisory opportunity and affinity estimates | Yes, but not executable constraint truth |
| `src/types/portfolio.ts` | `OpportunitySeed` fields | risk, crossing, constructability scores | Advisory portfolio ranking data | Yes, not certified route evidence |

Drift rule:

```text
If panel routeGeometryHash values match, water/road/rail crossing counts must match.
If routeGeometryHash values differ, the UI must display ROUTE GEOMETRY DRIFT / CONSTRAINT DRIFT DETECTED.
If a route changed after evidence generation, certification must display STALE CONSTRAINT EVIDENCE and block child ScopeVersion creation.
```

## 4C. Constraint Truth / Reference Layer Authority Audit

Date: 2026-06-17

Primary question: are constraint counts derived from authoritative reference geometry or fallback/synthetic logic?

Current answer: executable route constraint truth now comes only from `ConstraintAnalysisEngine`. Legacy opportunity, seed, and ScopeVersion helper fields still exist as advisory estimates or compatibility mirrors. They must not be used as certified route constraint truth.

### Provenance Rule

`ConstraintEvidencePackage` now carries:

- `provenance.referenceLayersLoaded`
- `provenance.featureCounts`
- `provenance.dataSources`
- `provenance.fallbackMode`
- `provenance.fallbackReasons`
- `waterCrossingAudit`
- `unknownCounts`

If water reference geometry is unavailable, empty, or the engine is in fallback mode, water crossings display as `UNKNOWN`, not `0`.

### Hardcoded / Fallback Value Audit

| Location | Field(s) | Purpose | Value Type | Still Needed? | Removal Plan |
| --- | --- | --- | --- | --- | --- |
| `src/routing/ConstraintAnalysisEngine.ts` | `EMPTY_SUMMARY` | Internal accumulator seed before provenance is applied | Default zeros | Yes, internal only | Keep internal; UI must use `unknownCounts` to avoid displaying false zero |
| `src/routing/ConstraintAnalysisEngine.ts` | `summary.waterCrossings` | Certified route water crossing count | Geometry-derived count or 0 when unknown | Yes | Treat as executable only when `unknownCounts.waterCrossings=false` |
| `src/serviceability/routeCertification.ts` | `routeMetricsForGeometry` crossing defaults | Cost metric fallback for draft route metrics | Fallback zero | Temporary | Do not certify without `ConstraintEvidencePackage`; retire metric hints once all quotes read package |
| `src/serviceability/routeCertification.ts` | `metricsFromConstraintAnalysis` | Mirrors engine package into route certification metrics | Package-derived | Yes | Keep as compatibility mirror |
| `src/commercial/quoteEngine.ts` | `engineeringBasis.road/rail/waterCrossings` fallback | Backward compatibility for older ScopeVersions | Legacy fallback | Temporary | Prefer `engineeringBasis.constraintEvidencePackage`; remove legacy fallback after migration |
| `src/scopeversion/scopeVersionUtils.ts` | `roadCrossings`, `railCrossings`, `waterCrossings` from build path / constructability | Advisory Site Decision / seed ScopeVersion creation | Advisory/synthetic estimates | Temporary | Site Decision path should pass certified `ConstraintEvidencePackage`; seed-only creation remains non-executable |
| `src/workspaces/PrismSiteDecisionWorkspace.tsx` | `evidenceFor` road/rail/water counts | Displays legacy seed evidence before route package exists | Advisory fallback | Temporary | UI overrides with `ConstraintEvidencePackage` when available; remove after all seeds carry package |
| `src/workspaces/NetworkAffinityWorkspace.tsx` | `metricHints.roadCrossings = roadSegmentCount` | Draft route metric hint before package | Fallback estimate | Temporary | Route certification blocked unless engine package is current |
| `src/workspaces/TwinWorkspace.tsx` | Proposed crossings from engineering basis fields | Runtime summary of older ScopeVersions | Legacy fallback | Temporary | Twin should display package provenance when ScopeVersions are migrated |
| `src/types/dal.ts` | `roadCrossings`, `railCrossings`, `waterCrossings` | Compatibility schema fields | Persisted legacy fields | Yes, for migration | Treat as mirrors of package or advisory only |

### Pampa Validation Rule

For Pampa Water Treatment Plant:

```text
Water layer loaded?        provenance.referenceLayersLoaded.water
Water feature count?       provenance.featureCounts.waterFeatures
Water intersections?       waterCrossingAudit.waterIntersectionsFound
Intersection coordinates?  waterCrossingAudit.intersectionCoordinates
Map markers?               renderConstraintAnalysis water-intersection markers
Certified count?           summary.waterCrossings only if unknownCounts.waterCrossings=false
```

Expected valid outcomes:

```text
Water Crossings = 2
```

with loaded water geometry and two rendered intersection markers, or:

```text
Water Crossings = UNKNOWN
```

with provenance explaining missing/empty/fallback reference geometry.

Invalid outcome:

```text
Water Crossings = 0
```

when water geometry was not loaded, has zero features, or the engine fell back.

## 4D. Constraint Geometry Registry

Date: 2026-06-17

DAL now has a `ConstraintGeometryRegistry` for geographic reference authority.

Purpose:

- Register streets, water, railroads, buildings, parcels, terrain, ROW, utility corridors, and easements.
- Distinguish loaded reference geometry from missing reference geometry.
- Preserve authority, certification use, feature count, coverage, and load status.
- Produce constraint completeness evidence for route certification.

Default route certification required layers:

- Streets
- Water
- Railroads
- Parcels
- Buildings

Terrain remains advisory unless a future policy explicitly requires it.

Evidence rule:

```text
Constraint Geometry Registry
  -> ConstraintAnalysisEngine
  -> ConstraintEvidencePackage.constraintRegistrySnapshot
  -> Route Certification
  -> Child ScopeVersion
```

If a required layer is missing, the affected constraint class remains `UNKNOWN`, the completeness score is below 100%, and certification is marked `INCOMPLETE_CONSTRAINT_EVIDENCE` unless complete certifiable layers are loaded.

Engineer override is allowed only with notes. The child ScopeVersion preserves the incomplete-evidence snapshot so downstream Marketplace, Control, Twin, and reasoning can see that constraint evidence was not complete.

Immediate import support:

- GeoJSON: functional for streets, water, railroads, buildings, and parcels.
- KML/KMZ: placeholder.
- Shapefile: placeholder.

Current limitation:

The registry is an in-memory DAL session registry. Server-backed reference-layer persistence is a future hardening step.

## 4D. Certification Authority Consolidation Audit

Date: 2026-06-17

Problem found: Site Decision, Network Affinity, Route Engineering, Quote, ScopeVersion Preview, and child ScopeVersion creation could interpret route certification readiness separately. This allowed UI copy and guardrails to drift, especially when constraint evidence was current but incomplete.

Authoritative rule:

```text
Route Geometry
  -> ConstraintEvidencePackage
  -> CertificationAuthority
  -> Shared CertificationAuthorityStrip
  -> Quote / ScopeVersion Preview / Child ScopeVersion Gate
```

Only `CertificationAuthority` may decide whether a route is `CERTIFIED_ROUTE`, `PROVISIONALLY_CERTIFIED`, `ENGINEER_REVIEW_REQUIRED`, `REJECTED_ROUTE`, or `BLOCKED`.

`CERTIFIED_ROUTE` requires current evidence, matching route hash, 100% completeness, no missing required layers, readiness `READY`, no blocking constraints, and engineer approval. Current incomplete evidence may become `PROVISIONALLY_CERTIFIED` with engineer notes, but it remains visibly provisional and package progression is blocked.

| Surface | Previous drift risk | Consolidated authority |
| --- | --- | --- |
| `src/components/RouteEngineeringPanel.tsx` | Local readiness and constraint labels could imply certification. | Displays `CertificationAuthorityStrip`; snapshot creation is downgraded by central authority when evidence is incomplete. |
| `src/components/ConstraintEvidenceStrip.tsx` | Evidence grade was derived locally from registry flags. | Evidence grade is derived by `CertificationAuthority`. |
| `src/workspaces/PrismSiteDecisionWorkspace.tsx` | Create ScopeVersion and quote controls could disagree with route panel state. | Uses `routeAuthority` for executive review, quote worksheet, preview, and child ScopeVersion buttons. |
| `src/workspaces/NetworkAffinityWorkspace.tsx` | Batch route certification had separate incomplete-evidence checks. | Uses `activeRouteAuthority` for serviceability diagnostics and certification gate. |
| `src/serviceability/routeCertification.ts` | A caller-supplied `CERTIFIED_ROUTE` status could bypass evidence grading. | `createRouteCertificationSnapshot` derives final state from `CertificationAuthority`. |
| `src/serviceability/serviceabilityEngine.ts` | Child ScopeVersion creation only checked route snapshot status. | Child creation checks `CertificationAuthority.canCreateChildScopeVersion` and persists the authority decision. |
| `src/commercial/quoteEngine.ts` | Quotes could consume incomplete evidence without an explicit commercial label. | Quotes carry `quoteStatus`, `evidenceGrade`, completeness, missing layers, and authority decision. |

Validation standard:

```text
No UI may display CERTIFIED_ROUTE unless CertificationAuthority.state is CERTIFIED_ROUTE.
Incomplete current evidence must display ENGINEER_REVIEW_REQUIRED or PROVISIONALLY_CERTIFIED.
Quotes with incomplete evidence must display PRELIMINARY_QUOTE_INCOMPLETE_EVIDENCE.
Child ScopeVersion creation must preserve the authority snapshot.
```

## 5. Opportunity / Prism / Affinity Layer

### Current Assets

- `src/workspaces/PrismWorkspace.tsx`
- `src/workspaces/PrismSiteDecisionWorkspace.tsx`
- `src/workspaces/CandidateSitesWorkspace.tsx`
- `src/workspaces/NetworkAffinityWorkspace.tsx`
- `src/workspaces/PortfolioWorkspace.tsx`
- `src/prism/prismOpportunityEngine.ts`
- `src/prism/opportunityGenerator.ts`
- `src/prism/opportunityRankingEngine.ts`
- `src/prism/buildCostEstimator.ts`
- `src/prism/revenueEstimator.ts`
- `src/prism/engineeringScoringEngine.ts`
- `src/prism/financialScoringEngine.ts`
- `src/prism/strategicScoringEngine.ts`
- `src/affinity/networkAffinityEngine.ts`
- `src/geocoding/geocodeEngine.ts`

### Status

Partial to strong for advisory analysis.

Candidate import, batch geocoding, deterministic fallback, real geocoder provider abstraction, nearest route/node/station analysis, attachment strategy comparison, network affinity scoring, constructability scoring, revenue estimation, build cost estimation, opportunity seed creation, portfolio ranking, and Site Decision ScopeVersion creation are implemented.

### Gaps

- `PrismWorkspace` contains its own distance sampling helpers rather than using the newer affinity/certification services everywhere.
- Candidate and opportunity persistence falls back to IndexedDB when server endpoints are unavailable.
- `NetworkAffinityWorkspace` still renders through GraphMap.
- Real geocoding depends on environment/provider availability. Without keys or reachable external geocoders, fallback behavior remains deterministic/advisory.
- Opportunity seeds are useful for ranking, but only the certified Site Decision path should create executable ScopeVersions.

## 6. Execution Layer

### Current Assets

- `src/api/iofPackageRepository.ts`
- `src/api/closeEventRepository.ts`
- `src/closeevents/schema.ts`
- `src/closeevents/closeEventFramework.ts`
- `src/mapkernel/IOFPackageRenderer.ts`
- `server/index.js`
  - `/api/iof-packages`
  - `/api/iof-packages/:packageId`
  - `/api/iof-packages/:packageId/close`
  - `/api/iof-packages/:packageId/archive`
  - `/api/close-events`

### Status

Partial to strong foundation.

IOF Package is now modeled as persisted work. Packages can be generated from ScopeVersions, stored server-first, archived, closed, rendered as Map Kernel overlays, and used to create Close Events and child ScopeVersions.

### Gaps

- No dedicated IOF Package workspace exists yet.
- Control and Field still use `ControlWorkItem` and `FieldClosure` records rather than IOF Package execution as their primary object.
- Package generation exists but is not the only execution path.
- Close Package -> Close Event -> Child ScopeVersion exists in repositories/server, but there is no operator workflow for package review, approval, activation, or field evidence.

## 7. Commercial Layer

### Current Assets

- `src/commercial/quoteEngine.ts`
- `src/workspaces/MarketplaceWorkspace.tsx`
- `src/prism/revenueEstimator.ts`
- `src/prism/financialScoringEngine.ts`
- quote-related fields in `src/types/dal.ts`

### Status

Partial.

Preliminary quotes can be generated from ScopeVersion basis, persisted through quote endpoints or IndexedDB fallback, and applied back to ScopeVersion commercial truth. Marketplace consumes ScopeVersions rather than OpportunitySeed estimates when available.

### Gaps

- Quote persistence is not implemented by the repo-local DAL server.
- Marketplace is still a simple quote surface, not a bid/award/procurement execution system.
- Quote approval and quote-to-package handoff are not formalized.
- Pricing remains deterministic and model-based rather than externally validated.

## 8. Control / Field / Closure Layer

### Current Assets

- `src/workspaces/ControlWorkspace.tsx`
- `src/workspaces/FieldWorkspace.tsx`
- `src/api/dalClient.ts`
  - control work item calls
  - field closure calls
- `src/types/dal.ts`
  - `ControlWorkItem`
  - `FieldClosure`
  - `CloseEvent`

### Status

Prototype.

Control can generate work items from ScopeVersions and quotes, activate scopes, and update work status. Field can create closure records against active work. Close Event infrastructure exists separately and can transform IOF Package closure into child ScopeVersions.

### Gaps

- Control and Field do not yet use IOF Packages as the only execution object.
- Field closure records are not yet converted into Close Events by default.
- Field closure does not create child Field Closure or As-Built ScopeVersions in the workspace flow.
- Server endpoints for control work items and field closures are not implemented in `server/index.js`.
- Evidence storage, permissions, crew identity, station-level package work, and replay remain outside the current implementation.

## 9. Twin / Operational Intelligence Layer

### Current Assets

- `src/workspaces/TwinWorkspace.tsx`
- `src/workspaces/OperationalIntelligenceWorkspace.tsx`
- `src/api/dalClient.ts`
  - `loadTwinState`
- `src/mapkernel/MapRenderer.ts`
- `src/api/reasoningRegistry.ts`
- `src/components/ReasoningHealthDashboard.tsx`

### Status

Partial.

Operational Intelligence aggregates inventories, import jobs, ScopeVersions, IOF Packages, Close Events, quotes, work items, closures, twin state, reasoning health, inventory health, ScopeVersion lifecycle, and Map Kernel metrics. Twin shows planned/execution state from work items, closures, candidates, seeds, and selected graph context.

### Gaps

- Twin still uses `LeafletMap` and non-MapKernel GIS layers.
- Twin lineage visualization is not yet implemented.
- Twin state is derived locally when server endpoint is absent.
- Operational Intelligence reports map metrics from ScopeVersions/packages but does not yet provide an interactive lineage graph.

## 10. Reasoning Layer

### Current Assets

- `src/api/reasoningRegistry.ts`
- `src/api/reasoningClient.ts`
- `src/components/ReasoningHealthDashboard.tsx`
- `src/components/ReasoningPanel.tsx`
- `src/config/dalApi.ts`

### Status

Partial to strong infrastructure.

Reasoning is separated from DAL truth. The registry supports primary, secondary, fallback, legacy, and registry-defined endpoints. Health checks support `/health`, `/api/reasoning/health`, and OpenAI-compatible `/v1/models`. vLLM/OpenAI-compatible model discovery is supported. Reasoning panel context includes workspace, inventory, graph, ScopeVersion, opportunity, affinity, quote, work, and twin state.

### Gaps

- Reasoning workload routing is modeled but not yet used to move Prism, Affinity, Translation, or Synthesis workloads.
- Reasoning outputs remain advisory and are not validated into certified ScopeVersion truth.
- There is no persisted reasoning audit ledger.

## 11. User Experience Layer

### Current Assets

- `src/dal/DALApp.tsx`
- `src/dal/DALNavigation.tsx`
- `src/dal/DALState.tsx`
- `src/workspaces/*`
- `src/components/ReasoningPanel.tsx`
- `src/components/ReasoningHealthDashboard.tsx`

### Status

Broad but uneven.

The DAL app has a separate shell, banner, navigation, workspace state, and global reasoning panel. It includes Translate, Inventory, Inventory Recovery, Graph Viewer, Graph Extensions, Prism, Site Decision, Candidate Sites, Network Affinity, Portfolio, Marketplace, Control, Field, Twin, and Operational Intelligence.

### UX Gaps

- Some workspace names reflect older graph-first flows rather than ScopeVersion-first doctrine.
- The most constitutional flow is split across Inventory Recovery, Site Decision, Marketplace, Control, Field, and Operational Intelligence.
- No single operator path yet guides a FiberLight user from Inventory ScopeVersion to Texas 400 candidate analysis to certified Site Decision to IOF Package execution.
- Graph Viewer and Network Affinity still reinforce non-MapKernel rendering.

## Duplicate / Drift Detection

### Rendering Drift

- Authoritative path: `ScopeVersionRenderer -> MapKernel`.
- Parallel paths:
  - `GraphMap` in Graph Viewer, Graph Extension, Network Affinity.
  - `LeafletMap` and GIS layers in Twin.

Risk: route, station, node, attachment, and lateral rendering can differ between workspaces.

### Serviceability Drift

- `prismOpportunityEngine.ts` contains local nearest route/node/station sampling.
- `affinity/*Engine.ts` contains newer network affinity and attachment strategy logic.
- `engineering/certificationEngine.ts` contains attachment/lateral/serviceability certification.

Risk: opportunity ranking, network affinity, and certified Site Decision can disagree about nearest infrastructure.

### ScopeVersion Creation Drift

- `scopeVersionUtils.ts` creates several ScopeVersion variants.
- `scopeVersionRepository.ts` creates child ScopeVersions for immutable updates.
- `closeevents/closeEventFramework.ts` creates child ScopeVersions from package closure.
- `server/index.js` duplicates child ScopeVersion creation behavior in JavaScript.

Risk: lineage and immutability rules can diverge between browser and server.

### Validation Drift

- `inventoryValidation.ts` validates inventory graph structure.
- `scopeVersionCertification.ts` certifies graph-backed ScopeVersions.
- `scopeVersionValidation.ts` validates site-decision ScopeVersions.
- `engineering/certificationEngine.ts` certifies attachment/lateral/serviceability.

Risk: multiple PASS/WARNING/FAIL systems can give conflicting answers unless they are composed into one certification pipeline.

### Persistence Drift

- DAL server persists ScopeVersions, IOF Packages, and Close Events.
- Configured baseline graph API persists inventory graphs and chunks.
- IndexedDB persists fallback/cache records for almost every DAL domain object.
- `dalClient.ts` exposes many endpoints that may not exist on the repo-local server.

Risk: users can believe records are server truth when they are browser-only fallback.

### Execution Drift

- New doctrine: IOF Package = Work.
- Current Control workspace: `ControlWorkItem` = work.
- Current Field workspace: `FieldClosure` = closure.
- New Close Event framework: Close Event = authorized transformation.

Risk: execution can happen outside IOF Package and Close Event authority.

## Dependency Graph

```text
DALApp
  -> DALNavigation
  -> DALState
  -> ReasoningPanel
  -> Workspaces

TranslateWorkspace
  -> inventory graph parser/builders
  -> inventoryValidation
  -> dalClient.saveInventoryGraph
  -> IndexedDB fallback or configured inventory graph API

InventoryRecoveryWorkspace
  -> inventoryRecovery
  -> inventoryImportJobs
  -> scopeVersionRepository.ensureInventoryScopeVersion
  -> MapKernel / ScopeVersionRenderer
  -> baseline graph API
  -> IndexedDB cache

InventoryGraph
  -> ScopeVersionUtils.createScopeVersionFromInventoryGraph
  -> ScopeVersionCertification
  -> ScopeVersionRepository
  -> MapKernel

CandidateSitesWorkspace
  -> geocodeEngine
  -> dalClient candidate endpoints / IndexedDB
  -> Prism opportunity generation

PrismWorkspace
  -> prismOpportunityEngine
  -> OpportunitySeeds
  -> dalClient opportunity seed endpoints / IndexedDB

NetworkAffinityWorkspace
  -> affinity engines
  -> engineering certification engine
  -> GraphMap
  -> OpportunitySeeds

PrismSiteDecisionWorkspace
  -> geocodeEngine
  -> network affinity outputs
  -> scopeVersionUtils.createScopeVersionFromSiteDecision
  -> quoteEngine
  -> ScopeVersionRepository
  -> MapKernel / ScopeVersionRenderer

PortfolioWorkspace
  -> OpportunitySeeds
  -> createScopeVersionFromOpportunitySeed
  -> ScopeVersionRepository

MarketplaceWorkspace
  -> ScopeVersions
  -> quoteEngine
  -> quote persistence / IndexedDB fallback

ControlWorkspace
  -> ScopeVersions
  -> MarketplaceQuotes
  -> ControlWorkItems
  -> ScopeVersion status updates

FieldWorkspace
  -> ControlWorkItems
  -> FieldClosures

IOFPackageRepository
  -> ScopeVersionRepository
  -> CloseEventRepository
  -> closeevents
  -> server /api/iof-packages

CloseEventRepository
  -> server /api/close-events
  -> IndexedDB fallback

OperationalIntelligenceWorkspace
  -> dalClient aggregate lists
  -> InventoryRecovery summary
  -> ReasoningRegistry health
  -> MapKernel metrics

TwinWorkspace
  -> TwinState
  -> ControlWorkItems
  -> FieldClosures
  -> LeafletMap

ReasoningPanel
  -> reasoningClient
  -> reasoningRegistry
  -> external reasoning fabric
```

## FiberLight / Texas 400 Readiness Assessment

### FiberLight Inventory Backbone

Status: Mostly ready if DAL1 baseline graph API is reachable.

Ready:

- KMZ/KML/GeoJSON/CSV parsing into inventory graph.
- Inventory validation.
- IndexedDB cache and local recovery.
- Baseline graph server synchronization.
- Inventory ScopeVersion creation.
- Map Kernel rendering through Inventory Recovery.
- Large graph telemetry and chunked push/pull support.

Risks:

- Repo-local DAL server does not own baseline graph endpoints.
- Inventory Workspace and Graph Viewer are still graph-first.
- Server-backed inventory must be explicitly synchronized and validated.

### Texas 400 Candidate Sites

Status: Partially ready.

Ready:

- Candidate CSV import.
- Batch geocoding framework.
- Real geocoder providers: US Census, Nominatim, Mapbox, Google.
- Deterministic fallback when real geocoder is not configured.
- Candidate persistence with IndexedDB fallback.
- Opportunity seed generation and ranking.
- Network affinity, constructability, and certification path.
- Site Decision ScopeVersion creation.
- Preliminary quote generation.

Risks:

- Real geocoding requires configured provider credentials or reachable public providers.
- Candidate/site/opportunity server endpoints are not implemented in the repo-local DAL server.
- Opportunity seeds can still exist without certified Site Decision truth.
- Texas 400 end-to-end should be validated with server-backed inventory, real geocode settings, and Map Kernel rendering before promotion.

### End-to-End Readiness

```text
FiberLight Inventory -> Inventory ScopeVersion: READY / needs configured baseline graph API
Texas 400 Sites -> Geocoded Candidates: PARTIAL / provider-dependent
Candidates -> Network Affinity: READY / deterministic
Network Affinity -> Certified Site Decision: PARTIAL / needs canonical engine consolidation
Site Decision -> ScopeVersion: READY for certified seeds
ScopeVersion -> Quote: READY for preliminary quote
ScopeVersion -> IOF Package: READY at repository level
IOF Package -> Close Event -> Child ScopeVersion: READY at repository/server level
Control/Field/Twin execution: PARTIAL / not IOF Package-first yet
```

## Missing Systems Found

- Dedicated IOF Package workspace.
- Package approval, activation, and execution UI.
- Package-first Control workflow.
- Package-first Field workflow.
- Close Event generation from Field closures by default.
- As-built certification workflow.
- Twin lineage visualization.
- Single canonical serviceability/nearest infrastructure engine.
- Single certification pipeline composing inventory, ScopeVersion, attachment, lateral, and serviceability checks.
- Server implementations for candidate sites, opportunity seeds, graph extensions, quotes, work items, field closures, and twin state in repo-local `server/index.js`.
- Full Design Synthesis workspace.
- Persisted reasoning audit ledger.

## Highest-Risk Drift Areas

1. Map rendering drift: MapKernel, GraphMap, and LeafletMap can show different visual truth.
2. Serviceability drift: Prism distance sampling, affinity engines, and certification engines can choose different nearest route/node/station relationships.
3. Persistence drift: browser fallback records can be mistaken for server-backed truth.
4. Execution drift: ControlWorkItem and FieldClosure still bypass IOF Package and Close Event as the constitutional execution chain.
5. ScopeVersion creation drift: multiple browser/server functions create child ScopeVersions with similar but separate logic.
6. Certification drift: inventory, ScopeVersion, attachment, lateral, serviceability, and validation checks are not yet one ordered pipeline.

## Recommended Next Build Phase

Recommended next phase: **Phase 3.2B.1 - Constitutional Consolidation and FiberLight/Texas 400 End-to-End Validation**.

Build no new major features. Instead:

1. Make MapKernel the only authoritative renderer across Inventory, Graph Extension, Network Affinity, Site Decision, Twin, and Operational Intelligence.
2. Create one shared Serviceability Certification API that wraps nearest route, nearest node, nearest station, nearest edge/segment projection, lateral certification, constructability, and ScopeVersion validation.
3. Make IOF Package the primary work object in Control and Field.
4. Convert FieldClosure into CloseEvent by default.
5. Add an IOF Package workspace for package review, activation, close, and child ScopeVersion lineage.
6. Add visible server-vs-browser authority badges everywhere records are listed.
7. Run a single FiberLight backbone plus Texas 400 candidate flow from inventory recovery through certified Site Decision, quote, IOF Package, close event, and child ScopeVersion.

The correct next move is consolidation. DAL has enough engines. The platform now needs one truth path.

## Phase 3.2B.1 Results

Date: 2026-06-16

### Summary

Phase 3.2B.1 began consolidation around the FiberLight / Texas 400 user workflow. The Network Affinity workspace now uses a canonical serviceability module and renders the selected opportunity through MapKernel rather than GraphMap.

Implemented:

- `src/serviceability/serviceabilityEngine.ts`
  - `analyzeSiteAgainstInventory(site, inventoryScopeVersion)`
  - `inventoryScopeVersionFromGraph(graph, existingScopeVersion)`
  - `renderServiceabilityAnalysis(result, inventoryScopeVersion)`
  - `createCandidateScopeVersionFromServiceability(...)`
- `NetworkAffinityWorkspace`
  - Select inventory.
  - Select opportunity dataset.
  - Run analysis.
  - View ranked results.
  - Select site.
  - Visualize nearest station, node, edge, attachment, and lateral path through MapKernel.
  - Preview child candidate ScopeVersion.
  - Generate child candidate ScopeVersion.
- `CandidateSite`
  - Added optional `classification`.
  - Added optional `sourceDatasetId`.
- `CandidateSitesWorkspace`
  - Imported CSV records are now grouped as an opportunity dataset.
  - Dataset and classification are visible in the candidate table.

### FiberLight / Texas 400 Readiness

```text
FBL upload: PARTIAL
Reason: Inventory upload and recovery are implemented, but repo-local DAL server does not own baseline graph routes. DAL1 baseline graph API must remain reachable and validated.
Next action: Use Inventory Recovery to confirm server-backed FiberLight inventory and generate/verify the inventory ScopeVersion before running Texas 400 analysis.

Texas 400 dataset: PARTIAL
Reason: CSV import, dataset grouping, geocoding, and exclusion of ungeocoded sites are implemented. Real geocoding still depends on provider configuration.
Next action: Import Texas 400 CSV, geocode with configured provider, and verify failures are visible before analysis.

End-to-end candidate ScopeVersion generation: PARTIAL / FUNCTIONAL
Reason: Selected ready opportunities can create DRAFT child ScopeVersions with relationshipType=LATERAL_EXTENSION and parentScopeVersionId. Certification and execution package handoff are still later steps.
Next action: Validate generated child ScopeVersions against representative Texas 400 sites and then wire IOF Package execution.
```

### MapKernel Migration Status

Migrated in this phase:

- `NetworkAffinityWorkspace`
  - Removed `GraphMap` from the FiberLight / Texas 400 serviceability workflow.
  - Uses `MapKernel` for selected analysis and child candidate ScopeVersion preview.

Already migrated before this phase:

- `InventoryRecoveryWorkspace`
- `PrismSiteDecisionWorkspace`
- Operational Intelligence metrics via MapKernel render summaries.

Still legacy or partial:

- `GraphViewerWorkspace` still uses `GraphMap`.
- `GraphExtensionWorkspace` still uses `GraphMap`.
- `TwinWorkspace` still uses `LeafletMap`.
- `CandidateSitesWorkspace` shows datasets and records but does not yet include a MapKernel dataset map.
- `PortfolioWorkspace` remains table-first.

### Serviceability Consolidation Status

Canonical module added:

```text
src/serviceability/serviceabilityEngine.ts
```

The module reuses existing engines:

- `nearestRouteEngine`
- `nearestNodeEngine`
- `nearestStationEngine`
- `buildPathEngine`
- `engineering/certificationEngine`
- buried construction defaults

Returned analysis includes:

- parent/source ScopeVersion ID
- nearest station
- nearest node
- nearest edge
- projected edge coordinate
- lateral path
- construction type `BURIED`
- certification readiness

Remaining consolidation:

- `PrismWorkspace` still contains its own distance sampling.
- `opportunityGenerator` still calls older portfolio and affinity paths.
- `PrismSiteDecisionWorkspace` has rich decision logic that should eventually consume `serviceabilityEngine` directly.
- A dedicated nearest-edge engine should be extracted from certification internals when graph topology work resumes.

### Opportunity Analysis Status

Implemented in `NetworkAffinityWorkspace`:

- Select Inventory ScopeVersion via selected inventory graph and hydrated inventory ScopeVersion.
- Select Opportunity Dataset via `sourceDatasetId`.
- Run serviceability analysis against all geocoded sites in dataset.
- Exclude ungeocoded sites from analysis.
- Display ranked result table:
  - Rank
  - Site Name
  - Nearest Station
  - Nearest Node
  - Nearest Edge
  - Distance Feet
  - Build Feet
  - Construction Type
  - Certification Readiness
  - Candidate ScopeVersion Status
- Show selected result on MapKernel:
  - inventory route segment
  - nearest edge
- selected site
- attachment point
- nearest station
- nearest node

## Phase 3.2B.1C Results

Date: 2026-06-16

### Summary

Phase 3.2B.1C hardens the FiberLight / Texas 400 path around location authority, street-constrained lateral evidence, and the human certification gate before child ScopeVersion creation.

Implemented:

- DAL server `POST /api/geocode`
  - Server-side provider chain: US Census, ArcGIS/ESRI, Nominatim/OSM, then manual-review failure.
  - Returns `CERTIFIED`, `AMBIGUOUS`, or `FAILED` with candidates for human review.
- `src/geocoding/geocodeEngine.ts`
  - DAL defaults to server geocoding.
  - Browser providers remain available as explicit alternatives.
  - Certified geocodes store provider, confidence, normalized address, candidates, method, and timestamps.
- `CandidateSitesWorkspace`
  - Adds Texas 400 dataset certification: `DRAFT`, `PARTIAL`, `CERTIFIED`, `REJECTED`.
  - Adds manual geocode review, candidate selection, manual pin, and human approval.
  - Analysis-ready means certified, not merely coordinate-present.
- `src/serviceability/streetSnapEngine.ts`
  - Adds deterministic ROW-grid snap as an honest fallback until authoritative street/ROW data is connected.
- `src/serviceability/streetPathEngine.ts`
  - Adds street-constrained primary lateral path output.
  - Marks fallback routing as `FALLBACK_DIRECT_SEGMENT` and `LOW` confidence.
  - Adds diverse lateral option metadata and `DIVERSITY_NOT_AVAILABLE` when separation is not supportable.
- `src/serviceability/serviceabilityEngine.ts`
  - Adds geocode status, street snap, attachment point, lateral path, diverse path, economics, and readiness evidence.
  - Child ScopeVersion creation now requires a human route certification snapshot.
- `NetworkAffinityWorkspace`
  - Runs analysis only against certified sites.
  - Renders candidate, geocode point, street snap, attachment, route, edge, station, node, and lateral through MapKernel.
  - Adds route edit controls, alternate attachment trial, recalculated economics, approve, reject, preview, and commit gate.

### Doctrine Status

```text
Ungeocoded site: blocked from analysis
Ambiguous site: visible for review, blocked from analysis
Certified geocode: eligible for analysis
Street snap: required for readiness
Lateral path: required for readiness
Human route approval: required for child ScopeVersion creation
Parent inventory ScopeVersion: remains unchanged
Child ScopeVersion: relationshipType=LATERAL_EXTENSION
```

### Remaining Limitations

- Street snap is currently a deterministic ROW-grid fallback, not a parcel/ROW/street centerline service.
- Street routing is represented as a deterministic dogleg path and explicitly marked low-confidence fallback.
- Route vertex editing is implemented through coordinate editing and route operation buttons; true drag handles are not yet part of the SVG MapKernel interaction model.
- Full diversity requires authoritative street topology; current diverse lateral support only reports available separation when deterministic geometry can support it.
  - lateral path

### Candidate ScopeVersion Generation Status

Implemented:

- Ready serviceability result can generate a child candidate ScopeVersion.
- Parent ScopeVersion is not modified.
- Child ScopeVersion fields include:
  - `parentScopeVersionId`
  - `relationshipType = LATERAL_EXTENSION`
  - site reference
  - attachment reference
  - lateral geometry
  - station/node/edge references
  - graph summary delta
  - DRAFT status
  - non-authoritative constitutional status

Remaining:

- Candidate ScopeVersion certification remains a later operator action.
- Candidate ScopeVersion package generation is not yet exposed in this workflow.
- The generated child ScopeVersion uses selected serviceability evidence but does not yet include marketplace quote basis.

### Remaining Duplicate Systems

- `GraphMap` remains in Graph Viewer and Graph Extension.
- `LeafletMap` remains in Twin.
- Prism opportunity generation still has distance logic separate from `serviceabilityEngine`.
- Site Decision still has local decision context builders.
- Control/Field still use `ControlWorkItem` and `FieldClosure` beside the IOF Package / Close Event doctrine.

### Remaining Visualization Gaps

- Opportunity dataset map in Candidate Sites workspace.
- Portfolio-ranked opportunity map.
- Full inventory MapKernel view for very large graphs without SVG overload.
- Graph Extension MapKernel migration.
- Twin MapKernel migration and lineage visualization.
- IOF Package workspace visualization and close flow.
