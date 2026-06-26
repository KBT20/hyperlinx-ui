# Teralinx Route Workspace Doctrine

Phase: 6.9A

## Core Rule

Teralinx Route is the sales entry point for proposed Layer 1 network creation.

It produces a proposed route request for future Design handoff. It does not replace Translate, and it does not create infrastructure truth.

## Workflow

Ryan opens Teralinx Route.

Ryan enters:

- Customer
- Opportunity
- A Site
- Z Site
- Optional intermediate sites
- Network type
- Protection
- Primary product

The workspace evaluates readiness and produces a `TeralinxRouteRequest`.

## Boundary

This workspace does not perform:

- Routing
- Geometry creation
- ScopeVersion creation
- Inventory mutation
- Persistence
- API calls
- Kernel changes
- Lifecycle changes
- Marketplace changes
- Control, Field, Twin, or Operational Intelligence changes

## Intended Future Handoff

Ready route requests may later become Proposed Inventory inputs to Design. That handoff is not implemented in this phase.
