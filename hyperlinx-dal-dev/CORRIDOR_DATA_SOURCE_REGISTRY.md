# Corridor Data Source Registry

Status: doctrine and isolated source registry.

## Source Rule

All sources are evidence-only. No source is authoritative.

Authority remains inside the DAL kernel and Route Engineering approval path.

## Source Definitions

| Source | Default confidence | Geometry | Endpoints | Constraints | Crossings | Power | Interconnect |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| CUSTOMER_ROUTE | 82 | Yes | No | No | No | No | No |
| CUSTOMER_ENDPOINT | 80 | No | Yes | No | No | No | Yes |
| CSV | 58 | Yes | Yes | Yes | Yes | Yes | Yes |
| KML | 74 | Yes | Yes | Yes | Yes | No | Yes |
| KMZ | 74 | Yes | Yes | Yes | Yes | No | Yes |
| GEOJSON | 76 | Yes | Yes | Yes | Yes | No | Yes |
| SHAPEFILE | 80 | Yes | Yes | Yes | Yes | Yes | Yes |
| OSRM | 55 | Yes | No | No | No | No | No |
| GRAPHHOPPER | 60 | Yes | No | No | No | No | No |
| OPENROUTESERVICE | 60 | Yes | No | No | No | No | No |
| GOOGLE_ROADS | 65 | Yes | No | No | No | No | No |
| DOT_GIS | 82 | Yes | No | Yes | Yes | No | No |
| POWER_DATASET | 78 | Yes | No | Yes | No | Yes | No |
| PARCEL_DATASET | 72 | Yes | No | Yes | No | No | No |
| DATA_CENTER_DATASET | 74 | Yes | Yes | No | No | Yes | Yes |
| HUMAN_ENGINEERING | 92 | Yes | Yes | Yes | Yes | Yes | Yes |
| FIELD_VALIDATION | 95 | Yes | Yes | Yes | Yes | Yes | Yes |
| PERMIT_RECORD | 86 | No | No | Yes | Yes | No | No |
| UNKNOWN | 25 | Yes | Yes | Yes | Yes | Yes | Yes |

## Implementation Reference

`src/corridor/CorridorEvidenceRegistry.ts`

The registry intentionally uses `authorityLevel = EVIDENCE_ONLY` for every source.

