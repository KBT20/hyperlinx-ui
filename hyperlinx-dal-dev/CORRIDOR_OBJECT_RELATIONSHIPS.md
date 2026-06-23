# Corridor Object Relationships

Status: role relationship doctrine.

## Role Relevance

Objects matter differently depending on corridor role.

## Campus

High-relevance objects:

- `CONDUIT`
- `INNERDUCT`
- `FIBER`
- `FIBER_PAIR`
- `HANDHOLE`
- `VAULT`
- `DATA_CENTER`
- `MEET_ME_ROOM`
- `PARCEL`
- `DEVELOPMENT_SITE`
- `AGGREGATION_NODE`
- `POWER_FEED`
- `MAINTENANCE_ZONE`
- `RESTORATION_ZONE`

## Metro Aggregation

High-relevance objects:

- `LSO`
- `CO`
- `DATA_CENTER`
- `CARRIER_HOTEL`
- `IX`
- `CLOUD_ONRAMP`
- `WIRELESS_SITE`
- `PARCEL`
- `RIGHT_OF_WAY`
- `JURISDICTION`
- `CROSSING`
- `DUCT_OPPORTUNITY`
- `DARK_FIBER_OPPORTUNITY`

## MSA Interconnect

High-relevance objects:

- `CONDUIT`
- `FIBER`
- `SPLICE`
- `POP`
- `SUBSTATION`
- `TRANSMISSION_LINE`
- `RIGHT_OF_WAY`
- `JURISDICTION`
- `CROSSING`
- `PERMIT_ZONE`
- `RESTORATION_ZONE`
- `TRANSPORT_OPPORTUNITY`

## Backbone Interconnect

High-relevance objects:

- `REGEN_SITE`
- `ADM_SITE`
- `POP`
- `BACKBONE_NODE`
- `SUBSTATION`
- `TRANSMISSION_LINE`
- `GENERATION_SITE`
- `POWER_CORRIDOR`
- `CARRIER_HOTEL`
- `JURISDICTION`
- `RESTORATION_ZONE`
- `TRANSPORT_OPPORTUNITY`

## AI Fabric

High-relevance objects:

- `SUBSTATION`
- `TRANSMISSION_LINE`
- `GENERATION_SITE`
- `POWER_FEED`
- `POWER_CORRIDOR`
- `DATA_CENTER`
- `CLOUD_ONRAMP`
- `CARRIER_HOTEL`
- `IX`
- `PARCEL`
- `DEVELOPMENT_SITE`
- `BACKBONE_NODE`
- `EXPANSION_OPPORTUNITY`

## Regional Aggregation

High-relevance objects:

- `CONDUIT`
- `FIBER`
- `WIRELESS_SITE`
- `AGGREGATION_NODE`
- `RIGHT_OF_WAY`
- `UTILITY_EASEMENT`
- `JURISDICTION`
- `CROSSING`
- `RESTORATION_ZONE`
- `IRU_OPPORTUNITY`

## Interconnection

High-relevance objects:

- `DATA_CENTER`
- `CARRIER_HOTEL`
- `IX`
- `CLOUD_ONRAMP`
- `MEET_ME_ROOM`
- `INTERCONNECT_FACILITY`
- `POP`
- `VAULT`
- `FIBER_PAIR`
- `PARCEL`
- `JURISDICTION`
- `TRANSPORT_OPPORTUNITY`

## Implementation Reference

Use `listCorridorObjectsForRole(role)` in `src/corridor/CorridorObjectCatalog.ts` for catalog-role filtering.

