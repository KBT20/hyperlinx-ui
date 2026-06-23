# Prism Scoring Categories

Status: doctrine and type contract.

## Decision Hierarchy Requirement

Prism scoring categories must operate inside the Prism Decision Hierarchy.

Prism must not flatten all categories into a single weighted score before applying decision precedence.

Layer order governs recommendation behavior:

1. Hard Exclusions.
2. Strategic Fit.
3. Commercial Potential.
4. Engineering Feasibility.
5. Optimization.

Weighted categories may support a layer in a future scoring engine, but lower-layer optimization can never rescue a corridor that fails a higher layer.

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

## Classification Context

Prism may consume corridor classification context as weighting evidence:

- `networkRole`
- `corridorClass`
- `msaRelationship`
- `aggregationRole`

Classification changes how evidence is interpreted. It does not replace category scoring, human review, or Route Engineering authority.

Examples:

- `METRO_AGGREGATION` emphasizes interconnection density, constructability, monetization, and maintainability.
- `AI_FABRIC` emphasizes power, interconnection, expansion, reliability, and diversity.
- `BACKBONE_INTERCONNECT` emphasizes latency, reliability, restoration, jurisdiction, and cost.
- `INTERCONNECTION` emphasizes carrier hotel, IX, cloud on-ramp, and handoff evidence.

## Enriched Candidate Readiness

Future Prism scoring should consume `EnrichedCorridorCandidate` when available.

Enrichment categories map naturally into Prism categories:

| Enrichment evidence | Prism category support |
| --- | --- |
| POWER, SUBSTATION, TRANSMISSION, GENERATION | POWER, HYPERSCALER_ALIGNMENT, FUTURE_CAPACITY_EXPANSION |
| DATA_CENTER, CARRIER_HOTEL, IX, CLOUD_ONRAMP, INTERCONNECTION | INTERCONNECTION, HYPERSCALER_ALIGNMENT |
| PARCEL, DEVELOPMENT_SITE | EXPANSION, CONSTRUCTABILITY, RISK |
| JURISDICTION, CROSSING, CONSTRAINT, UTILITY | CONSTRUCTABILITY, COST, RISK, JURISDICTION_COMPLEXITY |
| MONETIZATION | MONETIZATION, RESIDUAL_ASSET_VALUE |
| RESTORATION, MAINTENANCE | RESTORATION_COMPLEXITY, OPERATIONAL_MAINTAINABILITY |

Enrichment does not calculate Prism scores. It prepares evidence.

## Implementation Reference

`src/corridor/PrismScoringContract.ts`

Decision hierarchy contract:

`src/corridor/PrismDecisionHierarchy.ts`

Defines:

- `PrismScoreCategory`
- `PrismScoreComponent`
- `PrismCandidateScore`
- `PrismCandidateRecommendation`
- `PrismEvaluationResult`
