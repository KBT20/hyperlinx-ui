# ScopeVersion Transition Requirements

Status: doctrine and read-only requirement contract.

## Requirement Doctrine

Required closes are target-state requirements.

When a transition targets a governed state, the lifecycle authority engine evaluates whether all required close types exist as validated immutable close events for the same `scopeVersionId`.

## Required Close Matrix

| Target State | Required Closes |
| --- | --- |
| `ENGINEERING_APPROVED` | `ENGINEERING_CLOSE` |
| `BUDGET_LOCKED` | `COMMERCIAL_CLOSE`, `BUDGET_CLOSE` |
| `VENDOR_ACCEPTED` | `VENDOR_ACCEPTANCE_CLOSE` |
| `CUSTOMER_ACCEPTED` | `CUSTOMER_ACCEPTANCE_CLOSE` |
| `CONTRACT_EXECUTED` | `CONTRACT_CLOSE` |
| `CONTROL_ACTIVE` | `CONTROL_CLOSE` |
| `FIELD_ACTIVE` | `FIELD_CLOSE` |
| `COMPLETE` | `COMPLETION_CLOSE` |
| `OPERATIONS` | `OPERATIONS_CLOSE` |
| `SUPERSEDED` | `DESIGN_CLOSE` |
| `CANCELLED` | `COMMERCIAL_CLOSE` |

## Missing Requirements

If a required close is missing, the transition is rejected and emits:

```text
[LIFECYCLE_REQUIREMENT_MISSING]
```

Missing requirements do not create fallback authority.

## Close Validation Dependency

Only closes with:

- matching `scopeVersionId`.
- `immutable = true`.
- `validatedAt` present.

may satisfy lifecycle requirements.

