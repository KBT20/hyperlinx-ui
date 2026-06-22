# DAL Kernel Transition Matrix

Scope: `hyperlinx-dal-dev` only.

Invalid transitions must be rejected by the owning authority or reconciled without regression by `mergeScopeVersionLifecycle`.

## ScopeVersion Lifecycle

| Transition | Authority required | Event emitted | Persistence requirement | Projection update | Invalid transition behavior |
|---|---|---|---|---|---|
| `ANALYZED -> CERTIFIED` | Certification authority | `scopeversion.certified` | Save through ScopeVersion repository | Certification readiness | Reject if certification evidence missing |
| `CERTIFIED -> PROVISIONALLY_CERTIFIED` | Route Engineering | certification/route event | Save through lifecycle guard | Provisional execution readiness | Reject if route evidence failed |
| `PROVISIONALLY_CERTIFIED -> QUOTED` | Marketplace/quote engine | `scopeversion.quoted` | `applyQuoteToScopeVersion` then save | Quote counts and commercial basis | Reject if quote missing required basis |
| `QUOTED -> APPROVED` | Route Engineering | `scopeversion.approved` | `transitionScopeVersionLifecycle(..., "APPROVED")` then save | Control eligibility | Reject if CertifiedRoute reference missing |
| `APPROVED -> CONTROL` | Control | `scopeversion.control.work_created` | Save execution state and lifecycle | Work package queue | Reject if not approved |
| `CONTROL -> CONTROL_ACTIVE` | Control | `scopeversion.control.activated` | Save active work and lifecycle | Field eligibility | Reject if selected work item invalid |
| `CONTROL_ACTIVE -> FIELD` | Field/ClosureAuthorityEngine | `field.*.closed` or `scopeversion.field.started` | Append closure and save lifecycle | Field/Twin execution | Reject without active Control work |
| `FIELD -> PARTIALLY_COMPLETE` | ClosureAuthorityEngine | `scopeversion.partially_complete` | Append closure/progress | Percent complete | Recompute from station/object states |
| `PARTIALLY_COMPLETE -> COMPLETE` | ClosureAuthorityEngine/Control | `scopeversion.complete` or `scopeversion.control.work_complete` | Save through lifecycle guard | Completed scope metrics | Reject if work/stations incomplete |
| `COMPLETE -> OPERATIONAL` | Future operations authority | `scopeversion.operational` | Save through lifecycle guard | Operational state | Reject if completion evidence missing |
| `OPERATIONAL -> RETIRED` | Future governance | `scopeversion.retired` | Save through lifecycle guard | Historical projection only | Not implemented yet |

## ControlWorkItem

| Transition | Authority required | Event emitted | Persistence requirement | Projection update | Invalid transition behavior |
|---|---|---|---|---|---|
| `PENDING -> ACTIVE` | Control | `control.work.activated` plus `scopeversion.control.activated` | Save work item and ScopeVersion execution state | Field-visible work | Reject unless ScopeVersion is `APPROVED` or `CONTROL` |
| `ACTIVE -> HOLD` | Control | `control.work.held` | Persist canonical `HOLD`; legacy `ON_HOLD` is normalized on load | Hold/blocker metrics | Reject if work not active |
| `HOLD -> ACTIVE` | Control | `control.work.activated` | Persist active status | Field-visible work | Reject if work cancelled/complete |
| `ACTIVE -> COMPLETE` | Control/Field projection | `control.work.completed` or `scopeversion.control.work_complete` | Persist work item and execution state | Completion metrics | Reject if closure/progress insufficient |
| `PENDING -> CANCELLED` | Control | `control.work.cancelled` | Persist cancelled status | Removed from open work | Reject after completion |
| `ACTIVE -> CANCELLED` | Control | `control.work.cancelled` | Persist cancelled status | Cancelled work metrics | Requires cancellation reason |
| `HOLD -> CANCELLED` | Control | `control.work.cancelled` | Persist cancelled status | Cancelled work metrics | Requires cancellation reason |

