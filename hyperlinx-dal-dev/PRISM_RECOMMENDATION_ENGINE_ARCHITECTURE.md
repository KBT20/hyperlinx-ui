# Prism Recommendation Engine Architecture

Prism Recommendation Engine V1 produces advisory recommendation packages from corridor evidence.

It does not create ScopeVersions, approve routes, persist results, call providers, create Control work, create Field work, route geometry, or modify kernel contracts.

## Inputs

The engine may consume:

- Corridor Lens
- Corridor Classification
- Reference Architecture Fit
- Corridor Design Standards
- Corridor Object Catalog
- Enriched Corridor Candidate
- Prism Scoring Result
- Prism Decision Hierarchy

## Outputs

The engine produces:

- advisory recommendation
- recommendation rationale
- suggested object package
- suggested product model
- human review blockers
- Route Engineering handoff draft

## Doctrine

Prism recommends.

Humans review.

Route Engineering approves.

ScopeVersion remains execution truth.

Sales may express intent.

Sales may not approve engineering truth.

Recommendation is not authority.

Human approval is required before any Route Engineering handoff can become executable.

## Contract Locations

Recommendation contracts:

`src/corridor/PrismRecommendationContract.ts`

Recommendation engine:

`src/corridor/PrismRecommendationEngine.ts`

Fixtures:

`src/corridor/fixtures/prismRecommendationFixtures.ts`
