# Twin ScopeVersion Isolation Audit

Date: 2026-06-22

Scope: audit only. No Twin code or supporting source logic was modified.

## Executive Summary

Twin is partially isolated by ScopeVersion.

The `ScopeVersionTwinProjection` path is correctly selected-scope driven: station counts, object counts, station completion, object completion, closure timeline count, lifecycle state, and completed feet in the projection are derived from `selectedScopeVersion` only.

However, the main Twin summary and Completed State panels still display `twinState` values from `loadTwinState()`. That API client path is global: it loads all Control work items and all Field closures, then computes totals without filtering by `selectedScopeVersionId`. The DAL server also does not currently expose `/api/twin/state`, so this path commonly falls back to browser collections and aggregates all records.

Result: Twin currently mixes selected-scope truth with global/fallback summary metrics.

## Data Loading Locations

| Data | Location | Current Source | Filter Applied | Audit Result |
|---|---|---|---|---|
| Selected ScopeVersion | `src/workspaces/TwinWorkspace.tsx:46` | `useDALState().selectedScopeVersion` | Already selected by DAL app state | PASS |
| Work items | `src/workspaces/TwinWorkspace.tsx:69-76` via `listControlWorkItems()` | `/api/control/work-items`, fallback `workItems` collection | Loaded globally; filtered later into `selectedScopeWorkItems` at `TwinWorkspace.tsx:105` | MIXED |
| Field closures | `src/workspaces/TwinWorkspace.tsx:69-77` via `listFieldClosures()` | `/api/field/closures`, fallback `closures` collection | Loaded globally; filtered later into `selectedScopeFieldClosures` at `TwinWorkspace.tsx:107` | MIXED |
| ScopeVersion closure records | `src/workspaces/TwinWorkspace.tsx:108-112` | `selectedScopeVersion.canonicalTruth.closures` plus `selectedScopeVersion.closures` | Inherently selected-scope because records come from selected ScopeVersion | PASS |
| Object closures | `src/scopeversion/ScopeVersionTwinProjection.ts:6-13`, `src/field/FieldExecutionViewModel.ts:54-58` | Embedded ScopeVersion `ClosureRecord[]` with `objectIds` | Inherently selected-scope | PASS |
| Station closures | `src/scopeversion/ScopeVersionTwinProjection.ts:6-13`, `src/scopeversion/ClosureAuthorityEngine.ts:346-392` | Embedded ScopeVersion `ClosureRecord[]` with station fields | Inherently selected-scope | PASS |
| Twin state summary | `src/workspaces/TwinWorkspace.tsx:69`, `src/api/dalClient.ts:585-618` | `/api/twin/state`, fallback from all local `closures` and all local `workItems` | No selected-scope filter | FAIL |
| Twin timeline | `src/workspaces/TwinWorkspace.tsx:461-469`, `src/api/dalClient.ts:590-616` | All work item and field closure events | No selected-scope filter | FAIL |
| Candidate sites | `src/workspaces/TwinWorkspace.tsx:72`, displayed at `TwinWorkspace.tsx:295-296` | All candidate sites | No selected-scope filter | WARNING |
| Opportunity seeds | `src/workspaces/TwinWorkspace.tsx:73`, displayed in deployment phases at `TwinWorkspace.tsx:409-418` | All opportunity seeds | No selected-scope filter | WARNING |
| Inventory graph | `src/workspaces/TwinWorkspace.tsx:46`, route lookup at `TwinWorkspace.tsx:146-147`, inventory counts at `TwinWorkspace.tsx:276-279` | Current selected graph | No verification that selected graph matches selected ScopeVersion inventory/graph reference | WARNING |

## Metric Isolation Audit

