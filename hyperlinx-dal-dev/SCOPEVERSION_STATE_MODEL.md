# ScopeVersion State Model

Status: doctrine and type contract alignment.

## Canonical States

| State | Meaning |
| --- | --- |
| `INTENT` | Business or customer intent exists, but design truth is not established. |
| `DESIGN` | A design candidate is being assembled. |
| `ENGINEERING_REVIEW` | Engineering is reviewing design evidence. |
| `ENGINEERING_APPROVED` | Engineering has approved the design basis. |
| `COMMERCIAL_REVIEW` | Commercial review is evaluating commercial fit. |
| `BUDGET_CANDIDATE` | Budget candidates exist for review. |
| `BUDGET_LOCKED` | Commercial budget truth is locked. |
| `VENDOR_REVIEW` | Vendor capability, response, or availability review is active. |
| `VENDOR_ACCEPTED` | Vendor acceptance evidence is validated. |
| `CUSTOMER_REVIEW` | Customer acceptance review is active. |
| `CUSTOMER_ACCEPTED` | Customer acceptance evidence is validated. |
| `CONTRACT_REVIEW` | Contract package review is active. |
| `CONTRACT_EXECUTED` | Contract execution evidence is validated. |
| `CONTROL_READY` | ScopeVersion is ready for Control planning. |
| `CONTROL_ACTIVE` | Control has activated execution authority. |
| `FIELD_READY` | Field work is ready to begin. |
| `FIELD_ACTIVE` | Field execution authority is active. |
| `COMPLETION_REVIEW` | Field completion is under review. |
| `COMPLETE` | Completion evidence is validated. |
| `OPERATIONS` | The ScopeVersion is operational truth. |
| `SUPERSEDED` | The ScopeVersion has been superseded by governed design authority. |
| `CANCELLED` | The ScopeVersion has been cancelled by governed commercial authority. |

## State Meaning

Lifecycle state describes authority progression.

It does not describe map layer visibility, recommendation strength, work item count, or reasoning confidence.

## Terminal and Exception States

`SUPERSEDED` and `CANCELLED` are governed exception states.

They require explicit transition authority and validated close evidence.

They are not automatic side effects of a newer candidate, rejected recommendation, or failed route.

