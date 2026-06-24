# Budget Candidate Doctrine

Status: doctrine and contracts only.

## Purpose

Budget Candidates convert vendor response evidence into comparable commercial budget options.

This phase does not award vendors, create contracts, authorize execution, or mutate ScopeVersion truth.

## Core Doctrine

Estimate is advisory.

Vendor Responses create Budget Candidates.

Budget Lock establishes commercial truth.

Contract establishes obligation.

Control establishes execution.

## Budget Candidate Inputs

A Budget Candidate may aggregate:

- vendor responses.
- unit prices.
- bid packages.
- station allocations.
- segment allocations.
- category allocations.
- objects.

## Candidate Fields

A Budget Candidate should include:

- `candidateId`.
- `scopeVersionId`.
- `vendorResponses`.
- `totalCost`.
- `lineItems`.
- `confidence`.
- `risks`.
- `assumptions`.
- `createdAt`.

## Candidate Boundary

A Budget Candidate is not:

- a vendor award.
- a contract.
- a purchase order.
- execution authority.
- a lifecycle transition.
- a ScopeVersion mutation.

It is a commercial evaluation object.

## Confidence

Budget confidence may be:

- `VERY_LOW`.
- `LOW`.
- `MEDIUM`.
- `HIGH`.
- `VERIFIED`.

Confidence is evidence quality, not approval authority.

## Diagnostics

Budget Candidate creation may emit:

- `BUDGET_CANDIDATE_CREATED`.

Diagnostics are development evidence only.

