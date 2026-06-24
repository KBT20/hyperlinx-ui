# ScopeVersion Close Authority Validation

Status: doctrine, fixtures, and contract validation only.

## Validation Purpose

This document validates the Phase 6.4H ScopeVersion Close Authority model.

No persistence, execution, UI, routes, kernel mutation, or production changes are implemented.

## Created Contracts

The close authority layer defines:

- `ScopeVersionCloseEvent`.
- `ScopeVersionCloseType`.
- `ScopeVersionCloseAuthority`.
- `ScopeVersionCloseValidation`.
- `ScopeVersionCloseOutcome`.
- `ScopeVersionCloseDiagnostic`.
- `ScopeVersionCloseAuditRecord`.

## Valid Close Examples

Fixture examples include:

- Engineering Close for hyperscaler long haul.
- Budget Close after Marketplace Budget Lock.
- Vendor Acceptance Close.
- Customer Acceptance Close.
- Contract Close.
- Control Activation Close.
- Field Close.
- Superseding Budget Close.

## Rejected Close Examples

Fixture rejections include:

- AI-generated close attempt using `AI_ASSISTANT_ADVISORY`.
- close missing `scopeVersionId`.

## Actor Role Examples

Examples:

- `TERALINX_ENGINEERING` may validate `ENGINEERING_CLOSE`.
- `FINANCE` may validate `BUDGET_CLOSE`.
- `VENDOR` may validate `VENDOR_ACCEPTANCE_CLOSE`.
- `CUSTOMER` may validate `CUSTOMER_ACCEPTANCE_CLOSE`.
- `LEGAL` may validate `CONTRACT_CLOSE`.
- `FIELD_OPERATOR` may validate `FIELD_CLOSE`.
- `AI_ASSISTANT_ADVISORY` may validate no close.

## ScopeVersion Traceability

Every valid fixture close traces to:

- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.

This prevents orphan close authority.

## Audit Record Examples

Fixture audit records preserve:

- input references.
- evidence ids.
- constraint references.
- actor.
- authority.
- timestamp.
- outcome.
- previous state.
- resulting state.
- replay references.

## Marketplace Budget Lock Mapping

Marketplace Budget Lock becomes authoritative only through:

```text
BudgetLock
  -> BUDGET_CLOSE
  -> ScopeVersion
```

Budget Lock alone is commercial selection evidence, not close authority.

## Field Closure Mapping

Field closure becomes authoritative only through:

```text
Field Closure
  -> FIELD_CLOSE
  -> ScopeVersion
```

Field close remains tied to `scopeVersionId`.

## Remaining Implementation Risks

- Existing operational closure ledgers should be reconciled with the constitutional close model in a future phase.
- Server persistence is not implemented for ScopeVersion Close Authority.
- UI inspection is not implemented.
- Transition rules are not enforced beyond read-only validation.
- Contract/SOF generation is not implemented.
- Budget and vendor response closes remain fixture-level examples.

## Success Criteria

ScopeVersion Close Authority doctrine exists.

Close events require `scopeVersionId`.

Actor authority is defined.

AI advisory cannot validate a close.

Audit is replayable.

No persistence or execution is introduced.

