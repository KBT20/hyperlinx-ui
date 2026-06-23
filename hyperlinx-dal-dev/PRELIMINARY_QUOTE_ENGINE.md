# Preliminary Quote Engine

The Preliminary Quote Engine creates advisory commercial estimates before Route Engineering approval.

It does not generate contracts.

It does not generate SOFs.

It does not generate ScopeVersions.

It does not approve engineering.

It does not establish budget.

## Inputs

The engine consumes advisory context:

- Corridor Lens
- Reference Architecture Fit
- Prism Product Plan
- Prism Object Population Plan
- Prism Recommendation Result
- Design Standards

## Outputs

The engine produces:

- PreliminaryQuote
- OpportunityPackage
- CommercialProductEstimate
- CommercialAssumption
- CommercialRisk
- CommercialConfidence

## Diagnostics

The engine emits:

- `[PRELIMINARY_QUOTE_STARTED]`
- `[PRODUCT_ESTIMATE_CREATED]`
- `[COMMERCIAL_RISK_IDENTIFIED]`
- `[COMMERCIAL_CONFIDENCE_CALCULATED]`
- `[OPPORTUNITY_PACKAGE_CREATED]`
- `[PRELIMINARY_QUOTE_COMPLETE]`

## Contract Locations

Contracts:

`src/commercial/PreliminaryQuote.ts`

`src/commercial/OpportunityPackage.ts`

Engine:

`src/commercial/PreliminaryQuoteEngine.ts`

Fixtures:

`src/commercial/fixtures/preliminaryQuoteFixtures.ts`

## Doctrine

Estimate is not Budget.

Budget is not Contract.

Contract is not Execution.

Sales may estimate.

Marketplace establishes budget.

Engineering approves design.

Contract creates obligation.

Control executes work.
