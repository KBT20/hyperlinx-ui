# Corridor Classification Validation

Status: fixture-backed validation report.

Implementation fixtures:

- `src/corridor/fixtures/corridorClassificationFixtures.ts`

Classifier:

- `src/corridor/CorridorClassificationEngine.ts`

## Fixture Matrix

| Input | Inferred role | Inferred class | MSA relationship | Aggregation | Confidence | Warnings |
| --- | --- | --- | --- | --- | --- | --- |
| 165-mile 12-duct 26 LSO single-MSA metro | `METRO_AGGREGATION` | `METRO` | `SAME_MSA` | `LSO_AGGREGATION` | High | `DISTANCE_ADVISORY_ONLY_SINGLE_MSA_METRO_PRESERVED` |
| Dallas to Fort Worth MSA interconnect | `MSA_INTERCONNECT` | `MIDDLE_MILE` | `MSA_TO_MSA` | `UNKNOWN` | High | None expected |
| Dallas to Kansas City backbone | `BACKBONE_INTERCONNECT` | `LONGHAUL` | `MSA_TO_MSA` | `TRANSPORT_BACKBONE` | High | None expected |
| West Texas data center footprint to Dallas AI/middle-mile | `AI_FABRIC` | `AI_CORRIDOR` | `MSA_TO_MSA` | `AI_COMPUTE_AGGREGATION` | High | None expected |
| Campus data center building interconnect | `CAMPUS` | `CAMPUS` | `SAME_MSA` | `CAMPUS_DISTRIBUTION` | High | None expected |
| Cloud on-ramp / carrier hotel interconnection | `INTERCONNECTION` | `INTERCONNECTION` | `SAME_MSA` | `INTERCONNECTION_HANDOFF` | High | None expected |

## Why Distance Does Not Control

Distance is treated as supporting evidence. It can trigger warnings when a route is long, but it cannot override network purpose.

The 165-mile, 26-LSO fixture remains metro because:

- A and Z endpoints are in the same MSA.
- the object evidence contains 26 LSOs.
- the service intent is local aggregation.
- the aggregation function is LSO aggregation.

## Validation Boundary

This phase does not validate routing, Prism scoring, promotion, persistence, ScopeVersion creation, or execution.
