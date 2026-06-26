# Hyperscaler Pricing Engine Doctrine

Phase: 7.4D  
Scope: `hyperlinx-dal-dev` commercial foundation only  
Status: development seed, customer-neutral, non-authoritative

## Doctrine

The Hyperscaler Pricing Engine prices customer-facing fiber proposals using explicit cost-plus logic.

It calculates:

```text
Budget Cost
  -> Markup / Points
  -> Sell Price / IRU Price
```

Margin is never hidden inside cost.

## Architecture

```text
Route Segment
  -> OSP Unit Costs
  -> ILA / Regen Sites
  -> Fiber Summary
  -> Budget Cost
  -> Markup / Points
  -> Sell Price / IRU
  -> Customer Fixture Export
```

The engine consumes existing corridor takeoff evidence. It does not generate geometry, create ScopeVersions, mutate inventory, submit workbooks, or create execution authority.

## Reference Model

Google/Dobson proposal materials are used as reference structure:

- route segment pricing categories
- ILA / regen site cost categories
- route-level fiber summary requirements
- IRU cost-plus treatment
- workbook response expectations

The reference data is not production pricing.

## Rules

- OSP segment pricing must be itemized.
- ILA / regen pricing must be itemized.
- Budget cost and sell price must be separate.
- Points / markup must be explicit.
- Contingency must be explicit, configured, and visible.
- General Conditions are not permitted as unexplained buckets.
- Production approval, Budget Lock, contracts, and execution remain future phases.

