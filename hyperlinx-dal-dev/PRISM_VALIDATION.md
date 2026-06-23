# Prism Corridor Scoring Validation

Status: doctrine validation only. No calculations are performed.

## Decision Hierarchy Requirement

Prism validation must evaluate candidates through ordered decision layers before any future flat ranking is considered.

Layer order:

1. `HARD_EXCLUSION`
2. `STRATEGIC_FIT`
3. `COMMERCIAL`
4. `ENGINEERING`
5. `OPTIMIZATION`

Scoring must occur within the hierarchy. Prism must not flatten all categories into a single weighted score and call that a recommendation.

## Dallas To Kansas City AI Corridor

Applicable categories:

- LATENCY.
- RELIABILITY.
- DIVERSITY.
- POWER.
- INTERCONNECTION.
- FUTURE_CAPACITY_EXPANSION.
- HYPERSCALER_ALIGNMENT.
- RESTORATION_COMPLEXITY.
- JURISDICTION_COMPLEXITY.

Likely profiles:

- GOOGLE_AI.
- AMAZON_AI.
- META_AI.
- ORACLE_AI.
- NEOCLOUD.
- LONG_HAUL.

## Metro Overbuild

Applicable categories:

- CONSTRUCTABILITY.
- INTERCONNECTION.
- MONETIZATION.
- COST.
- JURISDICTION_COMPLEXITY.
- OPERATIONAL_MAINTAINABILITY.
- RESIDUAL_ASSET_VALUE.

Likely profiles:

- METRO_OVERBUILD.
- DARK_FIBER.
- DUCT_SALE.

## Middle-Mile Route

Applicable categories:

- CONSTRUCTABILITY.
- COST.
- RELIABILITY.
- JURISDICTION_COMPLEXITY.
- RISK.
- MONETIZATION.
- OPERATIONAL_MAINTAINABILITY.

Likely profiles:

- MIDDLE_MILE.
- TRANSPORT.
- DARK_FIBER.

## Customer Supplied Route

Applicable categories:

- LATENCY.
- RELIABILITY.
- DIVERSITY.
- CONSTRUCTABILITY.
- COST.
- RISK.

Important doctrine:

- customer geometry is preserved.
- generated alternatives may be compared.
- Prism recommendations do not overwrite customer evidence.

## Long-Haul Transport Route

Applicable categories:

- LATENCY.
- RELIABILITY.
- RESTORATION_COMPLEXITY.
- OPERATIONAL_MAINTAINABILITY.
- DIVERSITY.
- JURISDICTION_COMPLEXITY.
- COST.

Likely profiles:

- LONG_HAUL.
- TRANSPORT.

## Validation Statement

This phase validates category applicability only. It does not calculate score values, rankings, recommendations, or ScopeVersion readiness.

## Enrichment Readiness

After Phase 6.2E, Prism should score `EnrichedCorridorCandidate` objects rather than raw corridor candidates when enrichment is available.

Prism should consume:

- enrichment findings.
- finding confidence.
- missing-category warnings.
- conflict warnings.
- enrichment summaries.

Prism still must not treat enrichment as authority. Enrichment prepares evidence for scoring; it does not score or promote.

## Hierarchy Readiness

Phase 6.2F adds `PrismDecisionHierarchy` as the constitutional decision contract.

Future Prism scoring should:

- apply hard exclusions first.
- evaluate strategic fit before commercial return.
- evaluate commercial potential before engineering optimization.
- evaluate engineering feasibility before route optimization.
- use optimization only to compare otherwise acceptable candidates.

Decision layers govern future recommendation behavior.