## ScopeInfrastructureObject

| Transition | Authority required | Event emitted | Persistence requirement | Projection update | Invalid transition behavior |
|---|---|---|---|---|---|
| `PLANNED -> RELEASED` | Control/Field | field object closure | Append ClosureRecord | Released objects | Reject without active work |
| `RELEASED -> INSTALLED` | Field | `field.object_state_transition.closed` | Append ClosureRecord and update object state | Installed count | Reject if object not released |
| `INSTALLED -> TESTED` | Field | `field.object_state_transition.closed` | Append ClosureRecord | Tested count | Reject if not installed |
| `TESTED -> ACCEPTED` | Field/QA | `field.object_state_transition.closed` | Append ClosureRecord | Accepted count | Reject if not tested |
| `ACCEPTED -> COMPLETE` | Field | `field.object_state_transition.closed` | Append ClosureRecord | Completed object count | Reject if not accepted |
| `COMPLETE -> VERIFIED` | Field/QA | `field.object_state_transition.closed` | Append ClosureRecord | Verified object count | Reject if not complete |
| `Any active state -> BLOCKED` | Field/Control | `field.blocker.created` | Append ClosureRecord/blocker evidence | Blocked count | Preserve prior state for resumption |
| `BLOCKED -> prior state or RELEASED` | Field/Control | `field.blocker.resolved` | Append evidence and state transition | Resumed work | Reject without resolution evidence |
| `Any non-terminal state -> REJECTED` | Field/QA | rejection closure/blocker | Append evidence | Exception count | Terminal until amendment |

## RouteStation

| Transition | Authority required | Event emitted | Persistence requirement | Projection update | Invalid transition behavior |
|---|---|---|---|---|---|
| `PLANNED -> RELEASED` | Control/Field | `field.station_state_transition.closed` | Append ClosureRecord | Released station count | Reject without active work |
| `RELEASED -> IN_PROGRESS` | Field | `field.station_state_transition.closed` | Append ClosureRecord | Active station count | Reject if station not released |
| `IN_PROGRESS -> COMPLETE` | Field | `field.station_state_transition.closed` | Append ClosureRecord | Feet/station completion | Reject if station objects incomplete unless explicitly allowed |
| `COMPLETE -> VERIFIED` | Field/QA | `field.station_state_transition.closed` | Append ClosureRecord | Verified station count | Reject if not complete |
| `Any active state -> BLOCKED` | Field/Control | `field.blocker.created` | Append blocker evidence | Blocked station count | Preserve prior state for resumption |
| `Any non-terminal state -> REJECTED` | Field/QA | rejection closure/blocker | Append evidence | Exception count | Terminal until amendment |

## Route Authority

| Transition | Authority required | Event emitted | Persistence requirement | Projection update | Invalid transition behavior |
|---|---|---|---|---|---|
| `DRAFT -> PROVISIONALLY_CERTIFIED` | Route Engineering | route certification event | Persist CertifiedRoute and ScopeVersion reference | Provisional ScopeVersion validation | Reject if route evidence failed |
| `DRAFT -> CERTIFIED_ROUTE` | Route Engineering | route certification event | Persist CertifiedRoute and ScopeVersion reference | Full route authority | Reject if engineer evidence missing |
| `PROVISIONALLY_CERTIFIED -> CERTIFIED_ROUTE` | Route Engineering | route certification event | Persist CertifiedRoute | Full route authority | Reject if evidence incomplete |
| `Any non-terminal -> REJECTED` | Route Engineering | route rejection event | Persist CertifiedRoute rejection | Blocks ScopeVersion creation/approval | Requires rejection reason |
| `CERTIFIED_ROUTE -> SUPERSEDED` | Future governance | supersession event | Create child/superseding truth | Historical route evidence | Do not mutate approved ScopeVersion evidence |
