# Provider Registry Doctrine

Status: doctrine and static registry contract.

## Constitutional Rule

The provider registry identifies available evidence sources. It does not execute providers, call APIs, enrich data, or create truth.

## Registry Behavior

The registry supports:

- `registerProvider()`
- `getProvider()`
- `listProviders()`
- `listProvidersByCapability()`
- `getProvidersForRole()`

Registration is read-only in practice: `registerProvider()` returns a new registry array and does not mutate the default registry.

## Provider Status

Provider status values:

- `REGISTERED`
- `AVAILABLE`
- `DISABLED`
- `NOT_IMPLEMENTED`
- `DEPRECATED`

Phase 6.2D providers are registered with `implementationStatus = NOT_IMPLEMENTED`.

## Role Mapping

Provider selection may use `CorridorNetworkRole`:

| Role | Preferred providers |
| --- | --- |
| `METRO_AGGREGATION` | Municipal GIS, parcel, utility GIS, data center, carrier hotel |
| `MSA_INTERCONNECT` | DOT GIS, county GIS, utility GIS, transmission, OSRM, GraphHopper |
| `BACKBONE_INTERCONNECT` | DOT GIS, transmission, generation, carrier hotel, Teralinx model |
| `AI_FABRIC` | Substation, transmission, generation, data center, carrier hotel, cloud on-ramp, parcel, Teralinx model |
| `REGIONAL_AGGREGATION` | County GIS, DOT GIS, utility GIS, parcel, transmission |
| `CAMPUS` | Municipal GIS, utility GIS, parcel, data center, Teralinx model |
| `INTERCONNECTION` | Carrier hotel, IX, cloud on-ramp, data center, parcel |

