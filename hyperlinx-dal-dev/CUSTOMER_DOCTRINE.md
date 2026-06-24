# Customer Doctrine

Customers buy outcomes.

Customers do not buy internal workflows, route abstractions, station IDs, or execution states.

All corridor development, engineering, budgeting, procurement, contracting, execution, and operations must be traceable to a customer.

## Customer Authority

Customer is the top-level business authority.

Every Opportunity must belong to a Customer.

Every Corridor must belong to an Opportunity.

Every ScopeVersion must trace back to Customer, Opportunity, and Corridor.

## Customer Types

Supported customer types:

- HYPERSCALER
- NEOCLOUD
- CARRIER
- ISP
- ENTERPRISE
- MUNICIPAL
- UTILITY
- DATA_CENTER
- GOVERNMENT

## Customer Model

Customer fields:

- customerId
- customerName
- customerType
- customerSegment
- industry
- accountOwner
- relationshipStatus
- contacts
- billingProfile
- legalProfile
- notes

## Doctrine

Customer intent may initiate analysis.

Customer intent does not create engineering truth.

Route Engineering approves executable design.

ScopeVersion represents approved execution truth.

## Customer Workspace Entry Point

Customer Workspace is the business entry point.

Ryan, CROs, account owners, engineers, and authorized stakeholders start with Customer or Opportunity, not Translate.

Opportunity Launch initiates Translate.

Translate does not own customer creation.

Translate does not own opportunity creation.

## Opportunity Intake Entry Point

Opportunity Intake is the constitutional entry point for customer asks:

```text
Customer
  -> Customer Workspace
  -> Opportunity
  -> Opportunity Launch
  -> Opportunity Intake
  -> Translate
  -> Corridor
  -> ScopeVersion
```

Opportunity Intake preserves `customerId` and `opportunityId` before Translate, Corridor Synthesis, Prism, Route Engineering, Marketplace, Control, Field, Twin, or Operational Intelligence consume the work.
