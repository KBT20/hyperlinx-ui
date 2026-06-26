# Design Launch Validation

## Ready Example

Google Texas AI Route produces:

- customer present
- opportunity present
- two sites
- network type `LONG_HAUL`
- protection `DIVERSE`
- product `DUCT_PLUS_FIBER`
- status `READY`
- next workspace `DESIGN`

## Blocked Example

The blocked fixture produces:

- missing customer
- missing opportunity
- missing A/Z site coverage
- missing network intent
- missing product
- status `BLOCKED`

## Validation Rules

Design Launch requires:

- customer company and primary contact
- opportunity name and market
- minimum two sites
- supported network type
- supported protection
- primary product

## Boundary Validation

Phase 6.9B does not:

- persist sessions
- call server APIs
- create routes
- create geometry
- create stationing
- create ScopeVersions
- mutate inventory
- alter lifecycle or execution state

## Build Validation

Required commands:

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```
