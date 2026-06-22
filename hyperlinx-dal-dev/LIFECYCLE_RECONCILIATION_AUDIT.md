# Lifecycle Reconciliation Audit

Date: 2026-06-22

Scope: DAL only.

Target ScopeVersion: `SV-FBL-411584`

Audit mode: read-only. No code changes.

## Executive Finding

`SV-FBL-411584` has an execution ledger that says the ScopeVersion was approved, Control work was created, Control work was activated, and a Field closure was persisted.

The persisted authoritative lifecycle fields do not reflect that chain.

Current DAL1 persisted state:

| Field | Value |
|---|---|
| `scopeVersionId` | `SV-FBL-411584` |
| `status` | `PROVISIONALLY_CERTIFIED` |
| `canonicalTruth.lifecycleState` | `PROVISIONALLY_CERTIFIED` |
| `canonicalTruth.executionState.overallExecutionState` | `ACTIVE` |
| `canonicalTruth.executionState.engineeringStatus` | `ACTIVE` |
| `updatedAt` | `2026-06-22T19:45:55.549Z` |
| `events.length` | 7 |
| `closures.length` | 1 |
| `canonicalTruth.stations.length` | 5 |
| `canonicalTruth.objects.length` | 5 |

Root reconciliation answer: Twin, Control, and OI are now reading the correct field, but that field is stale in persisted JSON.

## Persisted Event Timeline

Read-only DAL1 `GET /api/scopeversions/SV-FBL-411584` returned these lifecycle-relevant events:

| Time | Event | Payload Summary |
|---|---|---|
| `2026-06-22T19:44:27.859Z` | `scopeversion.site_decision.created` | Candidate/site decision created from `seed-97a10d7d-65d0-48b5-b144-8260ea2ec33a` |
| `2026-06-22T19:44:27.962Z` | `certifiedroute.reference.attached` | `CR-c0888a5a-185c-441f-bf09-88c53941392a`, route authority `PROVISIONALLY_CERTIFIED` |
| `2026-06-22T19:44:27.962Z` | `scopeversion.stationing.generated` | 5 stations, 5 objects |
| `2026-06-22T19:44:32.242Z` | `scopeversion.quoted` | Quote `quote-3a768f85-96b9-457b-9899-448649a71190` |
| `2026-06-22T19:45:23.445Z` | `scopeversion.approved` | Certified route, 5 stations, 5 objects |
| `2026-06-22T19:45:33.150Z` | `scopeversion.control.work_created` | 5 Control work packages created as `PENDING` |
| `2026-06-22T19:45:39.689Z` | `scopeversion.control.activated` | `work-cb397af0-e002-4897-98da-3e5dadbc90f1`, `ENGINEERING` |

Control work read-only check from `GET /api/control/work-items`:

| Work Type | Work Item | Status | Updated |
|---|---|---|---|
| `ENGINEERING` | `work-cb397af0-e002-4897-98da-3e5dadbc90f1` | `ACTIVE` | `2026-06-22T19:45:39.543Z` |
| `PERMITTING` | `work-3433a3d3-dd4d-425a-93e9-480229646cd4` | `PENDING` | `2026-06-22T19:45:32.975Z` |
| `CONSTRUCTION` | `work-6c5fe8bc-9977-4f7d-8cdc-5dc870c60d4c` | `PENDING` | `2026-06-22T19:45:32.975Z` |
| `ACTIVATION` | `work-95c1785a-0362-4337-b3b2-e0b6a7da520c` | `PENDING` | `2026-06-22T19:45:32.975Z` |
| `VALIDATION` | `work-7aed95c4-9811-445f-a015-03b33f1ffc44` | `PENDING` | `2026-06-22T19:45:32.975Z` |

## What Field Is Twin Reading?

Current local DAL UI:

File: `src/workspaces/TwinWorkspace.tsx`

Relevant path:

```ts
const authoritativeLifecycleState = getAuthoritativeLifecycleState(projectionScopeVersion);
...
<span>Lifecycle State: {authoritativeLifecycleState}</span>
```

Twin reads:

```text
ScopeVersion.canonicalTruth.lifecycleState
```

through:

```ts
getAuthoritativeLifecycleState(scopeVersion)
```

Fallback order is:

```text
canonicalTruth.lifecycleState
status
ANALYZED
```

For `SV-FBL-411584`, Twin will display:

```text
PROVISIONALLY_CERTIFIED
```

because both persisted lifecycle fields are `PROVISIONALLY_CERTIFIED`.

