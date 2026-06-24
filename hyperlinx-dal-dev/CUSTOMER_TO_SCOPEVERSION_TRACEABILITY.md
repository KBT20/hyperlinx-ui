# Customer To ScopeVersion Traceability

Every ScopeVersion must trace back to:

- Customer
- Opportunity
- Corridor

## Mandatory ScopeVersion Traceability

A ScopeVersion must include:

- customerId
- opportunityId
- corridorId

This creates the chain:

Customer

to

Opportunity

to

Corridor

to

ScopeVersion

## Why This Matters

ScopeVersion is execution truth.

Execution truth without business lineage is orphan truth.

Orphan truth cannot support Marketplace budgets, contracts, Control work, Field closure, Twin reporting, or Operational Intelligence.

## Corridor Relationship

A Corridor cannot exist without an Opportunity.

An Opportunity cannot exist without a Customer.

Corridor analysis is advisory until promoted through Route Engineering.

## Execution Relationship

Control and Field remain tied to ScopeVersions.

Control does not execute raw corridor analysis.

Field does not close against opportunities or corridors.

Field closes against ScopeVersion truth.

## ScopeVersion Close Authority Alignment

All authority resolves through ScopeVersion Close events.

A ScopeVersion close must preserve `customerId`, `opportunityId`, and `corridorId` so customer lineage remains replayable.

Advisory objects remain advisory until validated close authority exists against `scopeVersionId`.
# Opportunity Intake Boundary

The customer-to-ScopeVersion chain begins with Opportunity Intake:

```text
Customer
  -> Opportunity Intake
  -> Translate
  -> Corridor
  -> ScopeVersion
```

Opportunity Intake may preserve future `corridorId` and `scopeVersionId` placeholders, but it may not create either object.
