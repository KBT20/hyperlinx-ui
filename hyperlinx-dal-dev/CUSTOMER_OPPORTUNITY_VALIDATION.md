# Customer Opportunity Validation

This validation establishes the business hierarchy:

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

## Fixtures

Fixtures live in:

`src/customer/fixtures/customerOpportunityFixtures.ts`

Fixture examples:

- Google AI Expansion
- Oracle Data Center Interconnect
- Meta Long Haul Corridor
- CoreWeave AI Fabric
- Crusoe West Texas Expansion
- FiberLight Transport Opportunity
- 360 Broadband Metro Opportunity

## Google AI Expansion Example

Customer:

Google

Opportunity:

Google AI Expansion

Corridor:

CORR-GOOGLE-DFW-KC-AI

Potential ScopeVersion:

Future Route Engineering approved ScopeVersion.

Marketplace:

Receives customerId, opportunityId, scopeVersionId, engineering approval package, budget requirements, and vendor scope requirements.

Contract:

Attaches to customerId, opportunityId, scopeVersionId, and budgetId.

Control:

Executes approved ScopeVersion truth.

Field:

Closes work against ScopeVersion truth.

## FiberLight Transport Example

Customer:

FiberLight

Opportunity:

FiberLight Transport Opportunity

Corridor:

CORR-FIBERLIGHT-TRANSPORT

Requested Products:

- WAVE_SERVICE
- ROUTE_OPERATIONS

The opportunity frames the customer ask. The corridor evaluates a possible solution. ScopeVersion is required before execution.

## Validation Rules

- Customer doctrine exists.
- Opportunity doctrine exists.
- Customer-to-opportunity hierarchy exists.
- Customer-to-ScopeVersion traceability exists.
- Marketplace is tied to opportunities.
- Contracts are tied to opportunities.
- Control and Field remain tied to ScopeVersions.
- No kernel contracts are modified.
- No execution contracts are modified.
