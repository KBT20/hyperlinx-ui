# Kernel Runtime Ownership Matrix

Date: 2026-07-07

## Reading Key

- Owns: authoritative object or boundary.
- Reads: upstream truth consumed.
- Produces: new artifacts or projections.
- Mutates: authoritative writes.
- Never Mutates: explicit constitutional boundary.
- Persistence Boundary: durable storage or transient layer.
- Runtime Boundary: browser, server route, kernel, worker/projection, or in-process cache.
- Thread Boundary: synchronous UI, async background, server request, or in-process queue.

## Subsystem Matrix

### Repository Truth

Owns:
Server JSON records under `server/data`, through route handlers and repository clients.

Reads:
API request payloads and persisted JSON files.

Produces:
Durable repository records.

Mutates:
Only through `persistRecord` in `server/routes/_shared.js` and route-specific handlers.

Never Mutates:
Projection-only state, React view state, and transient caches should not directly mutate repository truth.

Persistence Boundary:
Filesystem JSON today. PostgreSQL/PostGIS candidate later.

Runtime Boundary:
Server route handlers.

Thread Boundary:
Server request lifecycle.

Dependencies:
`server/index.js`, `server/routes/_shared.js`, repository route files.

Audit Finding:
The repository boundary exists, but JSON files permit oversized embedded payloads and cross-record relationships are not transactionally enforced.

### ScopeVersion

Owns:
Order for Execution, canonical execution truth, lifecycle state, closure application, and execution authority.

Reads:
Certified IOF Package, executed Service Order evidence, customer signature evidence, prior ScopeVersions, closures, Control WorkItems.

Produces:
ScopeVersion records, child ScopeVersions, lifecycle-guarded canonical truth.

Mutates:
ScopeVersion records only through `server/routes/scopeversions.js` and guarded ScopeVersion utilities.

Never Mutates:
Commercial planning truth, Engineering package truth, Proposal state, Route Repository geometry before promotion.

Persistence Boundary:
`server/data/scopeversions`.

Runtime Boundary:
Server-side authority route plus ScopeVersion modules.

Thread Boundary:
Server request lifecycle.

Dependencies:
Service Order, Certified IOF Package, closure authority, lifecycle guard.

Audit Finding:
Server integrity checks block pre-signature execution ScopeVersion creation. Legacy client constructors remain and should be isolated from Commercial paths.

### Authority / Kernel

Owns:
Execution graph authority, deterministic kernel identity, invariant checks, closure/replay expectations.

Reads:
Draft/Certified IOF package artifacts, measured spine, station authority, object station attachment authority, closure ledgers.

Produces:
Kernel Execution Graph, immutable graph identity hash, projections by layer, closure replay state.

Mutates:
In-memory kernel graph artifacts only.

Never Mutates:
Repository truth, ScopeVersion, Commercial records, Field evidence records.

Persistence Boundary:
Currently projection/cache artifacts are in process. ScopeVersion and closure records are persisted elsewhere.

Runtime Boundary:
Kernel modules under `src/kernel`.

Thread Boundary:
Synchronous deterministic computation.

Dependencies:
Spine authority, station authority, closure contracts, execution graph contracts.

Audit Finding:
Kernel identity is deterministic and immutable-by-hash. Persistence readiness depends on storing graph identity and dependencies in database tables rather than in-process objects.

### Corridor Execution Engine

Owns:
Commercial large-corridor partitioning, segment workers, checkpointing, aggregate projection, viewport projection, performance metrics, and segment cache.

Reads:
Commercial route geometry, customer ID, customer twin ID, import hash, workbook hash, estimate summary.

Produces:
CorridorExecutionSession, CorridorSegment, CorridorCheckpoint, CorridorAggregateProjection, CorridorViewportProjection, CorridorPerformanceMetrics.

Mutates:
In-process cache and checkpoint store only.

Never Mutates:
Route Repository, Opportunity Repository, Proposal Repository, Engineering Repository, ScopeVersion, Marketplace, Control, Field.

Persistence Boundary:
Transient in-process today. Checkpoints are not durable.

Runtime Boundary:
`src/corridorExecution`.

Thread Boundary:
Async background execution using yielding segment workers.

Dependencies:
Map virtualization, runtime diagnostics, transparent estimate summary.

Audit Finding:
The engine owns Commercial corridor streaming, but checkpoints must be classified as either durable database records or disposable cache before persistence migration.

