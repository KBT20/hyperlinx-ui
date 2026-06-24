# Intent-Driven Architecture Doctrine

Phase: 6.8C

Intent-driven architecture selection is the first synthesis layer after Translate normalization.

## Doctrine

Customer intent selects network type.

Protection intent selects topology posture.

Network type and protection schema select a reference architecture.

Reference architecture selects design standards and object categories.

Design standards and objects create a Baseline Network Candidate.

The Baseline Network Candidate is evidence for Scope Review. It is not route engineering, corridor generation, authority, or truth.

## Constitutional Flow

```text
Customer
  -> Opportunity
  -> Translate Workspace
  -> Intent Selection
  -> Architecture Selection
  -> Baseline Network Synthesis
  -> Scope Review
  -> Prism
```

## Boundary Rules

- No routing.
- No engineering.
- No persistence.
- No server routes.
- No React implementation.
- No authoritative ScopeVersions.
- No corridor generation.
- No ScopeVersion generation.

External evidence, customer files, and Translate artifacts may influence synthesis, but human engineering review remains authoritative later.

Translate Workspace orchestrates intent selection, protection schema selection, architecture selection, and baseline synthesis into a Scope Review candidate.
