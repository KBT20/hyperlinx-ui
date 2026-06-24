# Opportunity Intake Doctrine

Phase: 6.8A

Opportunity Intake is the constitutional entry point for revenue-facing work.

## Doctrine

Sales captures opportunity.

Teralinx normalizes opportunity.

Translate prepares opportunity.

Engineering evaluates opportunity.

Marketplace budgets opportunity.

Sales does not engineer. Sales does not approve. Sales initiates.

## Constitutional Flow

```text
Customer
  -> Customer Workspace
  -> Opportunity
  -> Opportunity Launch
  -> Opportunity Intake
  -> Translate
  -> Intent Selection
  -> Architecture Selection
  -> Baseline Network Synthesis
  -> Scope Review
  -> Prism
  -> Corridor
  -> ScopeVersion
```

## Boundary Rules

- No persistence.
- No server routes.
- No UI implementation.
- No corridor creation.
- No ScopeVersion creation.
- No engineering.
- No marketplace execution.
- No contracts.

Opportunity Intake creates a package candidate only.

Translate may consume the package candidate to select network intent, protection schema, and a non-authoritative Baseline Network Candidate before Scope Review.

Customer Workspace is the business entry point. Opportunity Launch initiates Translate. Translate does not own customer creation or opportunity creation.

Opportunity Detail is the deal cockpit between Customer Workspace and downstream workspaces. Translate, Scope Review, Prism, and Preliminary Quote are launched from Opportunity Detail.
