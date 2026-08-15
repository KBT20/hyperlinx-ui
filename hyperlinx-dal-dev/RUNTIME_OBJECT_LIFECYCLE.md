# Runtime Object Lifecycle Audit

Date: 2026-07-07

## Lifecycle Classes

Hot:
Visible, selected, actively edited, or currently being validated.

Warm:
Adjacent, recently loaded, or likely to be needed by the next operator action.

Cold:
Persisted or checkpointed and not currently visible.

Released:
Disposed from React state, evicted from cache, or replaced by repository reference.

## Large Object Lifecycle

| Object | Creation | Promotion | Demotion | Eviction / Disposal | Risk |
|---|---|---|---|---|---|
| Commercial Route Repository record | Route import or OSRM route save | Linked to Opportunity by `routeRepositoryId` | Should become reference-only in Opportunity | Durable repository record remains | Geometry can still be hydrated into workspace snapshots |
| Commercial route geometry | Route Repository save | Corridor Execution input | Simplified/viewport geometry | Should release full geometry from React after projection | Files exceed 1 MB in current JSON records |
| CorridorExecutionSession | Commercial route + estimate available | Ready after all segments checkpoint | Hot/warm/cold segment IDs | React state reset when route/estimate unavailable | In-process only |
| CorridorSegment | Partition worker shell | Checkpointed segment | Cold segment after viewport changes | In-process checkpoint store has no TTL | Restart loses checkpoints |
| CorridorCheckpoint | Worker completion | Recoverable segment state | Cold checkpoint | No current durable persistence or TTL | Memory growth if many corridors run |
| CorridorAggregateProjection | Built from segment summaries | Commercial dashboard/workbook summary | Replaced by newer projection | Cache capped through corridor cache | Safe if treated as projection only |
| CorridorViewportProjection | Built for map viewport | Map overlay input | Recomputed on viewport/zoom | React state replaced | Safe if visible geometry remains bounded |
| RouteEditSession | Operator starts edit | Patches applied | Saved/discarded/rollback | React state cleared manually | Holds base estimate and projection; can be large |
| RouteEditPatch | Operator edit | RouteEditProjection | RouteEditRevisionRecord on save | Patch session cleared | Good patch-set-only model |
| RouteEditRevisionRecord | Explicit Save Revision | Future revision history | Cold record | Not dedicated repository yet | Needs persisted Change Set table |
| TransparentCorridorEstimate | Route pricing engine | Commercial workbook/proposal | Route edit projection input | React state remains until route changes | Large estimate/workbook object in UI state |
| Proposal Runtime Object | Proposal save | Customer review/approval | Engineering submission | Repository list remains | Proposal state authority is improved |
| Draft IOF Package | Proposal/Draft IOF creation | Engineering Package submission | Certified IOF Package | Should remain repository truth | Can carry broad technical payloads |
| Engineering Package | Submit to Engineering | Engineering Certification queue | Certified IOF Package | Durable reference-only record | Good reference envelope |
| EngineeringCertificationProjection | Engineering package open | Station/budget/certification UI | Recomputed on draft/package changes | React projection state replaced | Good validation boundary |
| Manual Station Plan | Begin station planning | Budget approval/certification | Certified package evidence | React state plus certification payload | Needs future Station Plan Repository |
| Certified IOF Package | Engineering certification | Service Order Ready | Runtime ScopeVersion promotion after signed Service Order | Durable certified package | Correctly pre-ScopeVersion |
| Service Order | Commercial authorization | Signed/executed order | Runtime promotion input | Durable service order | Legal placeholders still pending |
| ScopeVersion | Runtime authority after signed Service Order | Marketplace/Control/Field execution | Child ScopeVersion/closure | Immutable once certified/rejected | Strong server guard |
| Customer Twin | Runtime inventory/object import | Commercial map context | Render projection | Cached inventory projection | Runtime objects include large JSON files |
| Translation Commit | Import commit | Runtime inventory/object authority | Cold audit record | Durable JSON today | Largest observed persisted file: 36.18 MB |

## Memory Leak Risks

Critical:

- `translation-commits` and `runtime-objects` are large JSON records and currently not normalized.
- Commercial Planning can hold full route, opportunity, proposal, estimate, Draft IOF, repository browser data, and corridor projections together.

High:

- `checkpointStore` in `src/corridorExecution/CorridorCheckpointStore.ts` is an in-process `Map` with no eviction.
- `ConstitutionalProjectionCache` is an in-process `Map` with dependency invalidation but no size cap.
- Route edit sessions hold base estimate and projected estimate simultaneously.

Medium:

- `InventoryImportCache` and `IlaPlanningEngine` memo caches are in-process maps.
- Map view state and estimate explorer UI state use `localStorage`.
- Runtime diagnostics and artifact registries are process-lifetime.

Low:

- Auth session uses localStorage; acceptable but should remain outside repository truth.

## Lifecycle Recommendations

1. Define cache TTL and maximum size for every in-process `Map`.
2. Persist only IDs and projection handles in React state where possible.
3. Move route geometry to PostGIS and expose viewport/segment slices to UI.
4. Persist Corridor checkpoints only if they are intended to survive restart.
5. Create `commercial_change_sets` and `commercial_change_set_patches` before PostgreSQL migration.
6. Separate UI view preferences from runtime/persistence state in audit documentation.
7. Treat `translation-commits` as append-only metadata plus normalized child tables, not a single JSON blob.
