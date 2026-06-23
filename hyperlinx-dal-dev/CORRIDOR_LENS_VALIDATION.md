# Corridor Lens Validation

Status: fixture-backed validation report.

Implementation:

- `src/corridor/CorridorLens.ts`
- `src/corridor/CorridorLensRegistry.ts`
- `src/corridor/fixtures/corridorLensFixtures.ts`

## Lens Selection Examples

Fixtures include:

1. Dallas to Kansas City under `HYPERSCALER`.
2. Dallas to Kansas City under `TRANSPORT`.
3. Dallas to Kansas City under `DUCT_MONETIZATION`.
4. Metro LSO aggregation under `ENTERPRISE`.
5. West Texas AI corridor under `POWER_AI_EXPANSION`.

## Same Corridor / Different Lens

The Dallas to Kansas City corridor does not change.

Under `HYPERSCALER`, power, AI, data center, cloud, land, and expansion objects are prioritized.

Under `TRANSPORT`, POPs, backbone nodes, regen, ADM, carrier hotel, IX, and cloud on-ramp objects are prioritized.

Under `DUCT_MONETIZATION`, conduit, innerduct, ROW, parcel, wireless, municipal, ISP/WISP, and duct opportunity objects are prioritized.

## Object Priority Differences

Example:

- `SUBSTATION` is primary for `HYPERSCALER` and `POWER_AI_EXPANSION`.
- `SUBSTATION` is low or contextual for `DUCT_MONETIZATION`.
- `CONDUIT` is primary for `DUCT_MONETIZATION`.
- `CONDUIT` is still important but not the primary strategic object for `INTERCONNECTION`.

## Provider Priority Differences

Example:

- `HYPERSCALER` prioritizes data center, substation, transmission, generation, cloud, carrier hotel, parcel, land, and DOT providers.
- `TRANSPORT` prioritizes data center, carrier hotel, IX, cloud on-ramp, DOT, and Teralinx model providers.
- `DUCT_MONETIZATION` prioritizes parcel, municipal, county, utility, wireless, enterprise, and Teralinx providers.

## Scoring Priority Differences

Example:

- `HYPERSCALER`: POWER, INTERCONNECTION, AI, and STRATEGIC are high.
- `TRANSPORT`: OPTIMIZATION, STRATEGIC, and INTERCONNECTION are high.
- `DUCT_MONETIZATION`: COMMERCIAL and INFRASTRUCTURE are high.

## Remaining Risks Before Prism Recommendation Engine

- recommendation policy per lens.
- conflict escalation per lens.
- commercial threshold per lens.
- scoring-profile selection strategy.
- human review thresholds.
- provider readiness for future objects and future providers.

## Validation Boundary

Lenses do not score, recommend, call providers, persist state, create ScopeVersions, or modify corridor truth.

