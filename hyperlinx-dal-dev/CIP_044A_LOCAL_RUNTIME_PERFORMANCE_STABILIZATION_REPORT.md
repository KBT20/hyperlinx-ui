# CIP-044A — Local Runtime Performance + Stabilization Report

## Scope and stop boundary

This work is local-development only. It did not deploy, contact or modify `app.teralinx.net`, push to DAL1, migrate persistence, introduce PostgreSQL/PostGIS, or add Product #2.

## Outcome

Commercial mutations now use an explicit dependency registry and lightweight trace instead of treating React dependencies as the constitutional invalidation model. Civil allocation has a route-length arithmetic fast path. Product Doctrine uses a physical-configuration fingerprint, map and Engineering projections have independent cache ownership, and Draft IOF structural state is cached separately from financial state. Derived caches are bounded and observable. Local JSON replacement is flush/close/rename based, coordinated writes have transaction manifests, and browser IndexedDB is explicitly subordinate to server persistence.

## Files changed for CIP-044A

- `src/performance/CommercialMutationRuntime.ts`
- `src/performance/InventoryImportCache.ts`
- `src/runtime/RuntimeContracts.ts`
- `src/runtime/ConstitutionalProjectionCache.ts`
- `src/runtime/ConstitutionalAssemblyScheduler.ts`
- `src/mapkernel/MapRenderer.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/repositories/CommercialSummaryProjections.ts`
- `src/repositories/commercialRepositories.ts`
- `src/api/dalStorage.ts`
- `server/routes/_shared.js`
- `server/routes/commercial-routes.js`
- `server/routes/commercial-opportunities.js`
- `server/routes/commercial-revisions.js`
- `server/routes/commercial-iof-packages.js`
- `cip044a-local-runtime-performance-stabilization-validation.mjs`
- `CIP_044A_LOCAL_RUNTIME_PERFORMANCE_STABILIZATION_REPORT.md`

The worktree contained substantial pre-existing local CIP changes. They were preserved and are not claimed as CIP-044A work.

## Timing evidence

The only pre-change timing evidence available was the reported observation that a 10–12 mile civil edit could take “several minutes.” No pre-change tracer existed, so an exact comparable end-to-end baseline for any mutation would be fabricated. A conservative lower bound of 120,000 ms can describe that observation, but it is not treated as a lab measurement.

The validation script measures the deterministic 12-mile dependency fast-path kernels over 100,000 iterations:

| Mutation | Pre-change UI evidence | Final kernel time | Comparable improvement |
|---|---:|---:|---:|
| Civil mix | ≥120,000 ms observed lower bound | 0.000033 ms/change | N/A: UI observation and kernel microbenchmark are not comparable |
| Material rate | Not instrumented | 0.000026 ms/change | N/A |
| Markup | Not instrumented | 0.000012 ms/change | N/A |
| Duct configuration | Not instrumented | 0.000014 ms/change | N/A |
| ILA mode | Not instrumented | 0.000010 ms/change | N/A |

Requested 10–12 mile notation:

- CIVIL MIX: ≥120,000 ms observed UI lower bound → 0.000033 ms fast-path kernel.
- MATERIAL RATE: unavailable pre-change → 0.000026 ms fast-path kernel.
- MARKUP: unavailable pre-change → 0.000012 ms fast-path kernel.
- DUCT CONFIG: unavailable pre-change → 0.000014 ms dependency kernel.
- ILA: unavailable pre-change → 0.000010 ms dependency kernel.

These timings prove the new calculation kernels are route-size independent and comfortably below the computational targets. They do not claim an end-to-end browser percentage improvement. The new collapsed Advanced / Diagnostics trace supplies accurate UI elapsed time on the next interactive fixture run, which is the correct basis for a comparable percentage.

## Execution traces

### Civil mix before

The audited path was UI mutation → React state → broad `useMemo` engines → projection cache → pricing/map/workbook projections → full Draft IOF preview assembly → render. There was no operation counter, invalidation reason, or reliable cache-ownership evidence, so exact pre-change counts are unavailable.

### Civil mix after

One whole-number civil edit executes route-feet allocation, affected estimate recalculation, financial rollup, proposal projection, and three workspace state commits. It records four processed allocation buckets and zero geometry points.

