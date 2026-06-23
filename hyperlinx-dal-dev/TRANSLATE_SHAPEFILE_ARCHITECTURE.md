# Translate Shapefile Architecture

Status: first functional shapefile ingestion engine.

## Doctrine

Shapefiles are evidence providers.

Customer shapefiles are preserved.

Conflicting geometry is preserved.

No shapefile becomes authoritative.

Human engineering review remains authoritative.

## Non-Goals

This phase does not:

- create ScopeVersions.
- create authority.
- create corridor candidates.
- score routes.
- persist evidence.
- call APIs.
- modify kernel lifecycle, completion, closure, Control, Field, Twin, OI, or ScopeVersion execution contracts.

## Implementation Files

- `src/translate/ShapefileContract.ts`
- `src/translate/CoordinateNormalization.ts`
- `src/translate/ShapefileTranslationEngine.ts`
- `src/translate/fixtures/shapefileFixtures.ts`

## Package Flow

```text
ShapefilePackage
  -> component validation
  -> coordinate system detection
  -> SHP geometry parse
  -> DBF attribute parse
  -> feature classification
  -> CorridorRawEvidenceInput[]
  -> CorridorEvidenceBundle
```

## Diagnostics

The shapefile engine emits:

- `[SHAPEFILE_PACKAGE_LOADED]`
- `[SHAPEFILE_MISSING_COMPONENT]`
- `[SHAPEFILE_LAYER_DISCOVERED]`
- `[SHAPEFILE_FEATURE_EXTRACTED]`
- `[SHAPEFILE_WARNING]`
- `[SHAPEFILE_ERROR]`

## Authority Boundary

The output is normalized evidence only. Route Engineering and human review remain the promotion and truth boundary.

