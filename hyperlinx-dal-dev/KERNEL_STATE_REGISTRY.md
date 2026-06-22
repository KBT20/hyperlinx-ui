# DAL Kernel State Registry

Scope: `hyperlinx-dal-dev` only.

## ScopeVersion Lifecycle

Canonical lifecycle source: `ScopeVersion.canonicalTruth.lifecycleState`.

Read through: `getAuthoritativeLifecycleState(scopeVersion)`.

Legacy aliases currently normalized by the lifecycle guard:

| Legacy value | Canonical value |
|---|---|
| `RELEASED_TO_CONTROL` | `CONTROL` |
| `ACTIVATED` | `CONTROL_ACTIVE` |
| `FIELD_ACTIVE` | `FIELD` |
| `IN_FIELD` | `FIELD` |
| `IN_CONSTRUCTION` | `FIELD` |

| State | Meaning | Authority allowed to set | Allowed previous states | Allowed next states | Terminal | Projection impact |
|---|---|---|---|---|---|---|
| `ANALYZED` | Candidate or inventory truth has been analyzed but not certified for execution. | Site Decision, Prism, inventory creation | `DRAFT` or creation | `CERTIFIED`, `PROVISIONALLY_CERTIFIED`, `QUOTED`, `APPROVED` | No | Visible as planning truth |
| `CERTIFIED` | Engineering evidence is certified. | Route Engineering/certification engine | `ANALYZED` | `PROVISIONALLY_CERTIFIED`, `QUOTED`, `APPROVED` | No | Eligible for quote/approval if validation passes |
| `PROVISIONALLY_CERTIFIED` | Evidence is sufficient with engineer review/provisional basis. | Route Engineering | `CERTIFIED`, `ANALYZED` | `QUOTED`, `APPROVED` | No | Requires caution labeling |
| `QUOTED` | Commercial quote exists. | Marketplace/quote engine | `PROVISIONALLY_CERTIFIED`, `CERTIFIED`, `ANALYZED` | `APPROVED` | No | Marketplace/OI quoted metrics |
| `APPROVED` | ScopeVersion is approved for Control. | Route Engineering approval | `QUOTED` | `CONTROL` | No | Control can create work |
| `CONTROL` | Control work packages have been created. | Control | `APPROVED` | `CONTROL_ACTIVE` | No | Field remains gated |
| `CONTROL_ACTIVE` | Control work is activated. | Control | `APPROVED`, `CONTROL` | `FIELD`, `PARTIALLY_COMPLETE`, `COMPLETE` | No | Field can execute |
| `FIELD` | Field execution/closure activity exists. | Field via ClosureAuthorityEngine | `CONTROL_ACTIVE` | `PARTIALLY_COMPLETE`, `COMPLETE` | No | Twin/OI execution projection |
| `PARTIALLY_COMPLETE` | Some station/object completion exists. | Field via ClosureAuthorityEngine | `FIELD`, `CONTROL_ACTIVE` | `COMPLETE` | No | Progress metrics increase |
| `COMPLETE` | Production stations or work packages are complete. | Field/Control close logic | `FIELD`, `PARTIALLY_COMPLETE` | `OPERATIONAL` | No | Completion and backlog metrics update |
| `OPERATIONAL` | Finished truth is operational. | Future operational transition authority | `COMPLETE` | `RETIRED` if added | No | Operations state |
| `RETIRED` | Not currently implemented in `ScopeVersionStatus`; reserved future terminal state. | Future governance | `OPERATIONAL` | None | Yes | Historical only |

`BLOCKED`, `REJECTED`, and `VERIFIED` exist in current TypeScript status unions. They are exception or quality states, not part of the monotonic happy path.

## ControlWorkItem Status

Implementation type: `ControlWorkStatus`.

| State | Meaning | Authority allowed to set | Allowed previous states | Allowed next states | Terminal | Projection impact |
|---|---|---|---|---|---|---|
| `PENDING` | Work package exists but is not activated. | Control | Created | `ACTIVE`, `CANCELLED` | No | Control backlog |
| `ACTIVE` | Work package authorizes Field execution. | Control | `PENDING`, `HOLD` | `HOLD`, `COMPLETE`, `CANCELLED` | No | Field-visible work |
| `HOLD` | Canonical wire value for paused work. Legacy `ON_HOLD` is accepted on load and normalized before persistence. | Control | `ACTIVE` | `ACTIVE`, `CANCELLED` | No | Blocked/paused work metrics |
| `COMPLETE` | Work package is complete. | Control/closure projection | `ACTIVE` | None except package close/child truth | Yes for work item | Completed work metrics |
| `CANCELLED` | Work package is cancelled. | Control | `PENDING`, `ACTIVE`, `HOLD` | None | Yes | Removed from open backlog |
| `BLOCKED` | Work package is blocked by an explicit execution issue. | Control | Any active state | Prior state or cancelled | No | Exception metrics |