### Projection Engine

Owns:
Read-only derived views.

Reads:
Repository truth, kernel artifacts, route edit sessions, corridor segments, engineering packages.

Produces:
Commercial, Engineering, Proposal, Workbook, Estimate, Map, Twin, and Runtime projections.

Mutates:
Projection caches only.

Never Mutates:
Repository truth.

Persistence Boundary:
Mostly transient. ConstitutionalProjectionCache stores in process.

Runtime Boundary:
`src/runtime/ConstitutionalProjectionCache.ts`, `src/customerTwin/TwinRenderProjection.ts`, `src/engineering/EngineeringCertificationProjection.ts`, `src/corridorExecution/*`, `src/performance/MapVirtualization.ts`.

Thread Boundary:
Synchronous computation plus async background for imports/corridors.

Dependencies:
Source repositories and doctrine versions.

Audit Finding:
Projection architecture exists but is not uniformly enforced at workspace boundaries.

### Patch Engine / Change Set Engine

Owns:
Route edit patch semantics and impact domain classification.

Reads:
Base estimate, base controls, route identity, station/object targets.

Produces:
RouteEditProjection, RouteEditImpactReport, RouteEditRevisionRecord.

Mutates:
RouteEditSession in React only until explicit save.

Never Mutates:
Route Repository geometry, inventory, ScopeVersion, Engineering objects.

Persistence Boundary:
Patch-set revision records are produced but no dedicated persistent Change Set Repository exists yet.

Runtime Boundary:
`src/routeEdit`.

Thread Boundary:
Synchronous reducer/projection.

Dependencies:
Transparent estimate controls and ILA planning controls.

Audit Finding:
Good local patch model. Not yet the universal Commercial Change Set architecture.

### Revision Engine

Owns:
Append-only revision metadata on records and route edit revision records.

Reads:
Prior record revision history, patch sessions.

Produces:
Revision history entries.

Mutates:
Embedded `revisionHistory` arrays or transient route edit revision previews.

Never Mutates:
Route geometry or ScopeVersion execution truth.

Persistence Boundary:
Embedded in Commercial Opportunity JSON today.

Runtime Boundary:
`RevisionRepository` in `src/repositories/commercialRepositories.ts`.

Thread Boundary:
Synchronous object update before repository save.

Dependencies:
Opportunity repository.

Audit Finding:
Revision exists but should become its own table/repository for PostgreSQL.

### Commercial Planning

Owns:
Commercial UI state, temporary imported route state, proposal operator workflow, route edit session state, commercial dashboard state.

Reads:
Customer Repository, Customer Twin Repository, Opportunity Repository, Route Repository, Proposal Repository, Draft IOF Package, Engineering Package status, corridor projections.

Produces:
Commercial Opportunity, Route Repository save requests, Proposal records, Draft IOF Package, Engineering Package submission requests, route edit revisions.

Mutates:
Commercial repository records through repository clients. React state for projections and workflow.

Never Mutates:
ScopeVersion, Engineering certification truth, Marketplace, Control, Field.

Persistence Boundary:
Commercial repositories via API. Some UI state is transient.

Runtime Boundary:
`src/components/workspaces/GoogleRfpWorkspace.tsx`.

Thread Boundary:
React render/effects plus async API calls.

Dependencies:
Commercial engines, route repository client, proposal authority kernel, route edit engine, corridor execution engine.

Audit Finding:
Commercial Planning is still the largest coupling point. It should eventually subscribe to projection handles rather than carrying full repository objects.

### Engineering Certification

Owns:
Engineering review, constraints, object/station review, manual station plan, budget confirmation, Certified IOF Package creation.

Reads:
Engineering Package Repository, Draft IOF Package, Route Repository reference, Proposal reference, Workbook reference, Estimate reference.

Produces:
EngineeringCertificationProjection, station plan, engineering budget rows, Certified IOF Package.

Mutates:
Engineering review artifacts, constraints, certified package records.

Never Mutates:
Commercial Route Repository geometry, Commercial Proposal state, ScopeVersion before signed Service Order.

Persistence Boundary:
Engineering packages, IOF packages, certified IOF packages, execution authorization certificates.

Runtime Boundary:
`src/workspaces/EngineeringCertificationWorkspace.tsx`, `server/routes/engineering-packages.js`, `server/routes/engineering-certification.js`.

