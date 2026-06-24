# ScopeVersion Transition Authority

Status: doctrine and read-only authority contract.

## Transition Doctrine

A lifecycle transition is authorized only when:

- the transition exists in the transition registry.
- the actor role is authorized for the target state.
- required closes for the target state are present and validated.
- the close evidence traces to the same `scopeVersionId`.
- the evaluation creates an audit record.

## Main Transition Sequence

```text
INTENT
  -> DESIGN
  -> ENGINEERING_REVIEW
  -> ENGINEERING_APPROVED
  -> COMMERCIAL_REVIEW
  -> BUDGET_CANDIDATE
  -> BUDGET_LOCKED
  -> VENDOR_REVIEW
  -> VENDOR_ACCEPTED
  -> CUSTOMER_REVIEW
  -> CUSTOMER_ACCEPTED
  -> CONTRACT_REVIEW
  -> CONTRACT_EXECUTED
  -> CONTROL_READY
  -> CONTROL_ACTIVE
  -> FIELD_READY
  -> FIELD_ACTIVE
  -> COMPLETION_REVIEW
  -> COMPLETE
  -> OPERATIONS
```

## Governed Exceptions

```text
ENGINEERING_APPROVED -> SUPERSEDED
INTENT -> CANCELLED
```

Exception transitions are explicit authority paths. They may not be inferred from UI actions or stale snapshots.

## Actor Authority

Each target state owns its actor authority requirements.

Examples:

- `ENGINEERING_APPROVED` requires `TERALINX_ENGINEERING`.
- `BUDGET_LOCKED` requires `FINANCE` or `TERALINX_MARKETPLACE`.
- `VENDOR_ACCEPTED` requires `VENDOR` or `TERALINX_MARKETPLACE`.
- `CUSTOMER_ACCEPTED` requires `CUSTOMER` or `TERALINX_SALES`.
- `CONTRACT_EXECUTED` requires `LEGAL`.
- `CONTROL_ACTIVE` requires `TERALINX_OPERATIONS` or `SYSTEM`.
- `FIELD_ACTIVE` requires `FIELD_OPERATOR`, `TERALINX_OPERATIONS`, or `SYSTEM`.

`AI_ASSISTANT_ADVISORY` may never advance lifecycle state.

