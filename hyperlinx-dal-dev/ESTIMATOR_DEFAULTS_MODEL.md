# Estimator Defaults Model

Phase: 7.4G  
Scope: DAL sales estimator calibration.  
Runtime object: `src/commercial/EstimatorDefaults.ts`

## Purpose

`EstimatorDefaults` is the single development-only calibration object for the sales estimator.

It is not a production configuration system.
It is not a customer price book.
It is not contract authority.

## Default Values

| Area | Default |
| --- | --- |
| Base Dirt Bore | `$15 / LF` |
| Rock Adder | `+$30 / LF` |
| Reel Length | `26,000 ft` |
| Vault Slack | `150 ft` |
| Handhole Slack | `50 ft` |
| Fiber Waste | Development default |
| Conduit Waste | Development default |
| Innerduct Waste | Development default |
| Markup | Development default |
| Contingency | Development default |

## Usage Rule

Estimator calibration values should be referenced from `EstimatorDefaults` instead of being scattered through the pricing engine or UI.

Customer-specific commercial rules may be added later through governed commercial models. This phase only calibrates the DAL development estimator.

## Authority Boundary

`EstimatorDefaults` may influence advisory budgetary estimates produced by `SelectedScopePricingSummary`.

It does not:

- create budget locks;
- create contracts;
- create SOFs;
- authorize construction;
- mutate inventory;
- mutate ScopeVersions.
