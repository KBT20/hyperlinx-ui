# Commercial Foundation Doctrine

Phase: 7.4A  
Scope: commercial foundation only. No final Budget Engine, no contract, no SOF, no Control handoff, no Field authority.

## Doctrine

Commercial values are derived values.

```text
Corridor
  -> Takeoff
  -> Commercial Item
  -> Unit Cost
  -> Budget Line
  -> Itemized Budget
  -> Proposal
  -> Customer Fixture
```

No commercial value may bypass this chain.

## Authority Rules

- Corridor geometry remains the geographic evidence source.
- CorridorTakeoff remains the quantity source.
- Commercial Foundation maps quantities into commercial items.
- Unit Cost Library provides representative development unit costs.
- Itemized Budget derives extended costs.
- Proposal consumes Itemized Budget.
- Budget Lock is future commercial truth and is not created in this phase.
- Contracts, SOFs, awards, Control, and Field remain out of scope.

## Non-Authority

The Commercial Foundation does not:

- create production pricing;
- create budget locks;
- create contracts;
- authorize execution;
- mutate ScopeVersion;
- mutate inventory;
- replace Marketplace execution.

## Current Implementation

The authoritative development unit-cost source is:

- `src/commercial/UnitCostLibrary.ts`

The commercial item catalog is:

- `src/commercial/CommercialItemCatalog.ts`

The quantity mapping is:

- `src/commercial/CommercialQuantityMapping.ts`

The itemized budget model is:

- `src/commercial/ItemizedBudget.ts`

The derivation helper is:

- `src/commercial/CommercialFoundationEngine.ts`

