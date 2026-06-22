# Execution Authority Validation

Date: 2026-06-22

Scope: DAL only.

Target ScopeVersion: `SV-FBL-310069`

## Validation Model

The deterministic execution chain is:

```text
Route Engineering
  -> APPROVED
  -> Control
  -> CONTROL_ACTIVE
  -> Field
  -> FIELD_ACTIVE
  -> COMPLETE
  -> Twin Projection
  -> Operational Intelligence
```

## Implemented Validation Points

| Lens | Required State | Implemented Check |
|---|---|---|
| Route Engineering | Writes `APPROVED` | Approval writes `status = APPROVED` and `canonicalTruth.lifecycleState = APPROVED` |
| Control Create Work | `APPROVED` | `canControlCreateWork()` reads `getAuthoritativeLifecycleState()` |
| Control Activate Work | `APPROVED` or `CONTROL` | `canControlActivateWork()` blocks any other lifecycle |
| Field Execute | `CONTROL_ACTIVE` or continuing `FIELD_ACTIVE` | `canFieldExecute()` requires selected active work for the same ScopeVersion |
| Field Closure Server Route | `CONTROL_ACTIVE` or `FIELD_ACTIVE` | `/api/scopeversions/:id/closures` rejects other lifecycle states |
| Completion | All selected-scope work packages `COMPLETE` | Control writes `COMPLETE` when every scoped work package is complete |
| Twin | Selected ScopeVersion only | `/api/twin/state?scopeVersionId=` and `TwinWorkspace` filter work/closures by selected scope |
| Operational Intelligence | Portfolio-wide | OI uses canonical lifecycle for portfolio counts |

## SV-FBL-310069 Read-Only Observation

Read-only DAL1 check on 2026-06-22:

| Field | Observed |
|---|---|
| `scopeVersionId` | `SV-FBL-310069` |
| `status` | `PROVISIONALLY_CERTIFIED` |
| `canonicalTruth.lifecycleState` | `PROVISIONALLY_CERTIFIED` |
| Approved event exists | Yes, `scopeversion.approved` |
| Control work-created event exists | Yes, `scopeversion.control.work_created` |
| Control activated event exists | Yes, `scopeversion.control.activated` |
| Closure record exists | Yes, one Field closure record |
| Station count | 63 |
| Object count | 7 |

This confirms the previous lifecycle regression condition: execution authority events exist, but persisted lifecycle authority is still behind those events in the current server record. The Phase 5.3 local DAL changes prevent new saves from displaying or gating against ad hoc lifecycle fields, and the monotonic lifecycle guard preserves higher lifecycle states once the record is saved through the guarded DAL path.

## SV-FBL-310069 Checklist

| Check | Expected Result |
|---|---|
| Route Engineering approved state | `getAuthoritativeLifecycleState(SV-FBL-310069) === "APPROVED"` after approval |
| Control work creation | Allowed only if canonical lifecycle is `APPROVED` |
| Control activation | Writes canonical lifecycle `CONTROL_ACTIVE` |
| Field active work visibility | Field lists every `ACTIVE` work item with `scopeVersionId === "SV-FBL-310069"` |
| Field closure gate | Blocks with `LIFECYCLE_AUTHORITY_VIOLATION` unless lifecycle is `CONTROL_ACTIVE` or `FIELD_ACTIVE` |
| Twin lifecycle display | Displays the same canonical lifecycle as Control/Field |
| OI lifecycle display | Counts the same canonical lifecycle in portfolio metrics |

## Authority Result

The UI lenses no longer display lifecycle state from `scopeVersion.status` directly. `status` remains for legacy compatibility and persistence, but the read path is unified through `ScopeVersion.canonicalTruth.lifecycleState`.

Control owns work package authority through `ScopeVersionExecutionState`.

Field owns closure authority through `ClosureAuthorityEngine` plus server closure gate.

Twin owns selected ScopeVersion projection only.

Operational Intelligence owns portfolio aggregation only.
