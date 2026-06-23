# Corridor Object Scoring Impact

Status: scoring impact doctrine only. No numeric scoring.

## Decision Layer Impact

Objects influence Prism decision layers:

- Strategic Fit.
- Commercial Potential.
- Engineering Feasibility.
- Optimization.

Objects may also trigger future Hard Exclusions when evidence proves a blocking condition.

## Lens-Driven Impact

The same object can carry different importance under different lenses.

Examples:

- `SUBSTATION` is high impact under `HYPERSCALER`, `NEOCLOUD`, and `POWER_AI_EXPANSION`.
- `SUBSTATION` is low or contextual under `DUCT_MONETIZATION`.
- `CONDUIT` is high commercial impact under `DUCT_MONETIZATION`.
- `CONDUIT` is infrastructure support under `TRANSPORT`.
- `CARRIER_HOTEL` is strategic under `INTERCONNECTION`, commercial under `TRANSPORT`, and contextual under `ENTERPRISE`.

The lens changes scoring emphasis. It does not change object truth.

## Positive Strategic Signals

| Object | Impact |
| --- | --- |
| `SUBSTATION` | Supports AI fabric and power-aware expansion fit |
| `TRANSMISSION_LINE` | Supports AI fabric and power corridor strategy |
| `DATA_CENTER` | Supports AI, interconnection, and commercial demand |
| `IX` | Supports interconnection and strategic network density |
| `CLOUD_ONRAMP` | Supports hyperscaler and enterprise interconnection strategy |
| `CARRIER_HOTEL` | Supports backbone, metro, and interconnection strategy |
| `LSO` | Supports metro aggregation strategy |
| `BACKBONE_NODE` | Supports backbone and transport strategy |

## Commercial Signals

| Object | Impact |
| --- | --- |
| `CONDUIT` | Duct sale and residual capacity potential |
| `FIBER` | Dark fiber IRU and transport potential |
| `FIBER_PAIR` | Assignable service inventory |
| `DATA_CENTER` | Transport and interconnection revenue |
| `CARRIER_HOTEL` | Cross-connect and transport revenue |
| `DUCT_OPPORTUNITY` | Direct duct monetization |
| `DARK_FIBER_OPPORTUNITY` | IRU monetization |
| `TRANSPORT_OPPORTUNITY` | Recurring revenue potential |
| `EXPANSION_OPPORTUNITY` | Future commercial upside |

## Engineering Penalties

| Object | Impact |
| --- | --- |
| `CROSSING` | Can reduce engineering feasibility |
| `JURISDICTION` | Can increase permitting burden |
| `CONSTRAINT` | Can increase cost, risk, or uncertainty |
| `ENVIRONMENTAL_AREA` | Can trigger hard exclusion or review |
| `PERMIT_ZONE` | Can increase schedule and approval risk |
| `UTILITY_EASEMENT` | Can improve feasibility or create access constraints |

## Optimization Signals

| Object | Impact |
| --- | --- |
| `RESTORATION_ZONE` | Affects restoration complexity |
| `MAINTENANCE_ZONE` | Affects maintainability |
| `ADM_SITE` | Affects transport flexibility |
| `REGEN_SITE` | Affects optical feasibility and route cost |
| `POP` | Affects network handoff and route optionality |

## Doctrine

No object has a numeric score in this phase.

Object scoring impact exists so future Prism scoring can reason about why a corridor is strategically strong, commercially attractive, engineering-difficult, or optimization-favorable.
## Design Standards Context

Object scoring impact is advisory unless the applicable design standards are understood.

Examples:

- REGEN_SITE may improve transport value, but regen spacing and optical reach require Route Engineering review.
- CONDUIT may improve commercial potential, but sale-eligible duct and residual capacity must be tracked separately.
- SUBSTATION may improve power context, but available capacity is not assumed from proximity.
- CROSSING may increase engineering risk and requires owner, method, permit, cost, and schedule evidence.

Lens determines scoring emphasis.

Design standards determine object requirements.

Route Engineering remains authority.
