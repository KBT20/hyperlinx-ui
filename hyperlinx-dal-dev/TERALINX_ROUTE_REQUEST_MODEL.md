# Teralinx Route Request Model

Phase: 6.9A

## Contract

Defined in:

- `src/teralinx/TeralinxRouteRequest.ts`

## Fields

`TeralinxRouteRequest` contains:

- `routeRequestId`
- `customer`
- `opportunity`
- `siteList`
- `intent`
- `protection`
- `product`
- `diagnostics`
- `blockers`
- `readiness`
- `estimatedMilesPlaceholder`

## Readiness

Readiness values:

- `READY_FOR_DESIGN`
- `BLOCKED`

## Non-Authority Flags

The request explicitly records:

- `fixtureOnly`
- `noPersistence`
- `noRouting`
- `noGeometry`
- `noScopeVersionCreation`
- `noInventoryMutation`

## Purpose

The request captures sales intent in a deterministic shape before any design, route generation, graph import, or ScopeVersion authority exists.
