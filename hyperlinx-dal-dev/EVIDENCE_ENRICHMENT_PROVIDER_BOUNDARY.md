# Evidence Enrichment Provider Boundary

Status: provider boundary doctrine.

## Provider Boundary

Provider adapters may produce `ProviderEvidenceResult`.

Evidence Enrichment may transform provider results into `EnrichmentFinding`.

Neither provider adapters nor enrichment may create truth.

## Boundary Flow

```text
Provider
  -> ProviderEvidenceResult
  -> EnrichmentFinding
  -> EnrichedCorridorCandidate
  -> future Prism scoring
```

## Preservation Rules

Every enrichment finding preserves:

- provider ID.
- provider type.
- source provider result ID.
- confidence.
- evidence IDs.
- normalized value.
- conflict links.

## Forbidden Behavior

The enrichment layer may not:

- call provider APIs.
- resolve conflicts automatically.
- discard Translate evidence.
- discard provider evidence.
- persist enriched candidates.
- create ScopeVersions.
- create scores.
- route geometry.

