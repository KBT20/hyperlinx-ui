# Design Handoff Model

The Phase 6.9B handoff is:

```text
Customer
  -> Opportunity
  -> A/Z Site List
  -> Design Network
  -> Design Launch Session
  -> Existing Design Workspace
```

The launch session is intentionally not a new execution path.

## Handoff Inputs

- customer
- opportunity
- site list
- network intent
- protection
- primary product

## Handoff Output

- read-only Design Launch Session
- `nextWorkspace = DESIGN`
- placeholder estimated miles and node count
- diagnostics
- blockers when incomplete

## Design Ownership

The existing Design workspace remains responsible for:

- route builder
- stationing
- network objects
- proposed inventory graph generation
- downstream inventory graph visibility

No Design Launch component may perform those responsibilities.
