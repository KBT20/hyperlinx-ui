# Corridor Network Role Model

Status: doctrine and type contract.

## Network Roles

| Role | Meaning |
| --- | --- |
| `CAMPUS` | Connects buildings, meet-me rooms, entrances, or internal facilities inside one campus or facility footprint. |
| `METRO_AGGREGATION` | Aggregates LSOs, carrier hotels, data centers, enterprise, wireless, municipal, or utility locations within one MSA. |
| `MSA_INTERCONNECT` | Connects one MSA to another MSA without necessarily functioning as a national backbone. |
| `BACKBONE_INTERCONNECT` | Connects regional POPs, carrier hotels, data centers, or longhaul transport hubs as backbone infrastructure. |
| `AI_FABRIC` | Connects AI compute, GPU, hyperscaler, neocloud, power-proximate, or interconnection-dense assets. |
| `REGIONAL_AGGREGATION` | Aggregates regional endpoints where one side may not be inside a clearly known MSA. |
| `INTERCONNECTION` | Provides handoff to carrier hotels, cloud on-ramps, IX nodes, meet-me rooms, or cross-connect environments. |

## MSA Relationship

MSA relationship is represented as:

- `SAME_MSA`
- `MSA_TO_MSA`
- `REGIONAL_TO_MSA`
- `INTERREGIONAL`
- `UNKNOWN`

MSA relationship is stronger classification evidence than mileage.

## Aggregation Function

Aggregation role is represented as:

- `LSO_AGGREGATION`
- `DATA_CENTER_AGGREGATION`
- `AI_COMPUTE_AGGREGATION`
- `REGIONAL_POP_AGGREGATION`
- `TRANSPORT_BACKBONE`
- `CAMPUS_DISTRIBUTION`
- `INTERCONNECTION_HANDOFF`
- `UNKNOWN`

## Implementation Reference

Type definitions:

- `src/corridor/corridorTypes.ts`

Read-only classifier:

- `src/corridor/CorridorClassificationEngine.ts`

