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

## Phase 6.3A Executable Categories

Phase 6.3A introduces an advisory V1 category set:

- `INFRASTRUCTURE`
- `POWER`
- `INTERCONNECTION`
- `COMMERCIAL`
- `AI`
- `STRATEGIC`
- `ENGINEERING`
- `OPTIMIZATION`

These categories produce scored observations only. They do not produce recommendations or rankings.

## Lens-Driven Emphasis

Corridor Lenses determine which categories matter most for a given commercial or strategic view.

Examples:

- `HYPERSCALER`: POWER, INTERCONNECTION, AI, and STRATEGIC are high.
- `DUCT_MONETIZATION`: COMMERCIAL and INFRASTRUCTURE are high.
- `ENTERPRISE`: COMMERCIAL is high; INTERCONNECTION, INFRASTRUCTURE, and ENGINEERING are medium.
- `TRANSPORT`: OPTIMIZATION, STRATEGIC, and INTERCONNECTION are high.

The scoring category definitions do not change. Lens changes emphasis.

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

## Object-Driven Evaluation

Future Prism scoring should evaluate corridors through the objects they contain.

Canonical object definitions live in:

`src/corridor/CorridorObjectCatalog.ts`

Object evidence supports scoring categories:

| Object family | Prism category support |
| --- | --- |
| Infrastructure objects | RELIABILITY, CONSTRUCTABILITY, COST, RESIDUAL_ASSET_VALUE |
| Power objects | POWER, HYPERSCALER_ALIGNMENT, FUTURE_CAPACITY_EXPANSION |
| Interconnection objects | INTERCONNECTION, MONETIZATION, HYPERSCALER_ALIGNMENT |
| Property objects | EXPANSION, CONSTRUCTABILITY, RISK |
| Network objects | STRATEGIC_FIT context, RELIABILITY, MONETIZATION |
| Operational objects | CONSTRUCTABILITY, RISK, RESTORATION_COMPLEXITY, JURISDICTION_COMPLEXITY |
| Monetization objects | MONETIZATION, RESIDUAL_ASSET_VALUE |

Objects are evidence-backed. They do not create truth or recommendations.

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
## Corridor Design Standards Context

Prism scoring categories are lens-aware and standards-aware.

Lens determines which categories are emphasized.

Reference Architecture determines which components, tools, objects, and design standards must be considered.

Design standards determine the engineering requirements behind the scored evidence.

Examples:

- POWER scoring must not treat substation or transmission proximity as available capacity.
- INFRASTRUCTURE scoring must separate residual, committed, and sale-eligible capacity.
- ENGINEERING scoring must elevate crossings, jurisdictions, constraints, and unresolved review requirements.
- OPTIMIZATION scoring must not override Route Engineering review of topology, optical reach, regen placement, or ADM placement.

Recommendations remain future advisory output.

Route Engineering remains authoritative.
