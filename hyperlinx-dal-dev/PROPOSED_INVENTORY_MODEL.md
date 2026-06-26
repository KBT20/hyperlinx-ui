# Proposed Inventory Model

`ProposedInventory` includes:

- `proposalId`
- `customerId`
- `opportunityId`
- `routeRequestId`
- `networkType`
- `protection`
- `primaryProduct`
- `estimatedMileage`
- `estimatedSegments`
- `estimatedStations`
- `estimatedCrossings`
- `estimatedVaults`
- `estimatedFiberFeet`
- `estimatedDuctFeet`
- `estimatedConstructionType`
- `generatedAt`

All fields are read-only estimates.

## Non-Authority Flags

The model explicitly marks:

- `noInventoryCreation`
- `noScopeVersionCreation`
- `noGraphMutation`

These flags document that Proposed Inventory is not constitutional truth.
