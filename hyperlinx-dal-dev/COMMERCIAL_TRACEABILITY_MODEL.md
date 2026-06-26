# Commercial Traceability Model

Every dollar in Hyperlinx must be traceable.

## Trace Path

```text
Corridor
  -> Takeoff
  -> Commercial Item
  -> Unit Cost
  -> Budget Line
  -> Budget
  -> Proposal
  -> Customer Fixture
```

## Current Traceability Fields

`ItemizedBudgetLine` includes:

- `commercialItemId`
- `sourceQuantity.sourceType`
- `sourceQuantity.sourceId`
- `sourceQuantity.field`
- `sourceQuantity.value`
- `sourceCorridor.centerlineRouteId`
- `sourceCorridor.stationedCorridorId`
- `sourceCorridor.takeoffId`
- `traceability[]`

## Boundary

Traceability does not create commercial authority. It proves where a development estimate came from.

