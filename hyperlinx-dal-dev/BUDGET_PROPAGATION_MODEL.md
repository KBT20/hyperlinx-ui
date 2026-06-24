# Budget Propagation Model

Status: doctrine only.

## Purpose

Budget propagation defines how locked commercial truth can flow through the operating model in future phases.

No propagation execution is implemented in this phase.

## Propagation Path

```text
Budget Lock
  -> Station
  -> Segment
  -> ScopeVersion
  -> Opportunity
  -> Customer
```

## Downward Propagation

Locked costs should be able to propagate down to:

- station allocations.
- segment allocations.
- object allocations.
- category allocations.
- discipline allocations.

This enables future cash burn and earned value reporting.

## Upward Propagation

Locked costs should be able to aggregate up to:

- package totals.
- ScopeVersion budget.
- opportunity budget.
- customer commercial view.
- portfolio budget.

## Future Actuals

Future actuals compare against Locked Budget.

Examples:

- vendor invoice vs locked item.
- field completion cost vs station allocation.
- segment actuals vs segment budget.
- customer view vs ScopeVersion budget.

## Authority Boundary

Budget propagation reports commercial truth.

It does not authorize work.

Control remains execution authority.

Field remains closure authority.

Twin remains projection authority.

