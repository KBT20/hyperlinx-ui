# Translate V1 Architecture

Status: first functional implementation.

## Doctrine

Translate ingests.

Translate normalizes.

Translate creates evidence bundles.

Translate does not create truth.

Route Engineering remains authoritative.

## Non-Goals

Translate V1 does not:

- create ScopeVersions.
- create authority.
- execute promotion.
- generate routes.
- score routes.
- persist evidence.
- call APIs.
- modify lifecycle, completion, closure, Control, Field, Twin, OI, or ScopeVersion execution contracts.

## Implementation Location

Translate V1 lives under:

- `src/translate/TranslateContract.ts`
- `src/translate/TranslateDiagnostic.ts`
- `src/translate/TranslateJob.ts`
- `src/translate/TranslateResult.ts`
- `src/translate/TranslateNormalizationEngine.ts`
- `src/translate/fixtures/translateV1Fixtures.ts`

## Pipeline

```text
Source file
  -> parser
  -> endpoint extraction
  -> route geometry extraction
  -> CorridorRawEvidenceInput[]
  -> CorridorNormalizationEngine
  -> CorridorEvidenceBundle
```

## Parsers

Translate V1 supports:

- CSV.
- GeoJSON.
- KML.
- KMZ.

Each parser emits:

- endpoint evidence.
- route candidate evidence.
- diagnostics.
- artifacts.
- evidence bundle.

## Diagnostics

Translate V1 emits:

- `[TRANSLATE_JOB_CREATED]`
- `[TRANSLATE_FILE_PARSED]`
- `[TRANSLATE_ENDPOINT_EXTRACTED]`
- `[TRANSLATE_ROUTE_EXTRACTED]`
- `[TRANSLATE_EVIDENCE_CREATED]`
- `[TRANSLATE_WARNING]`
- `[TRANSLATE_ERROR]`

Diagnostics are operational evidence, not authority.

## Authority Boundary

Translate output is normalized evidence only. Corridor Promotion may consume the evidence bundle. Route Engineering remains responsible for executable truth.

