# Teralinx Site Model

Phase: 6.9A

## Contract

Defined in:

- `src/teralinx/TeralinxRouteRequest.ts`

## Site Roles

Supported roles:

- `A_SITE`
- `Z_SITE`
- `INTERMEDIATE_SITE`

## Site Fields

Each site supports:

- `siteId`
- `role`
- `facilityName`
- `address`
- `latitude`
- `longitude`

## Validation

A site is usable when it includes either:

- An address
- Latitude and longitude

No geocoding occurs in this phase.

## Doctrine

Sites are route request endpoints and waypoints. They are not graph nodes, stations, ScopeVersion objects, or certified geometry.
