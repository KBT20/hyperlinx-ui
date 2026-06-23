# Opportunity Doctrine

Opportunities represent asks.

An Opportunity captures customer intent, requested products, endpoints, requirements, owners, and lifecycle status before corridor analysis becomes executable work.

## Rule

An Opportunity cannot exist without a Customer.

A Corridor cannot exist without an Opportunity.

A ScopeVersion cannot exist without:

- customerId
- opportunityId
- corridorId

## Opportunity Types

- LONG_HAUL
- MIDDLE_MILE
- METRO
- AI_INTERCONNECT
- DARK_FIBER
- DUCT_SALE
- TRANSPORT
- ENTERPRISE_ACCESS
- DATA_CENTER_INTERCONNECT

## Opportunity Status

- DRAFT
- DISCOVERY
- TRANSLATE
- CORRIDOR_ANALYSIS
- PRISM_REVIEW
- ENGINEERING_REVIEW
- MARKETPLACE
- CONTRACT
- CONTROL
- FIELD
- COMPLETE
- CANCELLED

## Opportunity Model

Opportunity fields:

- opportunityId
- customerId
- opportunityName
- opportunityType
- requestedProducts
- requestedEndpoints
- customerRequirements
- commercialOwner
- technicalOwner
- status
- createdAt
- notes

## Doctrine

Opportunities frame the customer ask.

Corridors evaluate possible solutions.

ScopeVersions represent approved execution truth.
