# MAP_LAYER_ARCHITECTURE

Date: 2026-07-03

## Purpose

The map layer architecture gives Commercial, Engineering, ScopeVersion, Field, Twin, and OI a shared layer vocabulary and a cached visible projection.

## Registry

The shared registry is implemented in `src/mapkernel/MapLayerRegistry.ts` and includes:

- Spine Objects
- Stations
- Handholes
- Manholes
- Vaults
- Splice Cases
- ILAs
- Regens
- POPs
- Conduit
- Fiber
- Construction Segments
- Payment Segments
- Review Objects
- Engineering Deltas

## Projection

`buildCachedMapRenderProjection` creates one cached projection that returns:

- visible primitives,
- map metrics,
- render authority audit.

Hidden layers do not enter the visible projection. Station labels are gated by label visibility and density. Duplicate render authority is audited from the same primitive list that rendering consumes.

## Cache Key

The map projection cache key includes source identity, source revision metadata, layer visibility, station label style profile, and full primitive input hash.

