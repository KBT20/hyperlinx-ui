# Bid Package Station Propagation

Status: doctrine and contracts only.

## Purpose

Station propagation defines how pricing and quantities can move downward to station-level work and upward to budgets in future phases.

No propagation execution is implemented in this phase.

## Propagation Doctrine

Pricing enters through Bid Package Items.

Pricing propagates to:

- station.
- segment.
- budget.
- ScopeVersion.
- opportunity.
- customer.

## Station Examples

Station 101 may receive separate allocations for:

- conduit.
- fiber.
- splicing.
- optical.
- permit.
- crossing.

Each item can retain its station allocation while also contributing to segment and package totals.

## Allocation Types

Contracts define:

- `StationAllocation`.
- `SegmentAllocation`.
- `DisciplineAllocation`.
- `CategoryAllocation`.

Each allocation may carry quantity share and estimated cost share.

## Cash Burn Readiness

Future cash-burn reporting depends on station-level propagation.

Example:

```text
Conduit at Station 101
  -> station cost
  -> segment cost
  -> package cost
  -> budget candidate
  -> cash burn forecast
```

No cash-burn calculation is implemented in this phase.

