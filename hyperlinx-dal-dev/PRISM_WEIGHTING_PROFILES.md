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

## Classification Alignment

Future Prism execution should select or adjust profiles using corridor classification context:

| Network role | Likely profile context |
| --- | --- |
| `METRO_AGGREGATION` | `METRO_OVERBUILD`, `DARK_FIBER`, `DUCT_SALE` |
| `MSA_INTERCONNECT` | `MIDDLE_MILE`, `TRANSPORT` |
| `BACKBONE_INTERCONNECT` | `LONG_HAUL`, `TRANSPORT` |
| `AI_FABRIC` | `GOOGLE_AI`, `AMAZON_AI`, `META_AI`, `ORACLE_AI`, `NEOCLOUD` |
| `CAMPUS` | future campus profile |
| `INTERCONNECTION` | `TRANSPORT`, future interconnection profile |

This is doctrine only. No scoring execution is added in this phase.

## Lens Alignment

Future Prism profile selection should consider:

1. Corridor Lens.
2. Network role.
3. Customer requirement.
4. Commercial product.

Examples:

- `HYPERSCALER` aligns with AI profiles and emphasizes power, interconnection, AI, and strategic categories.
- `DUCT_MONETIZATION` aligns with duct sale and residual value profiles and emphasizes commercial and infrastructure categories.
- `TRANSPORT` aligns with transport profiles and emphasizes optimization, strategic, and interconnection categories.
- `ENTERPRISE` aligns with commercial service profiles and emphasizes commercial, infrastructure, and engineering categories.

Lens definitions do not execute scoring. They define emphasis.

## Implementation Reference

`src/corridor/prismWeightingProfiles.ts`

Each profile returns a complete `Record<PrismScoreCategory, number>`.
