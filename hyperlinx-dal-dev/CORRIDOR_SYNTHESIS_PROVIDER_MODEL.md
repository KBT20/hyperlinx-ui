# Corridor Synthesis Provider Model

Status: doctrine only.

## Provider Doctrine

Providers generate evidence.

Providers do not create authority.

Provider output is never executable truth until it is promoted, reviewed, and approved through Route Engineering.

## Future Providers

| Provider | Purpose | Authority |
| --- | --- | --- |
| OSRM | Road-following route evidence | Evidence only |
| GraphHopper | Road or multimodal route evidence | Evidence only |
| OpenRouteService | Route and isochrone evidence | Evidence only |
| Google Roads | Road snap and route evidence | Evidence only |
| DOT GIS | State/local route, crossing, and jurisdiction evidence | Evidence only |
| Customer Geometry | Customer route intent evidence | Evidence only, preserved |
| Human Engineered | Human-designed route evidence | Evidence only until Route Engineering approval |
| Internal Teralinx Models | Teralinx-generated candidate evidence | Evidence only |

## Provider Contract

A provider definition should include:

- provider ID.
- provider type.
- display name.
- supported input types.
- candidate types.
- whether it produces geometry.
- whether it produces attributes.
- notes.

## Provider Rules

- A provider may propose a candidate.
- A provider may enrich a candidate.
- A provider may emit diagnostics.
- A provider may not overwrite customer geometry.
- A provider may not save ScopeVersions.
- A provider may not approve candidates.
- A provider may not activate execution.

## Provenance

Every provider-generated candidate must retain:

- provider ID.
- input IDs.
- source evidence IDs.
- generation timestamp.
- diagnostics.

