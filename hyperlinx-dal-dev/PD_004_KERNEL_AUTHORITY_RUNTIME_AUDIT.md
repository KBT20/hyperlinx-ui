# PD-004 Kernel Authority, Runtime Ownership, and Persistence Readiness Audit

Date: 2026-07-07

## Scope

This is a documentation-only audit. No runtime behavior, repository schema, ScopeVersion behavior, Engineering behavior, Commercial behavior, or UI implementation was changed.

The audit reviewed:

- `server/index.js`
- `server/routes/_shared.js`
- `server/routes/commercial-routes.js`
- `server/routes/commercial-opportunities.js`
- `server/routes/proposal-drafts.js`
- `server/routes/engineering-packages.js`
- `server/routes/engineering-certification.js`
- `server/routes/scopeversions.js`
- `server/routes/service-orders.js`
- `src/repositories/commercialRepositories.ts`
- `src/kernel/*`
- `src/runtime/*`
- `src/routeEdit/*`
- `src/corridorExecution/*`
- `src/engineering/EngineeringCertificationProjection.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx`
- current `server/data` JSON records

## Executive Summary

### 1. Does every runtime object have a single authoritative owner?

Mostly, but not completely.

Strong single-owner areas:

- ScopeVersion: `server/routes/scopeversions.js`
- Commercial Route Repository: `server/routes/commercial-routes.js`
- Proposal state: `server/routes/proposal-drafts.js` plus `src/kernel/ProposalAuthorityState.ts`
- Engineering Package: `server/routes/engineering-packages.js`
- Kernel Execution Graph: `src/kernel/KernelExecutionGraph.ts`
- Route edit patches: `src/routeEdit/*`
- Corridor execution projections: `src/corridorExecution/*`

Remaining ownership ambiguity:

- Commercial Opportunity restore still hydrates `routeRepositorySnapshot` and `routeGeometry` into the workspace even though the route repository is the intended geometry owner.
- Commercial Planning still holds full opportunity, route, proposal, estimate, Draft IOF, route repository, and corridor projection state in React at the same time.
- Engineering Certification holds full active Draft IOF Package state plus Engineering Package state plus manually generated station/budget state.
- Some legacy ScopeVersion constructor utilities remain available in client modules, even though server-side creation is guarded.

### 2. Does every workspace consume projections instead of repository truth?

No.

The architecture is moving toward projections, but Commercial Planning and Engineering Certification still consume full repository objects in React state.

Projection-consumption examples:

- `CorridorViewportProjection` in Commercial map overlay.
- `CorridorAggregateProjection` in Commercial diagnostics and estimate sidebar.
- `RouteEditProjection` for patch-based route edits.
- `EngineeringCertificationProjection` for Engineering UI rendering.
- `TwinRenderProjection` for Customer Twin display.

Repository-object consumption examples:

- `GoogleRfpWorkspace.tsx` holds `commercialOpportunities`, `commercialRouteRepositoryRecords`, `generatedRouteRepositorySnapshot`, `activeDraftIofPackage`, `commercialDraftIofPackage`, `proposalRuntimeRecords`, and full commercial draft objects.
- `EngineeringCertificationWorkspace.tsx` holds `activeDraft`, `activeEngineeringPackage`, and full certified package records.

### 3. Is Corridor Execution the single execution runtime?

Partially.

For Commercial large-route streaming, yes: `src/corridorExecution` now owns partitioning, segment workers, checkpoints, aggregate projection, viewport projection, performance metrics, and cache.

However, other corridor-like engines still exist:

- `src/corridor/CorridorGenerationEngine.ts`
- `src/engineering/RouteEngineeringDraftEngine.ts`
- map-level geometry virtualization in `ProposedNetworkMapPanel.tsx`
- route generation in `CommercialOsrmRoutingEngine`

These may be valid domain engines, but the constitutional distinction needs to be explicit:

- route generation creates route truth before repository save;
- Corridor Execution streams and projects already assembled Commercial corridor truth;
- Engineering draft engines create Engineering-owned review artifacts;
- map virtualization renders viewport slices.

### 4. Are Commercial Change Sets the only editing mechanism?

No. The route edit patch model is present and good, but it is not yet the universal Commercial Change Set mechanism.

Implemented:

- `RouteEditSession`
- `RouteEditPatch`
- `RouteEditProjection`
- `RouteEditImpactEngine`
- `RouteEditRevisionRecord`

Not yet universal:

- Commercial estimate/workbook/proposal controls can still change outside a persisted `CommercialChangeSet`.
- Opportunity creation, import, proposal save, customer review, Draft IOF creation, and Engineering submission are workflow actions rather than change-set records.
- Route edit revisions are patch-set records, but not yet persisted through a dedicated Change Set Repository.

### 5. Is Engineering still the governing authority?

Yes for Engineering Certification, with one important caveat.

Engineering Certification restores Engineering Packages from the Engineering Repository and resolves Draft IOF, Route Repository, Proposal, Workbook, and Estimate references before projection. Certification produces a Certified IOF Package and leaves Service Order / ScopeVersion future in the UI.