Server-side note: local `server/routes/twin-state.js` defines `/api/twin/state`, but the deployed DAL1 endpoint returned `404 Not Found` during this audit. When that happens, `dalClient.loadTwinState()` falls back to local/IndexedDB projection for Twin state. The UI lifecycle renderer still uses `getAuthoritativeLifecycleState()` against the selected ScopeVersion.

## What Field Is Control Reading?

Current local DAL UI:

File: `src/workspaces/ControlWorkspace.tsx`

Relevant paths:

```ts
const activeLifecycleState = getAuthoritativeLifecycleState(activeScope);
```

and the selector renders:

```tsx
{...} [{getAuthoritativeLifecycleState(scope)}]
```

Control reads:

```text
ScopeVersion.canonicalTruth.lifecycleState
```

through:

```ts
getAuthoritativeLifecycleState(scopeVersion)
```

For `SV-FBL-411584`, Control will display:

```text
PROVISIONALLY_CERTIFIED
```

even though Control work contains an `ACTIVE` Engineering package.

## What Field Is OI Reading?

Current local DAL UI:

File: `src/workspaces/OperationalIntelligenceWorkspace.tsx`

Relevant path:

```ts
const lifecycleFor = (scope: ScopeVersion) => getAuthoritativeLifecycleState(scope);
```

OI reads:

```text
ScopeVersion.canonicalTruth.lifecycleState
```

through:

```ts
getAuthoritativeLifecycleState(scopeVersion)
```

For `SV-FBL-411584`, OI will count this ScopeVersion as:

```text
PROVISIONALLY_CERTIFIED
```

not `APPROVED`, not `CONTROL`, and not `CONTROL_ACTIVE`.

## getAuthoritativeLifecycleState()

File: `src/scopeversion/ScopeVersionLifecycleGuard.ts`

Current implementation:

```ts
export function getAuthoritativeLifecycleState(scopeVersion) {
  const canonical = normalizeLifecycleState(scopeVersion?.canonicalTruth?.lifecycleState);
  const topLevel = normalizeLifecycleState(scopeVersion?.status);
  return canonical ?? topLevel ?? "ANALYZED";
}
```

This function intentionally does not infer lifecycle from:

- events
- work items
- closures
- execution state
- timeline

For `SV-FBL-411584`, the function returns:

```text
PROVISIONALLY_CERTIFIED
```

because:

```text
canonicalTruth.lifecycleState = PROVISIONALLY_CERTIFIED
status = PROVISIONALLY_CERTIFIED
```

## Approval Handler Audit

File: `src/workspaces/RouteEngineeringWorkspace.tsx`

Function:

```ts
approveScopeVersionForControl()
```

Current local implementation writes:

```ts
status: "APPROVED"
canonicalTruth.lifecycleState: "APPROVED"
events += scopeversion.approved
```

Persistence path:

```text
RouteEngineeringWorkspace.approveScopeVersionForControl()
  -> saveScopeVersion()
  -> dalClient.saveScopeVersion()
  -> scopeVersionRepository.updateScopeVersion() or createScopeVersion()
  -> PUT/POST /api/scopeversions
  -> server/routes/scopeversions.persistScopeVersion()
  -> mergeScopeVersionLifecycle()
```

For `SV-FBL-411584` specifically:

| Step | Previous Value | Intended New Value | Persistence Evidence | Final Persisted Value |
|---|---|---|---|---|
| `scopeversion.approved` | `PROVISIONALLY_CERTIFIED` | `APPROVED` | Event exists at `2026-06-22T19:45:23.445Z` | `PROVISIONALLY_CERTIFIED` |

Conclusion: the approval event survived persistence, but the lifecycle field update did not survive in the final ScopeVersion record.

## Control Work Created Handler Audit

File: `src/workspaces/ControlWorkspace.tsx`

Functions:

```ts
createWorkPackage()
saveScopeStatus()
```

Current local implementation writes:

```ts
saveScopeStatus(activeScope, "CONTROL", "scopeversion.control.work_created", ...)
```

Inside `saveScopeStatus()`:

```ts
status: nextStatus
canonicalTruth.lifecycleState: nextStatus
canonicalTruth.executionState: buildScopeVersionExecutionState(...)
events += scopeversion.control.work_created
```

For `SV-FBL-411584` specifically:

| Step | Previous Value | Intended New Value | Persistence Evidence | Final Persisted Value |
|---|---|---|---|---|
| `scopeversion.control.work_created` | expected `APPROVED` | `CONTROL` | Event exists at `2026-06-22T19:45:33.150Z`; five work items exist | `PROVISIONALLY_CERTIFIED` |

