# Provider Capability Model

Status: type contract.

## Capabilities

Provider capabilities describe what evidence a provider may eventually contribute:

- `ROUTING`
- `ROAD_SNAP`
- `ROUTE_GEOMETRY`
- `GIS_GEOMETRY`
- `CONSTRAINT_GEOMETRY`
- `CROSSING_DETECTION`
- `JURISDICTION_LOOKUP`
- `PARCEL_LOOKUP`
- `LAND_OWNERSHIP`
- `POWER_SUBSTATION`
- `POWER_TRANSMISSION`
- `POWER_GENERATION`
- `UTILITY_INFRASTRUCTURE`
- `INTERCONNECTION_LOOKUP`
- `DATA_CENTER_LOOKUP`
- `CARRIER_HOTEL_LOOKUP`
- `IX_LOOKUP`
- `CLOUD_ONRAMP_LOOKUP`
- `CORRIDOR_MODELING`
- `EVIDENCE_NORMALIZATION`

## Capability Boundary

Capabilities describe evidence potential only.

A provider with `ROUTING` may eventually produce route evidence. It does not create authoritative route geometry, ScopeVersions, work packages, closures, or Twin state.

## Future Extension

New provider capabilities should be additive and should not require architecture changes.

