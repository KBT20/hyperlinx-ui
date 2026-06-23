# Prism Scoring Categories

Status: doctrine and type contract.

## Primary Categories

| Category | Measures |
| --- | --- |
| LATENCY | route distance, estimated RTT, optical reach assumptions, regeneration count |
| RELIABILITY | topology suitability, resiliency assumptions, restoration characteristics |
| DIVERSITY | shared ROW, road, crossings, structures, jurisdiction |
| CONSTRUCTABILITY | crossing count, permitting complexity, urban density, route accessibility |
| POWER | substation proximity, transmission proximity, future expansion potential, utility diversity |
| INTERCONNECTION | carrier hotels, IX proximity, cloud on-ramps, data center density |
| EXPANSION | developable land, corridor expansion opportunity, future AI campus suitability |
| MONETIZATION | duct sale, fiber IRU, transport, tower, enterprise, municipal opportunity |
| COST | build complexity, route length, crossing burden, permit burden |
| RISK | jurisdiction, environmental, permitting, restoration risk |

## Teralinx-Specific Categories

| Category | Measures |
| --- | --- |
| OPERATIONAL_MAINTAINABILITY | access, maintenance burden, restoration feasibility |
| RESTORATION_COMPLEXITY | crew access, fault isolation complexity, spare path assumptions |
| JURISDICTION_COMPLEXITY | authority count, permit diversity, coordination burden |
| RESIDUAL_ASSET_VALUE | unused ducts, unused fibers, future productization |
| FUTURE_CAPACITY_EXPANSION | growth potential, route scalability, optical scalability |
| HYPERSCALER_ALIGNMENT | AI corridor suitability, expansion, power, and interconnection suitability |

## Diversity Levels

Prism consumes diversity evidence using:

- `NONE`
- `PARTIAL`
- `SUBSTANTIAL`
- `FULL`

Diversity must be backed by evidence. Different geometry alone is not enough.

## Implementation Reference

`src/corridor/PrismScoringContract.ts`

Defines:

- `PrismScoreCategory`
- `PrismScoreComponent`
- `PrismCandidateScore`
- `PrismCandidateRecommendation`
- `PrismEvaluationResult`

