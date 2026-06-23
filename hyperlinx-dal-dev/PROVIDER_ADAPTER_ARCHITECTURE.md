# Provider Adapter Architecture

Status: architecture only. No live provider execution.

## Objective

The Provider Adapter Framework defines how external routing, GIS, power, parcel, interconnection, and infrastructure datasets can attach to the corridor ecosystem as evidence providers.

Providers are not authority. Provider output is evidence.

## Constitutional Rule

Provider output may support corridor evidence, Prism scoring, and human engineering review. Provider output may not directly create:

- ScopeVersions.
- Control work.
- Field closures.
- Twin state.
- lifecycle state.
- kernel authority.

## Adapter Chain

```text
Provider Adapter
  -> ProviderRequest
  -> ProviderResponse
  -> ProviderEvidenceResult
  -> CorridorNormalizedEvidence
  -> CorridorEvidenceBundle
  -> Human Review / Prism / Promotion Gate
```

This phase implements contracts, registry metadata, role selection, stubs, and fixtures only.

## Provider Families

| Family | Provider examples |
| --- | --- |
| Routing | OSRM, GraphHopper, OpenRouteService, Google Roads |
| Infrastructure | DOT GIS, County GIS, Municipal GIS, Utility GIS |
| Power | Substation, transmission, generation datasets |
| Interconnection | Data centers, carrier hotels, IX, cloud on-ramps |
| Property | Parcels, land ownership, development sites |
| Internal | Teralinx model providers |

## Implementation Reference

- `src/providers/ProviderContract.ts`
- `src/providers/ProviderAdapter.ts`
- `src/providers/ProviderRegistry.ts`
- `src/providers/adapters/*ProviderAdapter.ts`
- `src/providers/fixtures/providerFixtures.ts`