## RouteStation State

| State | Meaning | Authority allowed to set | Allowed previous states | Allowed next states | Terminal | Projection impact |
|---|---|---|---|---|---|---|
| `PLANNED` | Station exists in ScopeVersion plan. | RouteStationingEngine | Created | `RELEASED`, `BLOCKED`, `REJECTED` | No | Planned asset |
| `RELEASED` | Station is released for work. | Control/Field | `PLANNED` | `IN_PROGRESS`, `BLOCKED`, `REJECTED` | No | Released asset |
| `IN_PROGRESS` | Field work has started. | Field | `RELEASED` | `COMPLETE`, `BLOCKED`, `REJECTED` | No | Active work |
| `COMPLETE` | Station work is complete. | Field | `IN_PROGRESS` | `VERIFIED`, `BLOCKED`, `REJECTED` | No | Completed feet/assets |
| `VERIFIED` | Completion is verified. | Field/QA | `COMPLETE` | `BLOCKED`, `REJECTED` | Quality terminal | Verified asset |
| `BLOCKED` | Work is blocked. | Field/Control | Any active state | Prior active state or `REJECTED` | No | Blocked asset |
| `REJECTED` | Station work is rejected. | Field/QA | Any non-terminal state | None | Yes | Exception state |

## ScopeInfrastructureObject State

| State | Meaning | Authority allowed to set | Allowed previous states | Allowed next states | Terminal | Projection impact |
|---|---|---|---|---|---|---|
| `PLANNED` | Object is part of planned ScopeVersion. | ScopeVersion object factory | Created | `RELEASED`, `BLOCKED`, `REJECTED` | No | Planned object |
| `RELEASED` | Object is released for execution. | Control/Field | `PLANNED` | `INSTALLED`, `BLOCKED`, `REJECTED` | No | Released object |
| `INSTALLED` | Object has been placed/installed. | Field | `RELEASED` | `TESTED`, `BLOCKED`, `REJECTED` | No | Installed count |
| `TESTED` | Object has passed test step. | Field | `INSTALLED` | `ACCEPTED`, `BLOCKED`, `REJECTED` | No | Tested count |
| `ACCEPTED` | Object is accepted. | Field/QA | `TESTED` | `COMPLETE`, `BLOCKED`, `REJECTED` | No | Accepted count |
| `COMPLETE` | Object work is complete. | Field | `ACCEPTED` | `VERIFIED`, `BLOCKED`, `REJECTED` | No | Completed object count |
| `VERIFIED` | Object completion is verified. | Field/QA | `COMPLETE` | `BLOCKED`, `REJECTED` | Quality terminal | Verified count |
| `BLOCKED` | Object work is blocked. | Field/Control | Any active state | Prior state or `RELEASED` | No | Blocked object count |
| `REJECTED` | Object work is rejected. | Field/QA | Any non-terminal state | None | Yes | Exception count |

## Route Authority State

Implementation type: `CertifiedRoute.routeAuthorityState`.

| State | Meaning | Authority allowed to set | Allowed previous states | Allowed next states | Terminal | Projection impact |
|---|---|---|---|---|---|---|
| `DRAFT` | Canonical wire value for draft route evidence. Legacy `DRAFT_ROUTE` is accepted on load and normalized before persistence. | Route Engineering | Created | `PROVISIONALLY_CERTIFIED`, `CERTIFIED_ROUTE`, `REJECTED` | No | Advisory only |
| `PROVISIONALLY_CERTIFIED` | Route can support provisional ScopeVersion authority. | Route Engineering | `DRAFT`, `ENGINEER_REVIEW_REQUIRED` | `CERTIFIED_ROUTE`, `REJECTED`, `SUPERSEDED` | No | ScopeVersion validation passes with caution |
| `CERTIFIED_ROUTE` | Route evidence is certified. | Route Engineering | `DRAFT`, `PROVISIONALLY_CERTIFIED` | `SUPERSEDED` if supported | No | ScopeVersion execution eligible |
| `REJECTED` | Canonical wire value for rejected route evidence. Legacy `REJECTED_ROUTE` is accepted on load and normalized before persistence. | Route Engineering | Any non-terminal route state | None | Yes | Blocks ScopeVersion authority |
| `SUPERSEDED` | Reserved future state for replacement by child/superseding evidence. | Route Engineering/governance | `CERTIFIED_ROUTE` | None | Yes | Historical evidence only |
