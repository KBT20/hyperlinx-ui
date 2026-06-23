# Evidence Enrichment Categories

Status: type contract.

## Categories

Defined enrichment categories:

- `POWER`
- `SUBSTATION`
- `TRANSMISSION`
- `GENERATION`
- `DATA_CENTER`
- `CARRIER_HOTEL`
- `IX`
- `CLOUD_ONRAMP`
- `PARCEL`
- `DEVELOPMENT_SITE`
- `JURISDICTION`
- `CROSSING`
- `CONSTRAINT`
- `UTILITY`
- `MONETIZATION`
- `RESTORATION`
- `MAINTENANCE`
- `INTERCONNECTION`
- `REGEN`
- `EXPANSION`

`REGEN` and `EXPANSION` are included because backbone and AI fabric evaluation need regeneration and expansion evidence before Prism scoring.

## Statuses

Enrichment status values:

- `NOT_STARTED`
- `REQUESTED`
- `EVIDENCE_AVAILABLE`
- `ENRICHED`
- `PARTIAL`
- `FAILED`
- `NOT_AVAILABLE`

## Role-Aware Target Selection

| Network role | Target categories |
| --- | --- |
| `METRO_AGGREGATION` | Parcel, development site, jurisdiction, crossing, utility, interconnection, monetization, restoration, maintenance |
| `MSA_INTERCONNECT` | Jurisdiction, crossing, power, substation, transmission, utility, restoration, monetization |
| `BACKBONE_INTERCONNECT` | Transmission, substation, generation, regen, jurisdiction, crossing, restoration, maintenance |
| `AI_FABRIC` | Power, substation, transmission, generation, data center, cloud on-ramp, IX, carrier hotel, parcel, development site, interconnection, expansion, monetization |
| `INTERCONNECTION` | Data center, carrier hotel, IX, cloud on-ramp, interconnection, parcel, jurisdiction |
| `CAMPUS` | Parcel, development site, utility, interconnection, maintenance, restoration |
| `REGIONAL_AGGREGATION` | Jurisdiction, crossing, utility, parcel, transmission, restoration, monetization |

