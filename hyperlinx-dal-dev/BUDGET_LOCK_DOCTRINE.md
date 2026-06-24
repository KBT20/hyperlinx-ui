# Budget Lock Doctrine

Status: doctrine and contracts only.

## Purpose

Budget Lock establishes commercial truth for a project budget.

It does not create vendor obligation, contract authority, or execution authority.

## Lock Doctrine

Budget Lock is the commercial counterpart to engineering approval.

It says:

- this candidate is commercially selected for budget truth.
- this total is the locked budget basis.
- this budget can be propagated into future budget reporting.

It does not say:

- a vendor is awarded.
- a contract exists.
- work may begin.

## Readiness Rules

A Budget Lock must have:

- Vendor Responses.
- Budget Candidate.
- Required Quantities.
- Required Categories.
- Required Objects.
- Required Standards.
- Engineering Approval Package.

## Lock Output

A Budget Lock should include:

- `budgetLockId`.
- `scopeVersionId`.
- `candidateId`.
- locked total cost.
- locked line item count.
- locked timestamp.
- engineering approval package id.
- assumptions.
- risks.
- diagnostics.

## Authority Boundary

Budget Lock establishes commercial truth.

Contract establishes obligation.

Control establishes execution.

Budget Lock does not create:

- awards.
- contracts.
- work packages.
- field execution authority.
- ScopeVersion lifecycle transitions.

## Diagnostics

Budget Lock may emit:

- `BUDGET_LOCK_READY`.
- `BUDGET_LOCK_CREATED`.

## ScopeVersion Close Authority Alignment

All authority resolves through ScopeVersion Close events.

Budget Lock establishes commercial truth only when validated through `BUDGET_CLOSE` against `scopeVersionId`.

Budget Lock does not create contract authority or execution authority without the required downstream closes.

## ScopeVersion Lifecycle Authority Alignment

Budget Lock may support the `BUDGET_LOCKED` lifecycle transition only when required commercial and budget closes are validated.

The lock object does not advance ScopeVersion lifecycle state by itself.

Lifecycle advancement remains governed by ScopeVersion Transition Authority.

## Contract and SOF Readiness Alignment

SOF and contract readiness may reference a Budget Lock only after `BUDGET_CLOSE` validates budget use against `scopeVersionId`.

Readiness does not create execution authority.

Contract execution creates `CONTRACT_CLOSE`.

Control activation follows `CONTRACT_CLOSE`.

## Control Activation Authority Alignment

Budget Lock does not create execution authority.

Contract execution creates legal obligation.

Control activation creates execution authority after `CONTRACT_CLOSE`.

Field activation requires Control authority.
