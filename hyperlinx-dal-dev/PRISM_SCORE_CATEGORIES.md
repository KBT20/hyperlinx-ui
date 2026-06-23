# Prism Score Categories

Status: Phase 6.3A executable scoring categories.

## Categories

| Category | Meaning |
| --- | --- |
| `INFRASTRUCTURE` | Strength of conduit, fiber, access structures, POPs, regen, ADM, and network assets |
| `POWER` | Strength of substations, transmission, generation, feeds, and power corridors |
| `INTERCONNECTION` | Strength of data centers, carrier hotels, IX, cloud on-ramps, meet-me rooms, and handoffs |
| `COMMERCIAL` | Monetization potential from duct, dark fiber, transport, IRU, expansion, and residual capacity |
| `AI` | AI fabric suitability from power, data centers, expansion, and interconnection objects |
| `STRATEGIC` | Alignment with corridor role, network function, and strategic facility objects |
| `ENGINEERING` | Constructability and operational feasibility, reduced by crossings, jurisdictions, constraints, and environmental burden |
| `OPTIMIZATION` | Optionality, scalability, restoration, maintenance, route flexibility, and future capacity |

## Category Output

Each category produces:

- 0-100 score.
- confidence.
- evidence count.
- warnings.
- supporting object references.
- evidence used.
- diagnostics.

## Boundary

Categories are scored observations. They are not recommendations.

