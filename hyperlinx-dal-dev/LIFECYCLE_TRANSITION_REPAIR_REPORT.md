# Lifecycle Transition Repair Report

Date: 2026-06-22

Scope: DAL only.

Target audit record: `SV-FBL-411584`

## Repair Summary

The defect was lifecycle persistence, not lifecycle rendering.

Twin, Control, Field, and Operational Intelligence already read lifecycle through:

```ts
getAuthoritativeLifecycleState(scopeVersion)
```

The repaired path now makes lifecycle transitions persistent and monotonic by:

1. Canonicalizing `FIELD` as the execution state after Field work begins.
2. Treating `FIELD_ACTIVE`, `IN_FIELD`, and `IN_CONSTRUCTION` as legacy aliases of `FIELD`.
3. Adding `canonicalTruth.lifecycleTimestamp`.
4. Routing quote, approval, Control, and closure transitions through lifecycle transition/merge helpers.
5. Reconciling stale ScopeVersion records from authoritative events, closures, and execution state before repository/server persistence.
6. Normalizing server list and single-record responses so stale records do not leak to workspaces.
7. Adding the same reconciliation to server Twin state because it reads raw data files directly.

## Transition Contract

| Authority Event | Previous Lifecycle | New Lifecycle | Persisted Fields | Authority Source |
|---|---:|---:|---|---|
| `scopeversion.quoted` | `ANALYZED` / `CERTIFIED` / `PROVISIONALLY_CERTIFIED` | `QUOTED` | `status`, `canonicalTruth.lifecycleState`, `canonicalTruth.lifecycleTimestamp` | Marketplace / Site Decision quote |
| `scopeversion.approved` | `QUOTED` | `APPROVED` | `status`, `canonicalTruth.lifecycleState`, `canonicalTruth.lifecycleTimestamp` | Route Engineering |
| `scopeversion.control.work_created` | `APPROVED` | `CONTROL` | `status`, `canonicalTruth.lifecycleState`, `canonicalTruth.lifecycleTimestamp`, `canonicalTruth.executionState` | Control |
| `scopeversion.control.activated` | `CONTROL` | `CONTROL_ACTIVE` | `status`, `canonicalTruth.lifecycleState`, `canonicalTruth.lifecycleTimestamp`, `canonicalTruth.executionState` | Control |
| Field closure / object transition | `CONTROL_ACTIVE` | `FIELD` | `status`, `canonicalTruth.lifecycleState`, `canonicalTruth.lifecycleTimestamp`, closures, object/station state, progress | Field |
| `scopeversion.control.work_complete` | `FIELD` / `PARTIALLY_COMPLETE` | `COMPLETE` | `status`, `canonicalTruth.lifecycleState`, `canonicalTruth.lifecycleTimestamp`, `canonicalTruth.executionState` | Control / Closure authority |
| `scopeversion.operational` | `COMPLETE` / `VERIFIED` | `OPERATIONAL` | `status`, `canonicalTruth.lifecycleState`, `canonicalTruth.lifecycleTimestamp` | Future operational authority |

## Files Modified

| File | Purpose |
|---|---|
| `src/scopeversion/ScopeVersionLifecycleGuard.ts` | Added lifecycle reconciliation from authority events/closures/execution state, canonical `FIELD`, lifecycle timestamps, and transition helper. |
| `src/api/scopeVersionRepository.ts` | Reconciles lifecycle on ScopeVersion normalization and before local/remote saves. |
| `src/commercial/quoteEngine.ts` | Quote transition now uses lifecycle transition helper and advances pre-quote states to `QUOTED`. |
| `src/workspaces/RouteEngineeringWorkspace.tsx` | Approval transition now uses lifecycle transition helper before save. |
| `src/workspaces/ControlWorkspace.tsx` | Control lifecycle transitions now use lifecycle transition helper before save. |
| `src/scopeversion/ClosureAuthorityEngine.ts` | Field closures now transition through lifecycle helper and first closure advances to `FIELD`. |
| `src/scopeversion/LifecycleAuthorityEngine.ts` | Field execution gate now uses canonical `FIELD`. |
| `src/scopeversion/scopeVersionValidation.ts` | Transition table accepts legacy `FIELD_ACTIVE` but canonical path is `FIELD`. |
| `src/components/ScopeVersionLifecycleRibbon.tsx` | Ribbon displays canonical `FIELD`. |
| `src/workspaces/OperationalIntelligenceWorkspace.tsx` | Portfolio counts use canonical `FIELD`. |
| `src/types/dal.ts` | Added `canonicalTruth.lifecycleTimestamp`. |
| `server/routes/scopeversions.js` | Server reconciliation, lifecycle timestamp persistence, normalized list responses, closure transition to `FIELD`. |
| `server/routes/twin-state.js` | Server Twin projection reconciles lifecycle from authoritative events/closures/execution state. |

