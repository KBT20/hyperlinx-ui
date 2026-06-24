# Budget Variance Model

Status: doctrine and contracts only.

## Purpose

Budget Variance identifies differences between budget baselines and commercial candidates.

Variance prepares future executive review, budget locking, and actuals comparison.

## Supported Variance Types

Supported variance relationships:

- Estimated vs Candidate.
- Price Book vs Candidate.
- Candidate vs Locked Budget.

## Variance Fields

A Budget Variance should include:

- variance id.
- baseline label.
- comparison label.
- variance amount.
- variance percent.
- affected stations.
- affected segments.
- affected objects.

## Station and Segment Impact

Variance should preserve where budget differences occur.

Examples:

- Station-level splicing variance.
- Segment-level fiber placement variance.
- Object-level conduit variance.
- Category-level transport variance.

## Boundary

Variance is advisory.

It does not:

- reject a candidate.
- select a vendor.
- lock a budget.
- change a ScopeVersion.
- create execution authority.

## Diagnostics

Budget Variance may emit:

- `BUDGET_VARIANCE_CALCULATED`.

