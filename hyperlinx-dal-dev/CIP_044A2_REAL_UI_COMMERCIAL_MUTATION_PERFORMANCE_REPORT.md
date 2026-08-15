# CIP-044A.2 Real UI Commercial Mutation Performance Report

## ROOT CAUSE OF 59-SECOND DELAY

The blocking operation was synchronous Draft IOF structural assembly in `scheduleDraftIofPackageAssembly()` → `assembleDraftIofPackage()`, invoked during `commercialDraftIofPackagePreview` render-time memoization in `GoogleRfpWorkspace.tsx`.

A civil-mix edit rebuilt `activeFinancialDraft`. Two non-structural values then contaminated structural identity:

1. `activeFinancialDraft.routeSegments[].constructionCost` was included in the Product Doctrine input and Draft IOF structural projection.
2. The Draft IOF structural projection hashed full `stationing` and `objectInventory` structures instead of their already-governed revisions/hashes.

Changing the mix therefore changed segment construction costs, changed the Product Doctrine/render dependencies, changed the structural fingerprint, and produced a Draft IOF cache MISS. The miss synchronously assembled the Draft IOF against the full graph/runtime inventory, including the observed 50,282-station customer structure. Because this occurred during React rendering, the browser could not execute the `requestAnimationFrame` that closes the mutation trace until assembly returned. This accounts for the otherwise unexplained gap between millisecond estimate calculations and the observed 59,023.5 ms mutation.

The reasoning timeout was not involved. Neither the civil-mix handler nor deterministic estimate/Doctrine/IOF scheduler awaits `ReasoningServiceManager`. Persistence was not involved: the civil-mix handler performs no repository/API/IndexedDB reads or writes. A React effect cascade was a secondary defect: the corridor worker effect depended on the entire estimate object and restarted after every financial mutation. Giant hashing contributed avoidable work and cache instability, but the structural assembly caused by the false MISS was the dominant long task.

## Repair

- Draft IOF structural identity now contains route identity/feet, authoritative geometry hash, structural route segment identity and extents, Product Doctrine identity/version, station-authority revision, object-inventory authority revision, physical proposal references, geometry references, and Customer Twin reference.
- It excludes civil mix, construction costs, estimate totals, rates, materials, contingency, overhead, markup/margin, O&M, proposal totals, and timestamps.
- Full station/customer-inventory arrays are not traversed when their authoritative revisions are provided.
- Product Doctrine scheduling receives structural segment fields only; `constructionCost` and pricing summaries no longer drive Doctrine identity.
- The corridor worker effect now depends on geometry authority and stable estimate identity, not the changing estimate object. Financial edits therefore do not repartition/recheckpoint the corridor.
- Mutation traces now record chronological milestones, nested expensive operations, unattributed duration, and >50 ms / >100 ms / >500 ms / >1 s / >5 s threshold groups through `completeCommercialMutation()`.
- Worker utilization now reports 0% after queue completion. The previous 100% was “percent of segments checkpointed,” not active utilization.
- Corridor bookends are derived from `estimate.controls.ilaPlanning.bookendIlaEnabled`. OFF produces 0. ON produces A and Z exactly once across the first and last segment.

## Fingerprint evidence

For the 13.44-mile validation fixture:

- Before civil calibration: `edcf28c4`
- After civil calibration: `edcf28c4`
- Field-level structural differences: none
- After a legitimate geometry-authority change: `4070636f`
- Field-level difference: `routeGeometryHash`

The cache is eligible for HIT when only financial values change. A real structural authority change still invalidates it.

## Before and after

### Before

- `CIVIL_MIX_CHANGE`: 59,023.5 ms
- Structural IOF: MISS
- Structural assemblies: 1
- Geometry: cache hit
- Map: not invoked
- Engineering: not invoked
- React renders: 28
- Worker display: 100% (incorrectly represented completion as utilization)
- Repository writes: none identified in the mutation handler
- Reasoning wait: none in the deterministic call chain

### After

No interactive browser automation surface was available in this execution, so a post-repair real-browser render duration and React render count were not fabricated. The focused 13.44-mile lifecycle fixture, including quantity calculation, structural fingerprint/cache eligibility, estimate/financial/proposal operation accounting, and trace finalization, measured:

| Statistic | Duration |
|---|---:|
| min | 0.246 ms |
| median | 0.340 ms |
| mean | 0.816 ms |
| p95 | 4.759 ms |
| max | 4.759 ms |

These are local deterministic lifecycle measurements, not a relabeled browser metric. The source of the 59-second browser stall has been removed from that path. The enhanced UI trace will capture the comparable browser value on the next normal 13.44-mile interaction.

