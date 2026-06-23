# Evidence Enrichment Validation

Status: fixture-backed validation report.

Implementation:

- `src/corridor/EnrichmentContract.ts`
- `src/corridor/EvidenceEnrichmentEngine.ts`
- `src/corridor/fixtures/enrichmentFixtures.ts`

## Enrichment Request Example

```text
Candidate: AI fabric corridor
Classification: AI_FABRIC
Provider results: substation, data center, cloud on-ramp, land ownership
Targets: power, substation, transmission, generation, data center, cloud on-ramp, IX, carrier hotel, parcel, development site, interconnection, expansion, monetization
```

## Target Category Selection Examples

| Fixture | Role | Target behavior |
| --- | --- | --- |
| Metro aggregation | `METRO_AGGREGATION` | Parcel, interconnection, utility, monetization, restoration, maintenance context |
| MSA interconnect | `MSA_INTERCONNECT` | Jurisdiction, crossing, power, transmission, restoration context |
| Backbone | `BACKBONE_INTERCONNECT` | Transmission, substation, generation, regen, maintenance context |
| AI fabric | `AI_FABRIC` | Power, compute, interconnection, parcel, development, expansion context |
| Interconnection | `INTERCONNECTION` | Carrier hotel, IX, cloud on-ramp, parcel, jurisdiction context |
| Conflict case | `METRO_AGGREGATION` | Preserves conflicting parcel ownership evidence |

## Provider Evidence Merge Example

Provider evidence:

```text
Provider: PARCEL_PROVIDER
Capabilities: PARCEL_LOOKUP, LAND_OWNERSHIP
Normalized value: parcel count and ownership mix
```

Enrichment findings:

```text
PARCEL
DEVELOPMENT_SITE
```

Provider ID, provider type, confidence, evidence IDs, and source result ID are preserved.

## Missing Category Warnings

If `AI_FABRIC` expects `TRANSMISSION` but no provider evidence maps to transmission, enrichment emits:

```text
[EVIDENCE_ENRICHMENT_MISSING_CATEGORY]
```

The candidate remains partial. No evidence is fabricated.

## Conflict Warning Example

If county parcel evidence says owner type is `Municipal` and municipal GIS says owner type is `Private Commercial`, enrichment emits:

```text
[EVIDENCE_ENRICHMENT_CONFLICT]
```

Both findings remain attached to the enriched candidate.

## Remaining Risks Before Live Provider Integration

- provider credentials.
- response bounds.
- provider-specific confidence models.
- rate limiting.
- raw response retention policy.
- server-side proxy design.
- provenance requirements for commercial datasets.

## Remaining Risks Before Prism Scoring

- category weight selection.
- finding confidence normalization.
- conflict impact on scoring.
- missing-category impact on scoring.
- human review thresholds.

