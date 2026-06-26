# Budget Assumption Set Doctrine

Phase: 7.4C  
Scope: `hyperlinx-dal-dev` commercial foundation only  
Status: implemented as DAL contracts, fixtures, and read-only presentation

## Doctrine

A Budget Assumption Set is the authoritative commercial object that explains why a budget is defensible before production pricing, contract authority, or Budget Lock exists.

A budget never owns its own assumptions. Every ItemizedBudget references exactly one versioned BudgetAssumptionSet through:

- `budgetAssumptionSetId`
- `budgetAssumptionSetVersion`

Budget lines inherit assumption references from the same set. This prevents proposal engines, customer fixtures, and bid workspaces from embedding untraceable commercial rules.

## Authority Boundary

Budget Assumption Sets are commercial evidence. They do not create:

- ScopeVersion authority
- inventory truth
- lifecycle transitions
- Marketplace execution
- Control authority
- Field authority
- Budget Lock
- contracts
- SOF

They support budget defensibility only.

## Commercial Chain

```text
Opportunity
  -> Corridor
  -> Takeoff
  -> Cost Breakdown Structure
  -> Budget Assumption Set
  -> Unit Cost Library
  -> Budget Cost
  -> Margin Strategy
  -> Proposal
  -> Customer Fixture
```

No commercial value should bypass this chain.

## Versioning

Assumption sets are versioned because commercial context changes over time:

- RFP assumptions change.
- Customer standards change.
- construction assumptions change.
- civil mix maturity changes.
- commodity and inflation assumptions change.
- engineering confidence changes.

Historical budgets must continue referencing the assumption set version used when they were created.

## Customer Reference Precedent

Google/Dobson reference materials are treated as reusable precedent, not platform doctrine. Read-only metadata review confirmed workbook/package structures for ILA rack-cost sensitivity, ILA locations, fiber summary, master OSP build metrics, and KMZ route artifacts. They inform categories such as ILA/regen assumptions, customer specifications, civil mix, testing, and acceptance requirements, but the default DAL assumption set remains customer-neutral.
