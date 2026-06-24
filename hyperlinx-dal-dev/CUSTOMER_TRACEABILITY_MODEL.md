# Customer Traceability Model

Every operational object should be traceable upward.

## Traceability Chain

Field Closure

to

Work Item

to

ScopeVersion

to

Corridor

to

Opportunity

to

Customer

## No Orphan Execution

No Field Closure should exist without a Work Item.

No Work Item should exist without a ScopeVersion.

No ScopeVersion should exist without a Corridor.

No Corridor should exist without an Opportunity.

No Opportunity should exist without a Customer.

## Marketplace Traceability

Marketplace budget records should trace to:

- customerId
- opportunityId
- scopeVersionId

## Contract Traceability

Contracts should trace to:

- customerId
- opportunityId
- scopeVersionId
- budgetId

Contracts do not attach directly to corridors.

## Control Traceability

Control receives only approved execution truth:

- customerId
- opportunityId
- scopeVersionId
- budgetId
- contractId

## Field Traceability

Field receives:

- customerId
- opportunityId
- scopeVersionId
- workItems

Field closure is operational evidence against ScopeVersion truth.

## ScopeVersion Close Authority Alignment

All authority resolves through ScopeVersion Close events.

Customer, opportunity, corridor, contract, marketplace, Control, and Field records remain traceability evidence until a validated close exists against `scopeVersionId`.

No customer-facing authority may be inferred from an orphan close or a close without ScopeVersion traceability.

## ScopeVersion Lifecycle Authority Alignment

Customer traceability is required evidence for lifecycle governance.

Customer acceptance, contract execution, Control activation, Field execution, completion, and operations must remain traceable to the same `scopeVersionId`.

No customer-facing lifecycle state may be inferred from a workspace-local record, recommendation, quote, or contract artifact without ScopeVersion Transition Authority.

## Contract and SOF Readiness Alignment

SOF and contract readiness must preserve the customer traceability chain.

Readiness depends on ScopeVersion Close Authority and Lifecycle Authority.

Readiness is not execution and does not create legal obligation.

Contract execution creates `CONTRACT_CLOSE`.

Control activation follows `CONTRACT_CLOSE`.
# Opportunity Intake Traceability

Opportunity Intake must preserve `customerId` and `opportunityId` in every Opportunity Package Candidate.

```text
Customer
  -> Opportunity Intake
  -> Translate
  -> Scope Review
  -> Prism
  -> Corridor
  -> ScopeVersion
```

`corridorId` and `scopeVersionId` remain placeholders during intake and may only be populated by later constitutional stages.

## Customer Workspace and Opportunity Launch Traceability

Customer Workspace is the business entry point.

Opportunity Launch initiates Translate.

Translate does not own customer creation.

Translate does not own opportunity creation.

Opportunity Launch must preserve:

- `customerId`
- `opportunityId`
- selected `networkType`
- selected `protectionSchema`

```text
Customer
  -> Customer Workspace
  -> Opportunity
  -> Opportunity Launch
  -> Translate
  -> Scope Review
  -> Prism
  -> Marketplace
  -> Execution
```

Launch results are non-authoritative and may not create ScopeVersion truth.
