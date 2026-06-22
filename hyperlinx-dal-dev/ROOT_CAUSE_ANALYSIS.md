# Root Cause Analysis

Audit date: 2026-06-22

Scope: audit only. No code changes were made for this report.

## Observed Behavior

Twin reports a lifecycle violation for `SV-FBL-131760` equivalent to:

```text
CONTROL_WORK_WITHOUT_APPROVED_SCOPEVERSION
```

The current code name is:

```text
CONTROL_WORK_WITHOUT_APPROVED_SCOPE
```

At the same time, Control work exists and one package is active:

```text
work-50db7189-c73c-4afd-bf85-6958e272644c ENGINEERING ACTIVE
```

## Expected Behavior

For this chain:

```text
Route Engineering
→ ScopeVersion APPROVED
→ Control work created
→ Control work ACTIVE
→ Field closure
→ Twin projection
```

the persisted ScopeVersion should carry an executable lifecycle status:

```text
APPROVED
CONTROL
CONTROL_ACTIVE
FIELD
PARTIALLY_COMPLETE
```

Twin should then see:

- approved/executable ScopeVersion status
- valid route authority
- stations
- objects
- Control work
- active work
- closure records

and should not report Control work without approved ScopeVersion authority.

## Actual Persisted State for `SV-FBL-131760`

From:

```text
GET http://67.213.118.179:3001/api/scopeversions/SV-FBL-131760
```

Persisted fields:

```json
{
  "scopeVersionId": "SV-FBL-131760",
  "status": "PROVISIONALLY_CERTIFIED",
  "certificationState": "DRAFT",
  "isImmutable": false,
  "canonicalTruth.lifecycleState": "PROVISIONALLY_CERTIFIED",
  "canonicalTruth.constitutionalAuthority": "NON_AUTHORITATIVE",
  "certifiedRouteReference.routeAuthorityState": "PROVISIONALLY_CERTIFIED",
  "stationCount": 372,
  "objectCount": 7,
  "closureCount": 1
}
```

Persisted events:

```text
scopeversion.site_decision.created        2026-06-22T14:56:17.627Z
certifiedroute.reference.attached         2026-06-22T14:56:17.728Z
scopeversion.stationing.generated         2026-06-22T14:56:17.728Z
scopeversion.approved                     2026-06-22T14:57:19.014Z
scopeversion.control.work_created         2026-06-22T14:58:05.965Z
scopeversion.control.activated            2026-06-22T14:58:46.003Z
scopeversion.quoted                       2026-06-22T16:21:21.075Z
```

Control work:

```text
5 work items for SV-FBL-131760
1 ACTIVE
4 PENDING
```

Closure:

```text
closure-9c86fcfa-db84-4356-8e90-2096adcca944
workItemId = work-50db7189-c73c-4afd-bf85-6958e272644c
newObjectState = RELEASED
persistenceStatus = PERSISTED
```

## Root Cause

The authoritative lifecycle fields diverged from lifecycle event history.

The event history says:

```text
approved → control work created → control activated
```

But the persisted current state says:

```text
status = PROVISIONALLY_CERTIFIED
canonicalTruth.lifecycleState = PROVISIONALLY_CERTIFIED
```

Twin's lifecycle audit uses current authoritative state, not event history. Therefore Twin correctly reports Control work without an approved/executable ScopeVersion.

## Most Likely Divergence Point

The strongest evidence is event ordering.

The last lifecycle event is:

```text
scopeversion.quoted 2026-06-22T16:21:21.075Z
```

This occurs after:

```text
scopeversion.approved
scopeversion.control.work_created
scopeversion.control.activated
```

The quote helper is:

File: `src/commercial/quoteEngine.ts`

References:

- `src/commercial/quoteEngine.ts:226`
- `src/commercial/quoteEngine.ts:228`
- `src/commercial/quoteEngine.ts:231`
- `src/commercial/quoteEngine.ts:243`

Observed logic:

```ts
const nextStatus = scopeVersion.status === "ANALYZED" ? "QUOTED" : scopeVersion.status;
```

If the quote workflow ran with a stale ScopeVersion object whose status was still `PROVISIONALLY_CERTIFIED`, it would persist:

```text
status = PROVISIONALLY_CERTIFIED
```

while appending:

```text
scopeversion.quoted
```

That matches the observed persisted record exactly: approval/control events remain in `events`, but the current status is back to `PROVISIONALLY_CERTIFIED`.

## Multiple Lifecycle Fields

There are multiple fields/events that can appear lifecycle-like:

- `scopeVersion.status`
- `scopeVersion.certificationState`
- `scopeVersion.certifiedRouteReference.routeAuthorityState`
- `canonicalTruth.lifecycleState`
- `canonicalTruth.constitutionalAuthority`
- `events[].type`

Current authority implementation treats `scopeVersion.status` plus route/station/object evidence as authoritative for Control/Twin lifecycle. It does not derive lifecycle authority from event history.

## Divergence Classification

A. Approval never persisted.

Not the full root cause. The `scopeversion.approved` event persisted, but the top-level status is not approved now.

B. Approval persisted to wrong field.

Partially true. Approval exists in events, but current status is not `APPROVED`, `CONTROL`, or `CONTROL_ACTIVE`.

C. Control checks wrong field.

No. Control work creation checks `scope.status === "APPROVED"`, which is the intended authoritative field.

D. Twin checks wrong field.

No. Twin checks current authoritative ScopeVersion status through `isScopeVersionApprovedForControl(...)`.

E. Projection stale.

Possible contributing factor only if UI retained an old selected ScopeVersion object. The remote record itself is already divergent, so this is not merely a client projection issue.

F. Multiple lifecycle fields exist and are diverging.

Yes. This is the direct observed condition.

## Recommended Fix

Make ScopeVersion lifecycle transitions monotonic and domain-aware in persistence: quote generation must not be allowed to regress a ScopeVersion from `APPROVED`, `CONTROL`, `CONTROL_ACTIVE`, `FIELD`, or later states back to `PROVISIONALLY_CERTIFIED`, `ANALYZED`, or `QUOTED`. The persistence layer should merge lifecycle state using an explicit lifecycle precedence model, and quote application should update commercial/quote fields without overwriting execution authority once Control work has been created or activated.
