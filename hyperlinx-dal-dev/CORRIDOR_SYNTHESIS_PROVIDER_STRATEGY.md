# Corridor Synthesis Provider Strategy

Status: future provider hooks only.

## Doctrine

External routing providers are evidence providers.

Providers do not create authority.

No provider is called in V1.

## V1 Provider Hooks

The engine exposes hooks for:

- OSRM.
- GraphHopper.
- OpenRouteService.
- Google Roads.
- DOT GIS.
- Internal Teralinx Models.

All hooks use:

```text
status = NOT_IMPLEMENTED
evidenceOnly = true
```

## Provider Rules

A future provider may:

- generate route evidence.
- enrich attributes.
- produce diagnostics.
- add candidate alternatives.

A future provider may not:

- overwrite customer geometry.
- create ScopeVersions.
- approve routes.
- promote candidates.
- activate work.

## Provenance

Every candidate must retain:

- source evidence IDs.
- provider sources.
- creation method.
- generated timestamp.
- diagnostics.

No candidate may lose evidence lineage.