| Operation | Count |
|---|---:|
| Route rebuilds | 0 |
| Station rebuilds | 0 |
| Object-manifest rebuilds | 0 |
| Doctrine evaluations | 0 |
| Structural IOF assemblies | 0 |
| Financial projections | 1 |
| Engineering projections | 0 |
| Map rebuilds | 0 |
| Estimate recalculations | 1 |
| React workspace state commits | 3 |

The same trace also records quantity recalculations = 1 and proposal projections = 1. The UI reports input fingerprint, invalidation reason, preserved dependencies, cache state, elapsed time, objects/geometry processed, repository activity, assembly/projection counts, and render-related state triggers without logging large payloads.

### Other mutation traces

- Material rate: preserves quantity, geometry, stationing, doctrine, structural IOF, map, and Engineering; updates material resolution, estimate, financials, and proposal.
- Markup: updates only Commercial financials and proposal.
- Duct configuration: updates project configuration, Construction Capability, affected quantities/material/rates, estimate, financials, proposal, and the affected physical Draft IOF projection; geometry and station authority remain stable.
- Fiber configuration: updates project configuration, fiber quantity/material resolution, estimate, financials, proposal, and affected physical Draft IOF projection.
- ILA mode: follows CIP-042, with OFF producing zero active ILA contribution; it updates applicable ILA quantity/planning, estimate, financials, proposal, and physical IOF state without rebuilding unrelated geometry.
- Labor rate: preserves quantities and physical artifacts; updates rate resolution, estimate, financials, and proposal.

## Dependency registry

| Mutation | Invalidated dependency classes |
|---|---|
| `CIVIL_MIX_CHANGE` | QUANTITY, ESTIMATE, COMMERCIAL_FINANCIALS, PROPOSAL |
| `MATERIAL_RATE_CHANGE` | MATERIAL_RESOLUTION, ESTIMATE, COMMERCIAL_FINANCIALS, PROPOSAL |
| `LABOR_RATE_CHANGE` | RATE_RESOLUTION, ESTIMATE, COMMERCIAL_FINANCIALS, PROPOSAL |
| `COMMERCIAL_MARKUP_CHANGE` | COMMERCIAL_FINANCIALS, PROPOSAL |
| `DUCT_CONFIGURATION_CHANGE` | PROJECT_CONFIGURATION, CONSTRUCTION_CAPABILITY, QUANTITY, MATERIAL_RESOLUTION, RATE_RESOLUTION, ESTIMATE, COMMERCIAL_FINANCIALS, PROPOSAL, DRAFT_IOF |
| `FIBER_CONFIGURATION_CHANGE` | PROJECT_CONFIGURATION, QUANTITY, MATERIAL_RESOLUTION, ESTIMATE, COMMERCIAL_FINANCIALS, PROPOSAL, DRAFT_IOF |
| `ILA_MODE_CHANGE` | PROJECT_CONFIGURATION, QUANTITY, ESTIMATE, COMMERCIAL_FINANCIALS, PROPOSAL, DRAFT_IOF |

The complete class registry includes GEOMETRY, SPINE, STATIONING, OBJECT_MANIFEST, PRODUCT_DOCTRINE, PROJECT_CONFIGURATION, CONSTRUCTION_CAPABILITY, QUANTITY, RATE_RESOLUTION, MATERIAL_RESOLUTION, ESTIMATE, COMMERCIAL_FINANCIALS, PROPOSAL, DRAFT_IOF, ENGINEERING, and MAP.

## Cache ownership and telemetry

`ConstitutionalProjectionCache` owns reproducible derived projections keyed by artifact type, artifact ID, revision, dependency class, and authoritative input hash. Entries track creation/access time and hit count. It is bounded to 128 entries with a 30-minute derived-projection TTL, explicit artifact/dependency clearing, reasoned invalidation records, and least-recent-access eviction. Persisted constitutional truth is not TTL-controlled.

Inventory projection cache ownership is similarly explicit and bounded to 16 projections and 64 deduplication records. Both expose size/maxima and eviction information. Constitutional telemetry reports hits, misses, hit rate, entries, evictions, invalidations, assemblies, structural assemblies, financial projections, Engineering projections, map rebuilds, and revision changes. The validation proves the hit/miss and bounded-cache instrumentation; a live hit-rate is intentionally not invented before a browser fixture session.

