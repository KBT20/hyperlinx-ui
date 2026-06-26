# Assumption Traceability Model

Phase: 7.4C  
Scope: Commercial traceability only

## Principle

Every dollar must be traceable from corridor evidence through assumptions and unit costs.

```text
Corridor
  -> Takeoff
  -> Cost Breakdown Structure
  -> Budget Assumption Set
  -> Commercial Item
  -> Unit Cost
  -> Budget Line
  -> Budget
  -> Proposal
  -> Customer Fixture
```

## Budget Trace Fields

`ItemizedBudget` now records:

- `budgetAssumptionSetId`
- `budgetAssumptionSetVersion`
- `unitCostLibraryVersion`
- `sourceCorridor`
- `lines`

Each `ItemizedBudgetLine` records:

- `assumptionSetId`
- `assumptionIds`
- `commercialItemId`
- `sourceQuantity`
- `sourceCorridor`
- `unitCost`
- `extendedCost`
- `traceability`

## Trace Engine

`BudgetAssumptionEngine` can produce category and line traces:

- source takeoff quantity
- CBS category
- assumption set
- assumption IDs
- commercial item / unit-cost item
- confidence score
- explanation

## Rule

Proposal engines may display budget values, but they may not create hidden commercial assumptions. Assumptions must originate from a versioned BudgetAssumptionSet.