Conclusion: Control work package creation persisted, but ScopeVersion lifecycle did not advance to `CONTROL`.

## Control Activated Handler Audit

File: `src/workspaces/ControlWorkspace.tsx`

Functions:

```ts
updateWorkStatus(item, "ACTIVE")
saveScopeStatus()
```

Current local implementation writes:

```ts
saveScopeStatus(activeScope, "CONTROL_ACTIVE", "scopeversion.control.activated", ...)
```

For `SV-FBL-411584` specifically:

| Step | Previous Value | Intended New Value | Persistence Evidence | Final Persisted Value |
|---|---|---|---|---|
| `scopeversion.control.activated` | expected `CONTROL` | `CONTROL_ACTIVE` | Event exists at `2026-06-22T19:45:39.689Z`; Engineering work item is `ACTIVE` | `PROVISIONALLY_CERTIFIED` |

Conclusion: work authority advanced, but ScopeVersion lifecycle authority did not.

## Field Closure Handler Audit

Files:

- `src/api/dalClient.ts`
- `src/api/scopeVersionRepository.ts`
- `server/routes/scopeversions.js`
- `src/scopeversion/ClosureAuthorityEngine.ts`

Current local closure persistence path:

```text
FieldWorkspace
  -> saveScopeVersionClosure()
  -> appendScopeVersionClosureRecord()
  -> POST /api/scopeversions/:id/closures
  -> server/routes/scopeversions.applyClosureRecord()
```

Current local server gate:

```js
if (!["CONTROL_ACTIVE", "FIELD_ACTIVE"].includes(lifecycleState)) {
  return 409 LIFECYCLE_AUTHORITY_VIOLATION;
}
```

Current local lifecycle derivation after closure:

```text
object/station IN_PROGRESS or INSTALLED/TESTED/ACCEPTED -> FIELD_ACTIVE
station/object COMPLETE or VERIFIED -> PARTIALLY_COMPLETE/COMPLETE/VERIFIED
station RELEASED or prior CONTROL_ACTIVE -> CONTROL_ACTIVE
```

For `SV-FBL-411584` specifically:

| Step | Previous Value | Intended New Value | Persistence Evidence | Final Persisted Value |
|---|---|---|---|---|
| Field object release closure | expected `CONTROL_ACTIVE` | likely remains `CONTROL_ACTIVE` for release-only closure | One closure exists at `2026-06-22T19:45:55.549Z`; `NETWORK_ATTACHMENT` moved `PLANNED -> RELEASED` | `PROVISIONALLY_CERTIFIED` |

Conclusion: the persisted Field closure proves execution continued, but the authoritative ScopeVersion lifecycle remained stale. This either happened before the local server closure gate was deployed or through a path that did not enforce the current local closure gate.

## COMPLETE Handler Audit

Current local Control completion path:

File: `src/workspaces/ControlWorkspace.tsx`

```ts
if (nextStatus === "COMPLETE" && nextScopedWorkItems.every((workItem) => workItem.status === "COMPLETE")) {
  await saveScopeStatus(activeScope, "COMPLETE", "scopeversion.control.work_complete", ...)
}
```

Current local closure derivation can also return:

```text
COMPLETE
```

when stations are all `COMPLETE` or `VERIFIED`.

For `SV-FBL-411584` specifically:

| Step | Previous Value | Intended New Value | Persistence Evidence | Final Persisted Value |
|---|---|---|---|---|
| Completion | n/a | `COMPLETE` only when all scoped work packages or stations complete | No `scopeversion.control.work_complete` event; only Engineering is `ACTIVE` | `PROVISIONALLY_CERTIFIED` |

Conclusion: `COMPLETE` is not expected yet for this ScopeVersion.

## Reconciliation Matrix

| Lens / Layer | Reads Field | Result For `SV-FBL-411584` | Correctness |
|---|---|---|---|
| `getAuthoritativeLifecycleState()` | `canonicalTruth.lifecycleState`, fallback `status` | `PROVISIONALLY_CERTIFIED` | Correct function, stale data |
| Twin UI | `getAuthoritativeLifecycleState(projectionScopeVersion)` | `PROVISIONALLY_CERTIFIED` | Correct read path |
| Control UI | `getAuthoritativeLifecycleState(activeScope)` | `PROVISIONALLY_CERTIFIED` | Correct read path |
| OI UI | `getAuthoritativeLifecycleState(scope)` | `PROVISIONALLY_CERTIFIED` | Correct read path |
| Execution event ledger | `events[]` | approved, work created, activated | Correct ledger |
| Work package authority | `/api/control/work-items` | one `ACTIVE`, four `PENDING` | Correct work state |
| ScopeVersion authoritative lifecycle | `canonicalTruth.lifecycleState` | `PROVISIONALLY_CERTIFIED` | Stale / incorrect |
| ScopeVersion top-level lifecycle | `status` | `PROVISIONALLY_CERTIFIED` | Stale / incorrect |

