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
