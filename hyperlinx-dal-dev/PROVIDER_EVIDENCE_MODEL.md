# Provider Evidence Model

Status: doctrine and normalization boundary.

## Evidence Boundary

Provider output must normalize into corridor evidence.

```text
Provider
  -> ProviderEvidenceResult
  -> EnrichmentFinding
  -> CorridorNormalizedEvidence
  -> CorridorEvidenceBundle
```

Provider output may contribute:

- geometry.
- power signals.
- parcel signals.
- substation signals.
- transmission signals.
- interconnection signals.
- route candidate evidence.
- constraints.
- crossings.
- jurisdictions.

## Forbidden Direct Outputs

Providers may never directly create:

- `ScopeVersion`
- Control work
- Field closure
- Twin state
- lifecycle state
- execution authority

## Provenance

Every `ProviderEvidenceResult` must preserve:

- provider ID.
- provider type.
- capabilities.
- confidence.
- evidence IDs.
- diagnostics.
- normalized value.

Raw provider responses are optional and should be bounded when live integrations are implemented.

## Enrichment Boundary

Evidence Enrichment consumes `ProviderEvidenceResult[]` and produces `EnrichmentFinding[]` for corridor candidates.

Provider evidence remains provider evidence. Enrichment organizes it by category, preserves provenance, flags missing categories, and flags conflicts. It does not score, route, promote, persist, or create ScopeVersions.

Implementation reference:

- `src/corridor/EnrichmentContract.ts`
- `src/corridor/EvidenceEnrichmentEngine.ts`
