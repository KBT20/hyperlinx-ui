# Customer Opportunity Model

The top-level business hierarchy is:

Customer

to

Opportunity

to

Corridor

to

ScopeVersion

to

Marketplace

to

Contract

to

Control

to

Field

## Customer

Customer is the business entity buying an outcome.

## Opportunity

Opportunity is the customer ask.

Opportunity stores requested products, endpoints, requirements, commercial owner, technical owner, and lifecycle status.

## Corridor

Corridor evaluates possible solutions for an Opportunity.

Corridor analysis remains advisory until Route Engineering approval.

## ScopeVersion

ScopeVersion is approved execution truth.

Every ScopeVersion must trace to:

- customerId
- opportunityId
- corridorId

## Marketplace

Marketplace receives:

- customerId
- opportunityId
- scopeVersionId
- Engineering Approval Package
- Budget Requirements
- Vendor Scope Requirements

Marketplace budgeting remains traceable to customer opportunity.

## Contract

Contracts attach to:

- customerId
- opportunityId
- scopeVersionId
- budgetId

Contracts do not attach directly to corridors.

Contracts execute approved work.

## Control

Control receives:

- customerId
- opportunityId
- scopeVersionId
- budgetId
- contractId

Control never receives raw corridor analysis.

Control executes approved ScopeVersion truth.

## Field

Field receives:

- customerId
- opportunityId
- scopeVersionId
- workItems

Field closes against ScopeVersion truth.