## SV-FBL-411584 Reconciliation

Current deployed DAL1 persisted values before this repair is deployed:

| Field | Current DAL1 Value |
|---|---|
| `status` | `PROVISIONALLY_CERTIFIED` |
| `canonicalTruth.lifecycleState` | `PROVISIONALLY_CERTIFIED` |
| `canonicalTruth.executionState.overallExecutionState` | `ACTIVE` |
| `canonicalTruth.executionState.engineeringStatus` | `ACTIVE` |
| Events | `scopeversion.approved`, `scopeversion.control.work_created`, `scopeversion.control.activated` |
| Work | Engineering work item is `ACTIVE` |
| Closure | One Field closure exists |

Expected after deployment and reload/save through repaired DAL path:

| Reconciliation Source | Implied Lifecycle |
|---|---|
| `scopeversion.approved` | `APPROVED` |
| `scopeversion.control.work_created` | `CONTROL` |
| `scopeversion.control.activated` | `CONTROL_ACTIVE` |
| `canonicalTruth.executionState.overallExecutionState = ACTIVE` | `CONTROL_ACTIVE` |
| Existing Field closure | `FIELD` |

Final reconciled lifecycle should be:

```text
FIELD
```

The persisted fields should become:

```text
status = FIELD
canonicalTruth.lifecycleState = FIELD
canonicalTruth.lifecycleTimestamp = latest authority timestamp
```

## Event Emission Versus Persistence

Before repair:

```text
event emitted
work package updated
closure saved
lifecycle field could remain stale
```

After repair:

```text
transition helper
  -> mergeScopeVersionLifecycle()
  -> canonicalTruth.lifecycleState
  -> canonicalTruth.lifecycleTimestamp
  -> saveScopeVersion()
```

All transition writers now send lifecycle state through the guard before persistence.

## DAL1 Route Registration

Local DAL server route registration is present:

| Route | Local Status |
|---|---|
| `server/routes/twin-state.js` | Exists |
| `server/index.js` import | `import { handleTwinState } from "./routes/twin-state.js";` |
| `server/index.js` route array | `handleTwinState` registered |
| UI client path | `/api/twin/state?scopeVersionId=...` |

Read-only check against deployed DAL1 before this repair showed:

```text
GET /api/twin/state?scopeVersionId=SV-FBL-411584
404 Not Found
```

Conclusion: the local route exists, but deployed DAL1 is not running this route yet or has not been restarted/deployed with this server code.

## Validation

Automated local checks:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `git diff --check -- hyperlinx-dal-dev` | PASS, line-ending warnings only |
| `node --check server/routes/scopeversions.js` | PASS |
| `node --check server/routes/twin-state.js` | PASS |

Live mutation validation was not performed against DAL1 from this workstation because creating a brand-new ScopeVersion and running execution steps would mutate shared DAL server truth before deployment/restart verification.

Recommended deployment validation after DAL1 deploy:

1. Create new ScopeVersion.
2. Quote it.
3. Approve it in Route Engineering.
4. Create Control work.
5. Activate Control work.
6. Release object in Field.
7. Install object in Field.
8. Complete object / complete all work.
9. Mark operational when the operational authority is implemented.

Expected lifecycle after each step:

| Step | Expected Persisted Lifecycle |
|---|---|
| Create / analyze | `ANALYZED` |
| Certified route attached | `CERTIFIED` or `PROVISIONALLY_CERTIFIED` |
| Quote | `QUOTED` |
| Approve | `APPROVED` |
| Create work | `CONTROL` |
| Activate work | `CONTROL_ACTIVE` |
| First Field closure | `FIELD` |
| Complete all required work/stations | `COMPLETE` |
| Operational handoff | `OPERATIONAL` |

## Remaining Notes

`FIELD_ACTIVE` remains in the type/validation surface as a legacy accepted input, but it normalizes to canonical `FIELD`.

`OPERATIONAL` is supported in lifecycle ranking and reconciliation when `scopeversion.operational` exists. A first-class operational handoff writer is still future work.
