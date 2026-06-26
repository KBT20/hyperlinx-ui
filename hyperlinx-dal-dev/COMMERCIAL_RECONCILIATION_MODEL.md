# Commercial Reconciliation Model

Phase: 7.4E  
Scope: Bid Workspace commercial reconciliation

## Doctrine

Every financial value displayed in the Bid Workspace must originate from one selected-scope pricing summary.

The selected scope controls:

- Executive Bid Summary
- Hyperscaler Pricing Preview
- Fiber Summary
- OSP Segment Pricing
- ILA / Regen Pricing
- Budget Assumptions scope context
- Original vs Proposal commercial comparison
- Vendor Response Preview
- Submission/checklist scope where applicable

## Selected Scope

Supported scopes:

- Helium -> Muskogee
- Helium -> Stillwater
- Combined Award

Combined Award is its own pricing scope. If no combined-award adjustment is entered, the summary must state:

`No combined-award adjustment applied`

## Required Formula

```text
OSP Cost
  + ILA / Regen Cost
  + Other Explicit Cost Items
  = Budget Cost

Budget Cost
  + Markup / Points
  = Sell Price / IRU Price
```

## Implementation

The authoritative UI object is:

`SelectedScopePricingSummary`

Created by:

`createSelectedScopePricingSummary()`

The summary wraps:

- selected scope metadata
- `HyperscalerPricingResult`
- budget reconciliation
- sell-price reconciliation
- route metrics
- splicing formula output
- combined-award adjustment status

Panels should consume this object instead of independently summing financial totals.