Thread Boundary:
React UI plus server request lifecycle.

Dependencies:
Engineering Package, Draft IOF Package, Kernel/Spine projections.

Audit Finding:
Engineering restore is repository-backed and reference-driven. ScopeVersion generation code is permission-gated but should be moved/renamed to Runtime promotion ownership.

### Marketplace

Owns:
Marketplace quotes, vendor packages, bid packages, price books, vendor qualifications.

Reads:
ScopeVersion and/or execution-ready packages in intended lifecycle.

Produces:
Marketplace quote/package artifacts.

Mutates:
Marketplace quote records.

Never Mutates:
Commercial planning truth, Engineering certification truth, ScopeVersion canonical truth.

Persistence Boundary:
`server/data/marketplace-quotes` and marketplace modules.

Runtime Boundary:
Marketplace route/modules/workspace.

Thread Boundary:
Server request and UI rendering.

Dependencies:
ScopeVersion or future execution-ready authority.

Audit Finding:
Marketplace remains separated from Commercial/Engineering in current work.

### Control

Owns:
Control WorkItems and release/activation readiness.

Reads:
ScopeVersion, work packages, execution authorization.

Produces:
Control WorkItems and readiness/activation outputs.

Mutates:
Control WorkItem records.

Never Mutates:
Commercial Proposal, Draft IOF, Route Repository.

Persistence Boundary:
`server/data/control-work-items`.

Runtime Boundary:
Control route/modules/workspace.

Thread Boundary:
Server request and UI rendering.

Dependencies:
ScopeVersion.

Audit Finding:
Correctly downstream of ScopeVersion in doctrine.

### Field

Owns:
Field closures, field execution evidence, completion evidence.

Reads:
ScopeVersion work context, Control WorkItems.

Produces:
Closure records and Field view models.

Mutates:
Field closure records and closure-ledger inputs.

Never Mutates:
Commercial/Engineering/Route Repository truth.

Persistence Boundary:
`server/data/field-closures`, ScopeVersion closure application.

Runtime Boundary:
Field route/modules/workspace.

Thread Boundary:
Server request and UI rendering.

Dependencies:
ScopeVersion and Control.

Audit Finding:
Field remains properly downstream.

### Operational Intelligence

Owns:
Operational analytics and projections.

Reads:
Operational Twin, ScopeVersion, closure history, work status.

Produces:
Insight projections, summary metrics.

Mutates:
Should mutate no execution truth.

Never Mutates:
Commercial, Engineering, ScopeVersion canonical truth.

Persistence Boundary:
Projection/cache only unless future intelligence records are added.

Runtime Boundary:
Operational Intelligence workspace/modules.

Thread Boundary:
UI projection.

Dependencies:
Operational Twin and execution records.

Audit Finding:
No direct conflict in reviewed Commercial/Engineering work.

### Twin

Owns:
Customer Twin render projection and Operational Twin state projection.

Reads:
Runtime inventories, runtime objects, runtime relationships, ScopeVersion/closures for operational state.

Produces:
Renderable twin state, operational state.

Mutates:
Projection state only; source inventory is imported through Runtime Foundation.

Never Mutates:
Commercial proposal/route truth.

Persistence Boundary:
Runtime inventory/object/relationship JSON today.

Runtime Boundary:
`src/customerTwin`, `server/routes/twin-state.js`, runtime foundation.

Thread Boundary:
Server reads plus UI projection.

Dependencies:
Runtime foundation records.

Audit Finding:
Customer Twin is repository-backed, but runtime object files include large records and need normalization.

### Translate

Owns:
Source import normalization and translation commits.

Reads:
KMZ/KML/GeoJSON/CSV/Shapefile-like source files.

Produces:
CustomerDesignImport, runtime translation commit, inventory/object/relationship records.

Mutates:
Runtime foundation repositories on commit.

Never Mutates:
Commercial Route Repository unless explicitly promoted/imported as Commercial route.

Persistence Boundary:
`server/data/customer-design-imports`, `translation-commits`, runtime foundation directories.

Runtime Boundary:
Translate modules, import repository, runtime foundation.

Thread Boundary:
Async import/background parse plus server commit.

Dependencies:
Runtime object model, customer inventory parser.

Audit Finding:
Translation commit payloads are currently the largest persisted JSON objects and should be normalized before PostgreSQL migration.
