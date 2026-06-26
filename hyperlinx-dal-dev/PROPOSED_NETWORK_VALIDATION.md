# Proposed Network Validation

## Google Texas AI Example

The Google Texas AI `ProposedGraph` fixture displays:

- A Site
- Z Site
- proposed route
- proposed vaults
- proposed regeneration site
- customer review annotation
- estimated mileage, stations, crossings, vaults, fiber, and duct

## Interaction Validation

The Proposed Network map supports:

- zoom
- pan
- node selection
- segment selection

All interactions are display-only.

## Boundary Validation

Phase 6.9D does not:

- calculate routing
- calculate geometry
- mutate geometry
- create ScopeVersions
- mutate Inventory Graphs
- modify kernel behavior
- modify lifecycle
- modify Marketplace, Control, Field, Twin, or OI
- call APIs
- persist state

## Required Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```
