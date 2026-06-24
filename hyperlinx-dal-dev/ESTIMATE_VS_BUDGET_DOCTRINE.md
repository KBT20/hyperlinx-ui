# Estimate Vs Budget Doctrine

Estimate is not Budget.

Budget is not Contract.

Contract is not Execution.

## Estimate

An estimate is an advisory commercial planning artifact.

It may be created before engineering approval.

It may use assumptions.

It may carry low or medium confidence.

It cannot authorize spend.

It cannot create work.

## Budget

A budget is established later by Marketplace or a budget authority process.

Budget must be based on an approved ScopeVersion and reviewed cost basis.

Budget may not be inferred directly from a preliminary estimate.

## Contract

A contract creates commercial obligation only after:

- Engineering Approval
- Marketplace Budget Lock
- Commercial Approval

## Execution

Control executes work only after the execution authority chain exists.

Preliminary estimates do not create execution authority.

## ScopeVersion Close Authority Alignment

All authority resolves through ScopeVersion Close events.

Estimate remains advisory until validated commercial close authority exists.

Budget Lock becomes commercial truth only through `BUDGET_CLOSE` against `scopeVersionId`.

Contract authority requires `CONTRACT_CLOSE` against `scopeVersionId`.
