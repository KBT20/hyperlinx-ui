# Corridor Object Validation

Status: validation examples only.

Implementation reference:

- `src/corridor/CorridorObjectCatalog.ts`

## Example 1: Dallas-Kansas City Backbone Corridor

Objects present:

- `BACKBONE_NODE`
- `POP`
- `REGEN_SITE`
- `ADM_SITE`
- `TRANSMISSION_LINE`
- `SUBSTATION`
- `JURISDICTION`
- `CROSSING`
- `RESTORATION_ZONE`
- `TRANSPORT_OPPORTUNITY`

Role relevance:

- Strong for `BACKBONE_INTERCONNECT`.

Monetization relevance:

- transport revenue.
- dark fiber IRU.
- interconnection revenue at POP/carrier hotel endpoints.

Strategic relevance:

- backbone node and transport objects support longhaul network strategy.

## Example 2: West Texas AI Corridor

Objects present:

- `SUBSTATION`
- `TRANSMISSION_LINE`
- `GENERATION_SITE`
- `POWER_CORRIDOR`
- `DATA_CENTER`
- `PARCEL`
- `DEVELOPMENT_SITE`
- `CLOUD_ONRAMP`
- `EXPANSION_OPPORTUNITY`

Role relevance:

- Strong for `AI_FABRIC`.

Monetization relevance:

- AI expansion potential.
- transport revenue.
- future campus opportunity.

Strategic relevance:

- power and development objects support AI infrastructure planning.

## Example 3: Metro LSO Aggregation Network

Objects present:

- `LSO`
- `CO`
- `WIRELESS_SITE`
- `AGGREGATION_NODE`
- `CONDUIT`
- `FIBER`
- `PARCEL`
- `JURISDICTION`
- `DUCT_OPPORTUNITY`

Role relevance:

- Strong for `METRO_AGGREGATION`.

Monetization relevance:

- duct sale.
- dark fiber IRU.
- transport revenue.

Strategic relevance:

- LSO and aggregation nodes confirm the corridor is metro aggregation even if long in route miles.

## Example 4: Carrier Hotel Interconnection Corridor

Objects present:

- `CARRIER_HOTEL`
- `IX`
- `CLOUD_ONRAMP`
- `MEET_ME_ROOM`
- `INTERCONNECT_FACILITY`
- `FIBER_PAIR`
- `VAULT`
- `TRANSPORT_OPPORTUNITY`

Role relevance:

- Strong for `INTERCONNECTION`.

Monetization relevance:

- interconnection revenue.
- transport revenue.
- cross-connect adjacency.

Strategic relevance:

- interconnection density supports cloud, carrier, and enterprise handoff.

## Example 5: Data Center Expansion Corridor

Objects present:

- `DATA_CENTER`
- `SUBSTATION`
- `POWER_FEED`
- `PARCEL`
- `DEVELOPMENT_SITE`
- `UTILITY_EASEMENT`
- `EXPANSION_OPPORTUNITY`
- `FIBER`
- `CONDUIT`

Role relevance:

- Strong for `AI_FABRIC`, `CAMPUS`, or `REGIONAL_AGGREGATION` depending on geography.

Monetization relevance:

- AI expansion potential.
- future campus opportunity.
- transport and dark fiber revenue.

Strategic relevance:

- combined power, parcel, and data center objects indicate growth optionality.

## Validation Boundary

These examples validate catalog relevance only. They do not calculate scores, make recommendations, create routes, enrich provider data, persist data, or create ScopeVersions.