Expected and validated operation state after repair:

| Operation | After |
|---|---:|
| Structural IOF cache | HIT eligible; identical fingerprint |
| Structural assemblies | 0 |
| Structural fingerprint/hash input | authority references; no 50,282-station traversal |
| Geometry rebuilds | 0 |
| Station rebuilds | 0 |
| Object-manifest rebuilds | 0 |
| Product Doctrine rebuilds | 0 for civil changes |
| Map rebuilds | 0 |
| Engineering projections | 0 |
| Repository reads | 0 from civil handler |
| Repository writes | 0 |
| Reasoning waits | 0 |
| Corridor worker dispatch | 0 for financial-only changes |
| Worker utilization after completion | 0% |
| Quantity recalculation | >0 |
| Estimate recalculation | >0 |
| Financial projection | >0 |
| Proposal projection | >0 |

## Chronological trace boundary

The trace now covers the complete interval from input handler entry through React commit/paint and mutation finalization:

1. `civil-mix-event-handler-start`
2. `civil-mix-quantity-complete`
3. `commercial-assumption-state-enqueued`
4. `estimate-control-state-enqueued`
5. nested Product Doctrine cache/fingerprint/assembly timing, if invoked
6. nested Draft IOF structural cache/fingerprint/assembly timing, if invoked
7. nested commercial financial cache/fingerprint/projection timing
8. `react-commit-and-paint-complete`
9. `mutation-finalization`

The trace calculates unattributed time and categorizes every timed operation above 50 ms, 100 ms, 500 ms, one second, and five seconds. In the ten-run fixture, no milestone gap exceeded 100 ms and unattributed time remained within tolerance.

## Persistence and asynchronous services

One unsaved civil-mix input performs no route save, opportunity save, proposal save, IOF package save, transaction-manifest write, runtime-mirror write, IndexedDB write, repository reload, Customer Twin refresh, runtime inventory import, or Proposal Library refresh. Constitutional persistence remains tied to explicit save/release workflow.

Reasoning remains advisory and circuit-broken independently. Unavailability cannot delay deterministic Commercial calculations. No timeout was shortened and no reasoning result was fabricated.

## Other financial mutations

Dependency validation confirms:

- Standard Dirt and rock-rate calibration: rate/quantity as applicable, estimate, financial, and proposal projections only.
- Material-rate calibration: material resolution, estimate, financial, and proposal projections only.
- Markup change: financial and proposal projections only.

None includes Draft IOF, geometry, stationing, map, or Engineering invalidation.

## Bookend anomaly

The `Bookends = 1` value came from `CorridorPartitionEngine` and `CorridorSegmentWorker`, which unconditionally synthesized an A bookend on segment sequence 1 and never created Z. It was unrelated to the governed ILA plan.

The placeholder is removed. Segment summaries now consume the active ILA configuration: OFF yields 0; ON assigns A to the first segment and Z to the last segment. On a one-segment corridor both endpoints are counted, producing 2—not 1. ILA count 0 with bookends OFF yields zero ILA cost.

## Files changed for CIP-044A.2

- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/runtime/ConstitutionalAssemblyScheduler.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/performance/CommercialMutationRuntime.ts`
- `src/corridorExecution/CorridorPartitionEngine.ts`
- `src/corridorExecution/CorridorSegmentWorker.ts`
- `src/corridorExecution/CorridorPerformanceMetrics.ts`
- `cip044a2-real-ui-commercial-mutation-performance-validation.mjs`
- `CIP_044A2_REAL_UI_COMMERCIAL_MUTATION_PERFORMANCE_REPORT.md`

Existing unrelated worktree changes were preserved.

## Validation

- CIP-044A.2 focused validation: 30/30 passed.
- Ten sequential 13.44-mile fixture mutations: all below 500 ms; no 30–60 second wait.
- CIP-041: 30/30 passed.
- CIP-042: 50/50 passed.
- CIP-043: 45/45 passed.
- CIP-044A: 41/41 passed.
- CIP-044A.1: 59/59 passed.
- TypeScript: passed.
- Production Vite build: passed; existing chunk-size warning only.
- No persistence migration, deploy, DAL1 access, or `app.teralinx.net` modification occurred.

## Remaining direct verification

Run ten civil-mix edits in the already-loaded 13.44-mile browser project and export the new mutation timelines. This is needed only to record the final real-browser min/median/mean/p95/max and React render count; the false structural cache miss, full-inventory structural assembly, and corridor-worker restart have been removed from the financial mutation path.

Stop condition observed: CIP-045 and broader Estimate/Calibration redesign were not started.