| Metric | Source Collection | Filter Applied | Current Behavior | Expected Behavior | Defect Status |
|---|---|---|---|---|---|
| Open work | `TwinState.openWorkItems` from `loadTwinState()` | None | Header displays global open work at `TwinWorkspace.tsx:222`; local fallback computes all non-complete/non-cancelled work at `dalClient.ts:611` | Count only `workItems.filter(item.scopeVersionId === selectedScopeVersionId && open)` | FAIL |
| Open work list | `workItems` from `listControlWorkItems()` | `item.scopeVersionId === selectedScopeVersion?.scopeVersionId` | Open Work panel filters correctly at `TwinWorkspace.tsx:427-430` | Same selected-scope filter | PASS |
| Completed work | `TwinState.completedWorkItems` from `loadTwinState()` | None | Header and Completed State display global completed work at `TwinWorkspace.tsx:223` and `317`; fallback computes all complete work at `dalClient.ts:612` | Count only completed work for selected ScopeVersion | FAIL |
| Work items for scope | `workItems` from `listControlWorkItems()` | `selectedScopeWorkItems` | Diagnostics show both global loaded count and scoped count at `TwinWorkspace.tsx:239-241` | Scoped count is acceptable; global count is diagnostic only if labeled that way | PASS for scoped diagnostic |
| Active work items for scope | `workItems` from `listControlWorkItems()` | `selectedScopeWorkItems.filter(status === "ACTIVE")` | Correctly scoped at `TwinWorkspace.tsx:106` and displayed at `241` | Same selected-scope filter | PASS |
| Closure count | `TwinState.closureCount` from `loadTwinState()` | None | Header and Completed State display global closure count at `TwinWorkspace.tsx:224` and `318`; fallback uses all closures at `dalClient.ts:613` | Count only selected ScopeVersion closures from server field ledger plus ScopeVersion ledger, deduped | FAIL |
| ScopeVersion closure records | `selectedScopeVersion.canonicalTruth.closures` and `selectedScopeVersion.closures` | Inherent selected-scope source | Correctly deduped at `TwinWorkspace.tsx:108-112` | Same selected-scope source | PASS |
| Field closure records | `closures` from `listFieldClosures()` | `closure.scopeVersionId === selectedScopeVersion?.scopeVersionId` | Correctly scoped into `selectedScopeFieldClosures` at `TwinWorkspace.tsx:107` | Same selected-scope filter | PASS |
| Completed closures list | `selectedScopeFieldClosures` or selected ScopeVersion closure records | Selected-scope source | Correctly selected-scope at `TwinWorkspace.tsx:113-114` and rendered at `448-454` | Same selected-scope source | PASS |
| Completed feet, summary | `TwinState.completedFeet` from `loadTwinState()` | None | Header and Completed State display global completed feet at `TwinWorkspace.tsx:225` and `319`; fallback sums all field closure footage at `dalClient.ts:614` | Use selected-scope `twinProjection.completedFeet` or selected-scope closure footage only | FAIL |
| Completed feet, projection | `selectedScopeVersion.canonicalTruth.stations` via `calculateScopeVersionProgress()` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:290`; computed at `ClosureAuthorityEngine.ts:346-392` | Same selected-scope source | PASS |
| Completed stations | `selectedScopeVersion.canonicalTruth.stations` | Inherent selected-scope source | Correctly displayed from `twinProjection.completedStationCount` at `TwinWorkspace.tsx:288` | Same selected-scope source | PASS |
| Verified stations | `selectedScopeVersion.canonicalTruth.stations` | Inherent selected-scope source | Correctly displayed from `twinProjection.verifiedStationCount` at `TwinWorkspace.tsx:227` and `289` | Same selected-scope source | PASS |
| Blocked stations | `selectedScopeVersion.canonicalTruth.stations` | Inherent selected-scope source | Correctly displayed from `twinProjection.blockedStations.length` at `TwinWorkspace.tsx:292` | Same selected-scope source | PASS |
| Rejected stations | `selectedScopeVersion.canonicalTruth.stations` | Inherent selected-scope source | Correctly displayed from `twinProjection.rejectedStations.length` at `TwinWorkspace.tsx:293` | Same selected-scope source | PASS |
| Station completion percent | `selectedScopeVersion.canonicalTruth.stations` and Field execution view model | Inherent selected-scope source | Correctly displayed from `twinProjection.stationDerivedCompletionPercent` at `TwinWorkspace.tsx:345` | Same selected-scope source | PASS |
| Planned assets | `twinProjection.stationStateCounts` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:327` | Same selected-scope source | PASS |
| Released assets | `twinProjection.stationStateCounts` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:328` | Same selected-scope source | PASS |
| In-progress assets | `twinProjection.stationStateCounts` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:329` | Same selected-scope source | PASS |
| Completed assets | `twinProjection.stationStateCounts` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:330` | Same selected-scope source | PASS |
| Verified assets | `twinProjection.stationStateCounts` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:331` | Same selected-scope source | PASS |
| Blocked assets | `twinProjection.stationStateCounts` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:332` | Same selected-scope source | PASS |
| Rejected assets | `twinProjection.stationStateCounts` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:333` | Same selected-scope source | PASS |
| Planned objects | `twinProjection.objectStateCounts` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:335` | Same selected-scope source | PASS |
| Released objects | `twinProjection.objectStateCounts` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:336` | Same selected-scope source | PASS |
| Installed objects | `selectedScopeVersion.canonicalTruth.objects` via `ScopeVersionTwinProjection` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:337`; computed at `ScopeVersionTwinProjection.ts:78` | Same selected-scope source | PASS |
| Tested objects | `selectedScopeVersion.canonicalTruth.objects` via `ScopeVersionTwinProjection` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:338`; computed at `ScopeVersionTwinProjection.ts:79` | Same selected-scope source | PASS |
| Accepted objects | `selectedScopeVersion.canonicalTruth.objects` via `ScopeVersionTwinProjection` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:339`; computed at `ScopeVersionTwinProjection.ts:80` | Same selected-scope source | PASS |
| Completed objects | `selectedScopeVersion.canonicalTruth.objects` via `ScopeVersionTwinProjection` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:340`; computed at `ScopeVersionTwinProjection.ts:81` | Same selected-scope source | PASS |
| Verified objects | `selectedScopeVersion.canonicalTruth.objects` via `ScopeVersionTwinProjection` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:341`; computed at `ScopeVersionTwinProjection.ts:82` | Same selected-scope source | PASS |
| Blocked objects | `selectedScopeVersion.canonicalTruth.objects` via `ScopeVersionTwinProjection` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:342`; computed at `ScopeVersionTwinProjection.ts:83` | Same selected-scope source | PASS |
| Rejected objects | `selectedScopeVersion.canonicalTruth.objects` via `ScopeVersionTwinProjection` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:343`; computed at `ScopeVersionTwinProjection.ts:84` | Same selected-scope source | PASS |
| Object completion percent | `selectedScopeVersion.canonicalTruth.objects` via `ScopeVersionTwinProjection` | Inherent selected-scope source | Correctly displayed at `TwinWorkspace.tsx:344`; computed at `ScopeVersionTwinProjection.ts:49-52` | Same selected-scope source | PASS |
| Lifecycle violations | `selectedScopeVersion`, all `workItems`, selected-scope field closures, selected-scope ScopeVersion closure records | Work item input is global; closure input is scoped | `deriveLifecycleViolations` receives only one ScopeVersion but all work items at `TwinWorkspace.tsx:116-119`; global work items for other scopes produce violations because `deriveLifecycleViolations` flags work without a matching selected scope at `LifecycleAuthorityEngine.ts:201-213` | Pass only `selectedScopeWorkItems` to lifecycle audit in selected ScopeVersion view | FAIL |
| Twin timeline | `TwinState.timeline` from `loadTwinState()` | None | State Timeline displays all work/closure events at `TwinWorkspace.tsx:461-469`; fallback builds all events at `dalClient.ts:590-607` | Timeline must filter events by selected ScopeVersion or use selected-scope closure/work events | FAIL |
| Inventory counts | `selectedGraph` | No ScopeVersion graph/inventory match check | Inventory diagnostic counts at `TwinWorkspace.tsx:276-279` can reflect whatever graph is selected, not necessarily selected ScopeVersion graph | Verify `selectedGraph.inventoryId/graphId` matches `selectedScopeVersion` before displaying in selected-scope Twin | WARNING |
| Planned backbone segment | `selectedGraph.routes.find(routeId === networkBasis.routeId)` | Route ID filter only, no inventory/graph match | Map may render route from mismatched selected graph if app state is inconsistent at `TwinWorkspace.tsx:146-147` | Resolve graph from selected ScopeVersion graph reference or validate selected graph match | WARNING |

## Aggregate Metric Findings

### Global Totals Displayed In Selected ScopeVersion View

The following are currently displayed inside Twin while a selected ScopeVersion is present, but are not filtered by selected ScopeVersion:

- `Open work` in the header: `TwinWorkspace.tsx:222`
- `Completed work` in the header: `TwinWorkspace.tsx:223`
- `Closures` in the header: `TwinWorkspace.tsx:224`
- `Completed feet` in the header: `TwinWorkspace.tsx:225`
- `Completed work` in Completed State: `TwinWorkspace.tsx:317`
- `Closures` in Completed State: `TwinWorkspace.tsx:318`
- `Completed feet` in Completed State: `TwinWorkspace.tsx:319`
- `State Timeline`: `TwinWorkspace.tsx:461-469`
- `Twin timeline source count` diagnostic: `TwinWorkspace.tsx:244`

These values originate from `loadTwinState()` at `src/api/dalClient.ts:585-618`. When `/api/twin/state` is absent or unavailable, the fallback reads all local `closures` and all local `workItems`, then computes global counts.

### Correctly Scoped Metrics

The following are selected-scope isolated:

- `twinProjection.lifecycleState`
- `twinProjection.completedStationCount`
- `twinProjection.verifiedStationCount`
- `twinProjection.completedFeet`
- `twinProjection.percentComplete`
- all station state counts in the Twin Execution Overlay
- all object state counts in the Twin Execution Overlay
- object completion percent
- station-derived completion percent
- completed closures list, because it uses `selectedScopeFieldClosures` or selected ScopeVersion closure records
- open work list, because it filters `selectedScopeWorkItems`

## Supporting Selector Audit

### `buildScopeVersionTwinProjection`

Location: `src/scopeversion/ScopeVersionTwinProjection.ts`

Behavior:

- Accepts exactly one `ScopeVersion`.
- Reads `scopeVersion.canonicalTruth.objects`.
- Reads `scopeVersion.canonicalTruth.closures` and `scopeVersion.closures`.
- Calls `calculateScopeVersionProgress(scopeVersion)`.
- Calls `buildFieldExecutionViewModel(scopeVersion)`.

Isolation status: PASS.

### `calculateScopeVersionProgress`

Location: `src/scopeversion/ClosureAuthorityEngine.ts:346-392`

Behavior:

- Uses stations from the supplied `ScopeVersion`.
- Uses objects from the supplied `ScopeVersion`.
- Uses closures embedded in the supplied `ScopeVersion`.
- Computes completed feet from station states on that `ScopeVersion`.

Isolation status: PASS.

### `buildFieldExecutionViewModel`

Location: `src/field/FieldExecutionViewModel.ts`

Behavior:

- Uses stations from the supplied `ScopeVersion`.
- Uses objects from the supplied `ScopeVersion`.
- Uses closures embedded in the supplied `ScopeVersion`.
- Derives object and station-derived state counts from those selected-scope collections.

Isolation status: PASS.

### `deriveLifecycleViolations`

Location: `src/scopeversion/LifecycleAuthorityEngine.ts:166-327`

Behavior:

- It can operate correctly when passed ScopeVersions and related work/closures for the same scope.
- In Twin, it is called with `[selectedScopeVersion]`, all loaded `workItems`, and scoped closures at `TwinWorkspace.tsx:116-119`.
- Because the work item input is global, work items from other ScopeVersions cannot resolve against the one selected ScopeVersion and may be reported as violations.

Isolation status: FAIL at Twin call site, not necessarily in the helper itself.

## Endpoint and Fallback Findings

| API Client Function | Endpoint | Server Route Found | Fallback | Isolation Risk |
|---|---|---:|---|---|
| `listControlWorkItems()` | `/api/control/work-items` | Yes | Reads all local `workItems` | Medium; caller must filter |
| `listFieldClosures()` | `/api/field/closures` | Yes | Reads all local `closures` | Medium; caller must filter |
| `loadTwinState()` | `/api/twin/state` | No DAL server route found | Reads all local `workItems` and `closures` globally | High |
| `listCandidateSites()` | `/api/candidate-sites` | Yes | Reads all local candidate sites | Low for Twin execution metrics, but displayed globally |
| `listOpportunitySeeds()` | `/api/opportunity-seeds` | Yes | Reads all local seeds | Low for Twin execution metrics, but displayed globally |

## Constitutional Isolation Rule

Inside a selected ScopeVersion Twin view:

1. Every execution metric must be computed from `scopeVersionId === selectedScopeVersionId`.
2. Global counts may appear only in explicitly labeled global diagnostics or portfolio panels.
3. `TwinState` should not be used for selected-scope execution metrics unless it is requested or computed for that selected ScopeVersion.
4. Lifecycle audit inputs must be scope-aligned: selected ScopeVersion, work items for that ScopeVersion, and closures for that ScopeVersion.
5. Inventory graph rendering must verify the selected graph matches the selected ScopeVersion graph reference before presenting route context as selected-scope truth.

## Defect Summary

| Defect | Severity | Evidence | Expected Fix Direction |
|---|---|---|---|
| Header open/completed work, closure count, and completed feet are global | High | `TwinWorkspace.tsx:222-225`; `dalClient.ts:611-614` | Replace with selected-scope calculations or add scoped Twin state endpoint/query |
| Completed State panel repeats global totals | High | `TwinWorkspace.tsx:317-319` | Replace with selected-scope projection or selected-scope closures/work |
| State Timeline renders global timeline | High | `TwinWorkspace.tsx:461-469`; `dalClient.ts:590-616` | Filter timeline events by selected ScopeVersion |
| Lifecycle audit receives global work items | High | `TwinWorkspace.tsx:116-119`; `LifecycleAuthorityEngine.ts:201-213` | Pass `selectedScopeWorkItems` instead of all `workItems` |
| `/api/twin/state` is expected by client but no DAL route exists | Medium | `dalClient.ts:586`; no `server/routes/twin*.js` found | Add scoped server-backed Twin projection or stop using fallback global state in selected view |
| Inventory route/context can come from mismatched selected graph | Medium | `TwinWorkspace.tsx:146-147`, `276-279` | Validate graph identity against selected ScopeVersion inventory/graph reference |
| Candidate and opportunity counts are global inside Twin | Low | `TwinWorkspace.tsx:294-296`, `409-418` | Label as portfolio/global or filter by selected ScopeVersion relationship |

## Final Assessment

Twin currently has strong selected-scope projection primitives, but the workspace still displays several global fallback aggregates in the selected ScopeVersion view.

Doctrine alignment for selected-scope execution metrics: PARTIAL.

Primary failure point: `loadTwinState()` is global and unscoped, yet its values are rendered as top-level Twin metrics for the currently selected ScopeVersion.

Recommended next implementation phase: replace `twinState` usage in selected ScopeVersion panels with a selected-scope Twin projection, and pass only `selectedScopeWorkItems` into `deriveLifecycleViolations` from `TwinWorkspace`.
