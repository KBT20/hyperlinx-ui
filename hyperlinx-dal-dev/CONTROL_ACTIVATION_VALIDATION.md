# Control Activation Validation

Status: validation report for doctrine, contracts, fixtures, and read-only engine.

## Validation Scope

This validation covers readiness and activation authority only.

No work package creation, scheduling, crew assignment, Field execution, persistence, server routes, or kernel behavior is implemented.

## Control-Ready Examples

Fixtures include:

- hyperscaler long-haul control-ready package.
- metro aggregation control-ready package.
- AI corridor control-ready package.

Each includes:

- `CONTRACT_CLOSE`.
- `CONTRACT_EXECUTED` lifecycle state.
- engineering package.
- budget.
- vendor selections.
- object package.
- execution strategy.
- design standards approval.
- reference architecture.
- close chain validation.

## Control-Active Example

The fully approved activation fixture:

- evaluates readiness.
- creates a `CONTROL_CLOSE` draft.
- validates the `CONTROL_CLOSE`.
- evaluates `CONTRACT_EXECUTED -> CONTROL_READY`.
- evaluates `CONTROL_READY -> CONTROL_ACTIVE`.
- creates an audit.

It does not persist the close or create work packages.

## Blocker Examples

Fixtures include:

- missing contract close.
- missing engineering package.
- invalid lifecycle state.
- missing reference architecture.
- missing execution strategy.
- rejected AI advisory activation attempt.

## ScopeVersion Traceability Examples

Every fixture preserves:

- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.

## Lifecycle Transition Examples

Control activation maps:

```text
CONTRACT_EXECUTED
  -> CONTROL_READY
  -> CONTROL_ACTIVE
```

`CONTROL_ACTIVE` requires validated `CONTROL_CLOSE`.

## Remaining Requirements Before Work Package Creation

- work package schema.
- station assignment rules.
- segment assignment rules.
- crew assignment rules.
- schedule model.
- Field activation handoff.
- persistence and server route integration.

