# ProposedGraph View Model

The canonical `ProposedGraph` view model contains:

- `proposedGraphId`
- `proposalId`
- `customerId`
- `opportunityId`
- `routeRequestId`
- `networkType`
- `protection`
- `primaryProduct`
- `nodes`
- `segments`
- `annotations`
- `estimatedMileage`
- `estimatedStations`
- `estimatedCrossings`
- `estimatedVaults`
- `estimatedFiberFeet`
- `estimatedDuctFeet`
- `readiness`
- `diagnostics`

All model data is read-only.

## Nodes

Supported node types:

- `A_SITE`
- `Z_SITE`
- `INTERMEDIATE_SITE`
- `VAULT`
- `REGENERATION_SITE`

## Segments

Edges contain fixture-provided display coordinates. They are not calculated by the visualization workspace.

## Selection

Customer Review Mode supports selecting nodes and segments for inspection only.
