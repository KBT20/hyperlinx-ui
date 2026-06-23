# Provider Validation

Status: validation report for the adapter framework.

## What Exists

Provider framework files:

- `src/providers/ProviderContract.ts`
- `src/providers/ProviderAdapter.ts`
- `src/providers/ProviderRegistry.ts`
- `src/providers/adapters/StubProviderAdapter.ts`
- `src/providers/adapters/*ProviderAdapter.ts`
- `src/providers/fixtures/providerFixtures.ts`

## Provider Registration

The default registry includes registered, not-implemented providers for:

- OSRM
- GraphHopper
- OpenRouteService
- Google Roads
- DOT GIS
- County GIS
- Municipal GIS
- Utility GIS
- Substation datasets
- Transmission datasets
- Generation datasets
- Data centers
- Carrier hotels
- IX facilities
- Cloud on-ramps
- Parcels
- Land ownership
- Teralinx model

## Role Mapping Fixtures

Fixture examples:

| Fixture | Role | Expected behavior |
| --- | --- | --- |
| Metro corridor | `METRO_AGGREGATION` | Selects municipal, parcel, utility, data center, carrier hotel providers |
| MSA interconnect corridor | `MSA_INTERCONNECT` | Selects DOT, county, utility, transmission, routing providers |
| Backbone corridor | `BACKBONE_INTERCONNECT` | Selects DOT, transmission, generation, carrier hotel, Teralinx model providers |
| AI corridor | `AI_FABRIC` | Selects power, data center, carrier hotel, cloud on-ramp, parcel, Teralinx model providers |

## Diagnostics

Defined diagnostics:

- `[PROVIDER_REGISTERED]`
- `[PROVIDER_SELECTED]`
- `[PROVIDER_ROLE_MATCH]`
- `[PROVIDER_NOT_IMPLEMENTED]`
- `[PROVIDER_RESPONSE_NORMALIZED]`
- `[PROVIDER_WARNING]`
- `[PROVIDER_ERROR]`

## Evidence Normalization Flow

The stub adapters return diagnostics-only `ProviderEvidenceResult` objects. Live provider response normalization is deferred.

```text
Provider stub
  -> ProviderEvidenceResult
  -> EnrichmentFinding
  -> future CorridorNormalizedEvidence
  -> future CorridorEvidenceBundle
```

## Enrichment Handoff

Phase 6.2E adds a read-only enrichment layer that consumes provider evidence results and organizes them around corridor candidates.

Provider validation remains unchanged:

- no live provider calls.
- no enrichment execution from adapters.
- no ScopeVersion creation.
- no routing.

The enrichment layer is downstream of provider stubs and upstream of future Prism scoring.

## Known Limitations

- No live APIs are called.
- No enrichment is performed.
- No routing is performed.
- No provider credentials are modeled.
- No rate limiting is modeled.
- No server-side proxy is modeled.
- No ScopeVersions are created.

## Future Adapter Roadmap

Phase 6.2E: Evidence Enrichment Engine.

Phase 6.2F: Live Provider Integration.

Phase 6.3A: Prism Scoring Engine.
