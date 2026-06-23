# Prism Weighting Profiles

Status: static profile definitions only. No scoring execution.

## Profiles

Defined profiles:

- GOOGLE_AI
- AMAZON_AI
- META_AI
- ORACLE_AI
- NEOCLOUD
- LONG_HAUL
- MIDDLE_MILE
- METRO_OVERBUILD
- TRANSPORT
- DARK_FIBER
- DUCT_SALE

## Profile Doctrine

Profiles define weight percentages only.

Profiles do not:

- calculate scores.
- rank candidates.
- create recommendations.
- create ScopeVersions.
- approve candidates.

## Profile Intent

| Profile | Intent |
| --- | --- |
| GOOGLE_AI | hyperscaler alignment, power, interconnection, reliability, diversity |
| AMAZON_AI | expansion, reliability, power, maintainability, future capacity |
| META_AI | diversity, reliability, power, interconnection, scaling |
| ORACLE_AI | cloud on-ramp, reliability, latency, power, scalable transport |
| NEOCLOUD | power, speed to deploy, interconnection, cost, expansion |
| LONG_HAUL | latency, restoration, jurisdiction burden, cost |
| MIDDLE_MILE | constructability, cost, reliability, monetization |
| METRO_OVERBUILD | interconnection density, constructability, monetization |
| TRANSPORT | reliability, latency, restoration, interconnection |
| DARK_FIBER | diversity, reliability, constructability, residual value |
| DUCT_SALE | constructability, residual duct value, cost, maintenance |

## Implementation Reference

`src/corridor/prismWeightingProfiles.ts`

Each profile returns a complete `Record<PrismScoreCategory, number>`.

