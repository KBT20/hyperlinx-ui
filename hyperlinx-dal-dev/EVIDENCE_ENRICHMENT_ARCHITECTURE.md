# Evidence Enrichment Architecture

Status: read-only architecture and implementation contract.

## Objective

Evidence Enrichment organizes Translate evidence and provider evidence around corridor candidates so Prism can later score enriched candidates.

This phase does not call live provider APIs, implement routing, implement scoring, create ScopeVersions, promote corridors, persist data, or modify execution contracts.

## Constitutional Rule

Enrichment is not authority.

Provider evidence is not authority.

Enrichment never overwrites source evidence. Conflicting evidence is preserved and reported.

## Chain

```text
Translate Evidence
ProviderEvidenceResult[]
CorridorCandidate
CorridorClassificationResult
  -> EvidenceEnrichmentEngine
  -> EnrichedCorridorCandidate
  -> Prism Scoring
  -> Promotion Gate
  -> Route Engineering
```

## Implementation Reference

- `src/corridor/EnrichmentContract.ts`
- `src/corridor/EvidenceEnrichmentEngine.ts`
- `src/corridor/fixtures/enrichmentFixtures.ts`

## Non-Authority Boundary

The enrichment engine may produce findings, warnings, diagnostics, and summaries. It may not produce:

- scores.
- recommendations.
- ScopeVersions.
- Control work.
- Field closures.
- Twin state.
- lifecycle state.

