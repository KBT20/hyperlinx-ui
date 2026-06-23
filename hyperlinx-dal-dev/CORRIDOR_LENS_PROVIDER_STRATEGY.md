# Corridor Lens Provider Strategy

Status: provider strategy doctrine. No provider calls.

## Provider Selection Rule

Lenses select preferred provider categories. They do not execute providers.

## Hyperscaler

Preferred providers:

- `DATA_CENTER_PROVIDER`
- `SUBSTATION_PROVIDER`
- `TRANSMISSION_PROVIDER`
- `GENERATION_PROVIDER`
- `CLOUD_ONRAMP_PROVIDER`
- `CARRIER_HOTEL_PROVIDER`
- `PARCEL_PROVIDER`
- `LAND_PROVIDER`
- `DOT_GIS`

## Enterprise

Preferred providers:

- `PARCEL_PROVIDER`
- `MUNICIPAL_GIS`
- `COUNTY_GIS`
- `DATA_CENTER_PROVIDER`
- `CLOUD_ONRAMP_PROVIDER`
- `DOT_GIS`
- `ENTERPRISE_DATA_PROVIDER`
- `BUILDING_DATA_PROVIDER`

## Duct Monetization

Preferred providers:

- `PARCEL_PROVIDER`
- `MUNICIPAL_GIS`
- `COUNTY_GIS`
- `UTILITY_GIS`
- `WIRELESS_SITE_PROVIDER`
- `ENTERPRISE_DATA_PROVIDER`
- `TERALINX_MODEL`

## Transport

Preferred providers:

- `DATA_CENTER_PROVIDER`
- `CARRIER_HOTEL_PROVIDER`
- `IX_PROVIDER`
- `CLOUD_ONRAMP_PROVIDER`
- `DOT_GIS`
- `TERALINX_MODEL`

## Power / AI Expansion

Preferred providers:

- `SUBSTATION_PROVIDER`
- `TRANSMISSION_PROVIDER`
- `GENERATION_PROVIDER`
- `PARCEL_PROVIDER`
- `LAND_PROVIDER`
- `DATA_CENTER_PROVIDER`
- `UTILITY_GIS`

## Future Provider Rule

Some lens provider names are future provider types and are not yet registered provider adapters. Lens definitions may reference them as doctrine without executing them.

