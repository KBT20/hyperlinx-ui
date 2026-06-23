# Corridor Evidence Pipeline

Status: doctrine only.

## Pipeline

```text
Raw Input
  -> Source Classification
  -> Normalized Evidence
  -> Confidence Scoring
  -> Conflict Detection
  -> Evidence Bundle
  -> Corridor Promotion
```

## Raw Inputs

Supported future input types:

- endpoint pairs.
- customer route files.
- KML.
- KMZ.
- GeoJSON.
- shapefile.
- CSV.
- hyperscaler corridor concepts.
- metro overbuild opportunities.
- long-haul corridor concepts.
- middle-mile concepts.
- AI infrastructure opportunities.

## Normalized Evidence

Every normalized evidence record should include:

- evidence ID.
- source type.
- source name.
- entity type.
- entity ID.
- confidence.
- collected timestamp.
- normalized payload.
- raw reference.
- geometry reference when present.
- notes.

## Evidence Bundle

The evidence bundle groups normalized evidence into:

- endpoints.
- routes.
- constraints.
- crossings.
- jurisdictions.
- power.
- interconnection.
- regen.
- monetization.

The bundle also contains conflicts. Conflict records are not resolutions.

## Diagnostics

The isolated engines emit:

- `[CORRIDOR_CONFIDENCE_SCORE]`
- `[CORRIDOR_EVIDENCE_CONFLICT]`
- `[CORRIDOR_EVIDENCE_VERIFIED]`

These diagnostics support development and review. They do not establish authority.