Caveat:

- `server/routes/engineering-certification.js` contains a `generate-scopeversion` endpoint for post-signature promotion. It is guarded by `scopeversion.authority` permission and server ScopeVersion integrity checks, but its placement inside Engineering Certification route code creates a naming/ownership ambiguity. Constitutionally, that promotion belongs to Runtime after signed Service Order, not Engineering review.

### 6. Are repository truth and projections cleanly separated?

Partially.

Clean separation exists in:

- Engineering Package serializer: reference-only with payload guard.
- Route edit projections: `repositoryTruthUnchanged: true`.
- Corridor projections: aggregate/viewport/cache/checkpoint outputs do not mutate repository truth.
- ScopeVersion server persistence guard.

Blurred separation remains in:

- Opportunity restore compatibility paths embedding route snapshots for hydration.
- React state carrying repository records and projections together.
- Proposal/Draft IOF generation pathways that still carry technical payloads for preview and certification readiness.
- JSON filesystem records that can store large embedded arrays without relational constraints.

### 7. Is the platform ready for PostgreSQL/PostGIS?

Partially ready.

Ready:

- Repository domains are identifiable.
- Route Repository is canonical and API-backed.
- Engineering Package is reference-only.
- Proposal authority has a kernel/state layer.
- ScopeVersion server guard exists.
- Corridor segment, checkpoint, cache, aggregate, and viewport concepts are now explicit.

Not ready:

- Change Set is not yet a first-class persisted repository.
- Corridor checkpoints are in-process only.
- Commercial Opportunity still has route snapshot compatibility fields.
- React workspaces still hold large truth objects instead of projection IDs and slices.
- JSON storage has large blobs: one translation commit is about 36.18 MB, one engineering draft is about 3.3 MB, and multiple route/runtime object files exceed 1 MB.
- No database transaction boundary currently spans route save, opportunity save, proposal save, Draft IOF, Engineering Package, and Service Order.

Recommendation: `PARTIALLY READY`.

### 8. What architectural work remains before persistence?

1. Make Commercial Change Set a first-class repository object.
2. Persist Route Edit revisions through a dedicated change-set/revision table.
3. Move route geometry into one PostGIS-owned geometry table and remove embedded geometry compatibility fields from Opportunity records.
4. Persist corridor segment checkpoints or mark them explicitly non-authoritative cache.
5. Replace large workspace React state with repository IDs plus projection handles.
6. Split Runtime ScopeVersion promotion endpoint out of Engineering Certification route naming.
7. Create database transactions for cross-repository commits.
8. Normalize runtime objects, runtime evidence, runtime relationships, and translation commits.
9. Define cache eviction and lifecycle rules for all in-memory maps.
10. Add migration invariants that reject duplicate object ownership.

### 9. What are the top ten architectural risks?

1. Critical: Large JSON blobs are authoritative today and lack relational constraints.
2. Critical: Commercial Opportunity can still hydrate route-owned geometry snapshots.
3. High: Commercial Planning React state holds full repository truth and projections simultaneously.
4. High: Commercial Change Set is not yet universal.
5. High: Corridor checkpoints are in-process and not restart-safe.
6. High: Multiple corridor/route generation/projection engines need clearer constitutional boundaries.
7. Medium: Engineering Certification route file contains Runtime ScopeVersion promotion code.
8. Medium: In-memory caches and artifact registries have uneven eviction policies.
9. Medium: Proposal state authority is improved, but UI labels and dashboards still render derived states.
10. Medium: Browser storage still exists for auth, estimate explorer UI state, map view state, and legacy inventory recovery cache.

### 10. What should be the next constitutional doctrine after this audit?

Recommended next doctrine:

`PD-005 - Change Set Authority, Projection Handles, and Database Transaction Doctrine`

Purpose:

- Make every operator edit a persisted Change Set.
- Make projections read-only and disposable.
- Make repository truth reachable only by ID/reference.
- Define transaction boundaries before PostgreSQL/PostGIS migration.
- Make ScopeVersion promotion a Runtime-only transaction after signed Service Order.

## Overall Verdict

The implementation now reflects the constitutional model in several critical places: route repository authority, reference-only Engineering Package serialization, proposal authority evaluation, ScopeVersion server guards, route edit patches, and corridor streaming projections.

The remaining architectural gap is not doctrine direction. It is authority hardening before database migration:

- fewer full objects in React,
- fewer embedded geometry copies,
- durable Change Set records,
- durable checkpoint policy,
- database transaction boundaries,
- Runtime-only ScopeVersion promotion naming.

The platform is ready for detailed PostgreSQL/PostGIS schema design, but not yet ready for final migration.

## Runtime Flow Audit

Target constitutional flow:

Repository Truth

-> Commercial Change Set

-> Patch Engine

-> Corridor Execution Engine

-> Projection Engine

-> Commercial Projection

