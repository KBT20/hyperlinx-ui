# Budget Comparison Model

Status: doctrine and contracts only.

## Purpose

Budget Comparison evaluates Budget Candidates against each other.

Comparison is advisory. It does not recommend awards or create locked budget authority.

## Supported Comparisons

The contract supports:

- `compareBudgetCandidates()`.
- `compareUnitPrices()`.
- `compareVendorCoverage()`.
- `compareSchedules()`.
- `compareCapacity()`.

## Candidate Comparison

Candidate comparison may identify:

- lowest cost candidate.
- highest confidence candidate.
- candidate ids.
- unit price variance.
- vendor coverage.
- schedule summary.
- capacity summary.

## Unit Price Comparison

Unit price comparison may compare:

- Estimate vs Candidate.
- Price Book vs Candidate.
- Candidate vs Locked Budget.

## Vendor Coverage

Vendor coverage comparison tracks:

- vendor id.
- coverage percent.
- response count.

Coverage is advisory and does not prove vendor eligibility or capacity.

## Schedule and Capacity

Schedule comparison may track shortest and longest response durations.

Capacity comparison preserves vendor-stated capacity summaries.

Neither creates delivery commitment.

## Diagnostics

Budget Comparison may emit:

- `BUDGET_COMPARISON_COMPLETE`.