## Direct Answers

### What field is Twin reading?

Twin reads:

```text
getAuthoritativeLifecycleState(projectionScopeVersion)
```

which resolves to:

```text
ScopeVersion.canonicalTruth.lifecycleState
```

then falls back to:

```text
ScopeVersion.status
```

### What field is Control reading?

Control reads:

```text
getAuthoritativeLifecycleState(activeScope)
```

which resolves to:

```text
ScopeVersion.canonicalTruth.lifecycleState
```

then falls back to:

```text
ScopeVersion.status
```

### What field is OI reading?

OI reads:

```text
getAuthoritativeLifecycleState(scope)
```

which resolves to:

```text
ScopeVersion.canonicalTruth.lifecycleState
```

then falls back to:

```text
ScopeVersion.status
```

### What field is actually being updated during APPROVED?

Current local intended write:

```text
status = APPROVED
canonicalTruth.lifecycleState = APPROVED
events += scopeversion.approved
```

Actual persisted result for `SV-FBL-411584`:

```text
event persisted
status remained PROVISIONALLY_CERTIFIED
canonicalTruth.lifecycleState remained PROVISIONALLY_CERTIFIED
```

### What field is actually being updated during CONTROL_ACTIVE?

Current local intended write:

```text
status = CONTROL_ACTIVE
canonicalTruth.lifecycleState = CONTROL_ACTIVE
canonicalTruth.executionState.overallExecutionState = ACTIVE
events += scopeversion.control.activated
```

Actual persisted result for `SV-FBL-411584`:

```text
event persisted
work item became ACTIVE
executionState became ACTIVE
status remained PROVISIONALLY_CERTIFIED
canonicalTruth.lifecycleState remained PROVISIONALLY_CERTIFIED
```

### What field is actually being updated during FIELD?

Current local Field closure route is intended to update:

```text
canonicalTruth.closures
canonicalTruth.stations / objects
canonicalTruth.progress
status = derived lifecycle
canonicalTruth.lifecycleState = derived lifecycle
```

For `SV-FBL-411584`, the persisted closure changed object state:

```text
NETWORK_ATTACHMENT: PLANNED -> RELEASED
```

but final persisted lifecycle stayed:

```text
PROVISIONALLY_CERTIFIED
```

### What field is actually being updated during COMPLETE?

No completion transition has occurred for `SV-FBL-411584`.

Current local intended completion write is:

```text
status = COMPLETE
canonicalTruth.lifecycleState = COMPLETE
events += scopeversion.control.work_complete
```

## Root Cause

For `SV-FBL-411584`, the event ledger and work package repository advanced, but the ScopeVersion authoritative lifecycle fields did not.

The immediate cause is not a renderer bug. Twin, Control, and OI read the same canonical lifecycle field and therefore consistently display the stale value.

The divergence is between:

```text
events/work/execution records
```

and:

```text
ScopeVersion.status
ScopeVersion.canonicalTruth.lifecycleState
```

The most likely implementation cause is one of these:

1. The deployed handler that emitted `scopeversion.approved` / `scopeversion.control.*` did not persist `status` and `canonicalTruth.lifecycleState`.
2. A later save persisted an older ScopeVersion snapshot and overwrote the lifecycle fields back to `PROVISIONALLY_CERTIFIED`.
3. DAL1 is not yet running the local guarded lifecycle persistence code in `scopeVersionRepository.ts` and `server/routes/scopeversions.js`.

The read-only evidence does not prove which writer performed the final overwrite, but it proves the final persisted fields are stale after approval, control activation, and field closure.

## Recommended Fix

Deploy the monotonic lifecycle guard to DAL1 and run a targeted reconciliation job for affected ScopeVersions. For each record, derive the minimum valid lifecycle from persisted events, work items, execution state, and closures, then write only `status` and `canonicalTruth.lifecycleState` forward through the guarded ScopeVersion persistence path. For `SV-FBL-411584`, the reconciled lifecycle should be at least `CONTROL_ACTIVE` because `scopeversion.control.activated` exists and Engineering work is `ACTIVE`; if closure semantics require Field execution on object release, reconcile to `FIELD_ACTIVE` only after the authority model explicitly defines release closure as Field activation.