-> Workbook / Estimate / Proposal / Engineering Preview / Map

Actual implementation:

- Route Repository, Proposal Repository, Engineering Repository, ScopeVersion, and runtime foundation repositories exist behind API boundaries.
- Route edit patches follow the target flow for assembled commercial route edits.
- Corridor Execution owns segment streaming and viewport/aggregate projections for large commercial corridors.
- Commercial Planning still bypasses a universal Change Set layer for several workflow actions, including opportunity restore, proposal save, Draft IOF creation, and Engineering submission.
- React workspaces still carry repository truth and projections together, especially Commercial Planning.

Deviation:

The patch/projection model is implemented for route edits and corridor rendering, but not yet mandatory for every commercial mutation.

## Projection Audit

| Projection | Input | Output | Authority | Persistence | Finding |
|---|---|---|---|---|---|
| Commercial route projection | Route Repository geometry, route edit session | map/workbook/proposal-visible route views | Route Repository remains owner | transient | Good direction, but full route records still enter React state |
| Corridor aggregate projection | corridor segment summaries | total cost, revenue, margin, confidence, construction mix | projection only | transient/cache | Clean projection boundary |
| Corridor viewport projection | route geometry plus viewport | visible geometry/stations/objects | projection only | transient/cache | Good map pressure reduction |
| Route edit projection | base route/estimate plus patch session | edited projection and impact report | patch session only until save | transient until explicit revision | Strong local edit model |
| Proposal authority projection | Proposal Repository status | dashboard/engineering eligibility state | Proposal Repository | transient | Improved single authority |
| Engineering projection | Engineering Package plus resolved repository references | engineering review/readiness UI | Engineering Repository + Draft IOF references | transient | Hardened with validation warnings |
| Customer Twin render projection | runtime inventory/object records | map-ready customer network | runtime foundation records | transient/cache | Good display projection, source data still large |
| ScopeVersion projection | Certified IOF + executed Service Order | Order for Execution | ScopeVersion authority | persisted ScopeVersion | Server guard is strong |

Projection separation is strongest in Corridor Execution, route edits, proposal authority, and Engineering Certification. It is weakest at workspace boundaries where full repository objects are still passed to React.

## Runtime Scheduler Audit

Recommended execution priority:

| Priority | Work Type | Reason | Current State |
|---|---|---|---|
| P0 | Operator edits and rollback | must remain responsive and preserve original route | route edit session isolates patch failures |
| P1 | Viewport rendering | visible map feedback must not wait for workbook/proposal work | map virtualization and corridor viewport projection exist |
| P2 | Route edit impact calculation | affects current estimate/proposal preview | impact engine has domain boundaries |
| P3 | Workbook and estimate projection | important but can trail map feedback | still mixed with workspace state |
| P4 | Proposal generation/preview | customer artifact, not interactive map loop | repository-backed but still UI-heavy |
| P5 | Engineering validation | should run after package restore/reference validation | Engineering projection boundary exists |
| P6 | Background imports and translation commits | large, resumable, non-interactive | import caching exists; largest JSON pressure remains |
| P7 | Corridor checkpoint creation | useful for recovery/diagnostics | in-process only today |
| P8 | Historical cache warming | should never block operator work | uneven eviction policy today |

Scheduler finding:

The code has several local scheduling mechanisms, including yielding corridor segment workers and projection caches, but no single Runtime Scheduler authority yet. PostgreSQL migration should not assume every long-running job has durable scheduling semantics.

## Architectural Risk Register

| Severity | Risk | Evidence | Recommended Control |
|---|---|---|---|
| Critical | Large JSON blobs are authoritative | translation commit about 36.18 MB; runtime objects and route records over 1 MB | normalize route geometry, translation commits, runtime objects |
| Critical | Route geometry compatibility hydration blurs ownership | Commercial restore can hydrate route snapshots into workspace | make Opportunity reference-only for geometry |
| High | Commercial Planning is a large-object ownership hub | many full repository records in `GoogleRfpWorkspace.tsx` state | replace with IDs, summaries, projection handles |
| High | Commercial Change Set is not universal | route edits use patches; other commercial workflow actions do not | create `commercial_change_sets` repository |
| High | Corridor checkpoints are process-local | checkpoint store is an in-memory `Map` | decide durable checkpoint table or disposable cache policy |
| High | Corridor/domain engine boundaries need naming doctrine | generation, engineering draft, map virtualization, and execution engines coexist | document and enforce engine ownership boundaries |
| Medium | ScopeVersion promotion code appears under Engineering Certification route naming | endpoint is guarded but placed in Engineering route file | move/rename to Runtime promotion authority |
| Medium | Cache eviction is uneven | several in-process maps without common lifecycle policy | define cache TTL/max-size doctrine |
| Medium | UI still derives some status labels | proposal authority is improved, dashboards still render derived views | keep kernel proposal authority as only eligibility input |
| Medium | Browser caches may be mistaken for truth | auth/view/cache/local recovery storage exists | label browser storage as non-authoritative |
