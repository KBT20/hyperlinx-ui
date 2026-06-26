# Preliminary Quote Pipeline

The Phase 6.9C flow is:

```text
Customer
  -> Opportunity
  -> A/Z Sites
  -> Design Network
  -> Existing Design Pipeline
  -> ProposedGraph
  -> Proposed Inventory
  -> Preliminary Quote
  -> Customer Decision
  -> Route Engineering
```

The Preliminary Quote Package is advisory, preliminary, non-contractual, and generated from the canonical ProposedGraph.

## Quote Package Contents

- customer
- opportunity
- network summary
- estimated route
- estimated footage
- primary product
- construction summary
- estimated NRC
- estimated MRC
- recommended term
- assumptions
- confidence
- disclaimers
- read-only line items

## Handoff Rule

`Send to Route Engineering` remains disabled until the customer accepts the preliminary proposal.

Even after acceptance, this phase creates only an `EngineeringHandoffCandidate`. It does not create engineering work, geometry, ScopeVersions, or inventory.
