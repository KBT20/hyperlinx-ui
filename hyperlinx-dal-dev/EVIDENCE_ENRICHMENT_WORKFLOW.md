# Evidence Enrichment Workflow

Status: read-only workflow.

## Workflow

```text
CorridorCandidate
  -> CorridorClassificationResult
  -> createEnrichmentRequest()
  -> role-aware enrichment targets
  -> mergeProviderEvidence()
  -> EnrichmentFinding[]
  -> summarizeEnrichmentFindings()
  -> EnrichedCorridorCandidate
```

## Functions

- `createEnrichmentRequest()`
- `enrichCorridorCandidate()`
- `enrichCorridorCandidates()`
- `mergeProviderEvidence()`
- `summarizeEnrichmentFindings()`

All functions are read-only. They do not mutate input candidates.

## Diagnostics

The engine emits:

- `[EVIDENCE_ENRICHMENT_STARTED]`
- `[EVIDENCE_ENRICHMENT_TARGET_SELECTED]`
- `[EVIDENCE_ENRICHMENT_PROVIDER_EVIDENCE_MERGED]`
- `[EVIDENCE_ENRICHMENT_FINDING_CREATED]`
- `[EVIDENCE_ENRICHMENT_MISSING_CATEGORY]`
- `[EVIDENCE_ENRICHMENT_CONFLICT]`
- `[EVIDENCE_ENRICHMENT_COMPLETE]`
- `[EVIDENCE_ENRICHMENT_WARNING]`
- `[EVIDENCE_ENRICHMENT_ERROR]`

## Missing Evidence

When an expected target category has no evidence, enrichment produces a warning and preserves partial status. It does not fabricate evidence.

## Conflicting Evidence

When two provider findings conflict, enrichment preserves both findings, links them through `conflictsWithFindingIds`, lowers summary confidence, and emits a warning.