## Structural and financial IOF separation

The scheduler now stores `DraftIofStructuralProjection` using route identity, geometry/physical configuration, station/object inputs, and physical route-segment summaries. Pricing and margin fields are excluded from that fingerprint. `CommercialFinancialProjection` has its own request/fingerprint and is composited with the cached structure for display. Explicit Draft IOF persistence still binds and writes the complete revision.

Product Doctrine is keyed by product, doctrine version, customer/opportunity/route identity, geometry, sites, route segments, station interval, and physical conduit/fiber configuration. Pricing summaries are excluded, so rate, material, and markup edits cannot rebuild doctrine.

## Map and Engineering isolation

Map projection is owned by the MAP dependency class. Financial changes do not invalidate it, and the mutation trace records a rebuild only when map projection is actually invoked. Engineering projection is owned independently by ENGINEERING and is absent from civil, rate, and markup invalidation scopes. Existing Engineering certification and ScopeVersion gates remain unchanged.

## React state and summary projections

Lightweight `CommercialOpportunitySummary`, `RouteSummary`, `ProposalSummary`, `IofPackageSummary`, and `EngineeringPackageSummary` projections were added. They retain selection IDs and small list fields but omit geometry, station graphs, object manifests, source documents, audit collections, and Engineering payloads. Repository interfaces expose summary-list entry points and detailed open-by-ID entry points.

The main Commercial workspace still has legacy full collections for workflows that consume complete records. Replacing every legacy consumer was intentionally not attempted as a high-risk redesign in this stabilization pass; moving server list endpoints from full-record transfer to native summary responses is a remaining bottleneck.

## Local persistence safety

`persistRecord` now creates a unique temporary file in the destination directory, writes JSON, flushes with `sync`, closes the handle, then atomically renames it over the destination. The prior destination remains available until replacement is ready, and a failed rename cleans up the temporary file.

Transaction manifests are stored under the local transaction-manifest repository. They record transaction ID, operation type, tenant/customer/opportunity, start/completion, state, planned/completed writes, artifact IDs, revision IDs, hashes, and failure reason. `STARTED`, `COMMITTED`, and `RECOVERY_REQUIRED` are exercised for route + opportunity save, Commercial Release, Draft IOF save, and Engineering handoff; `FAILED` remains available to callers. These manifests improve audit/recovery and do not claim database transaction semantics.

## IndexedDB authority

The declared policy is `SERVER REPOSITORY = AUTHORITATIVE_PERSISTED_STATE` and `INDEXEDDB = CACHE_OR_OFFLINE_WORKING_COPY`. When the server is available, its revision wins unless there is an explicit unsaved local working revision. Reconciliation returns conflicts rather than silently treating browser and server records as equal truth.

## Validation and regression

- `node cip044a-local-runtime-performance-stabilization-validation.mjs`: 41/41 passed.
- `npx.cmd tsc --noEmit -p tsconfig.json`: passed.
- `npm.cmd run build`: passed; Vite reports the existing large-chunk advisory.
- `git diff --check`: passed; only line-ending notices were emitted.
- Server route syntax checks: passed.
- CIP-035A: passed.
- CIP-036 Kernel Reasoning and OSRM/IOF/Map Projection: passed.
- CIP-037 Commercial Projection Surface and Single Geometry Authority: passed.
- CIP-038: passed.
- CIP-038A: passed.
- CIP-039: passed.
- CIP-040: passed.
- CIP-041: 30/30 passed.
- CIP-042: 50/50 passed.
- CIP-043: 45/45 passed.

## Remaining bottlenecks

1. Capture comparable before/after browser traces with the same saved small, 10–12 mile, and safely available Helium-scale fixtures; the old build has no tracer, so only the reported civil baseline currently exists.
2. Add native server summary endpoints so list screens do not first transfer full records before projecting summaries client-side.
3. Incrementally replace the remaining legacy full-collection React consumers with active IDs plus focused detail projections.
4. Code-split the 505 kB minified Commercial workspace chunk identified by Vite.
5. Exercise transaction recovery with injected write failures and add a local recovery UI before any future persistence migration.

No production promotion or persistence migration was performed.
