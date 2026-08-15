# CIP-033 Doctrine Quantity Placement and Station Sequencing Report

Date: 2026-07-08

## Objective

Use existing Product Doctrine quantities from proposal / Draft IOF assembly to place and sequence doctrine-instantiated objects on the station spine.

CIP-033 does not create new quantity logic, does not recalculate commercial assumptions, does not change pricing, and does not change ScopeVersion behavior.

## Quantity Authority

Doctrine Quantity Placement reads existing `ProductDoctrineAssembly` outputs:

- handhole count from `structureAssembly.structures[HANDHOLE].quantity`
- vault count from `structureAssembly.structures[VAULT].quantity`
- splice case count from `structureAssembly.structures[SPLICE_CASE].quantity`
- ILA / regen count from `structureAssembly.structures[ILA|REGENERATION].quantity`
- conduit feet from `quantitySummary.conduitFeet`
- fiber feet from `quantitySummary.fiberFeet`
- station count from `quantitySummary.stationCount`
- route feet from `quantitySummary.routeFeet`

Marker and slack loop placement use the existing route-mile placement assumption already carried by the Doctrine Object Instantiation Engine. No pricing or commercial assumption formulas were changed.

## Station Object Index

The Doctrine Object Instantiation Engine now produces a station object index with operator-readable IDs:

- `HH-001`, `HH-002`, ...
- `VAULT-001`, ...
- `SPLICE-001`, ...
- `ILA-001`, ...
- `MARKER-001`, ...
- `SLACK-001`, ...

Each station object includes:

- `objectId`
- `objectType`
- `stationAddress`
- `stationSequence`
- `parentRouteId`
- `parentSegmentId`
- `placementReason`
- `placementAuthority`
- `doctrineQuantitySource`

## Sequenced Action Objects

Station objects are sorted by station feet and assigned a deterministic station sequence.

Engineering movement is allowed only through an Engineering Change Set. Each index row preserves:

- `originalDoctrineStation`
- `currentEngineeringStation`
- `movementCreatesEngineeringChangeSet`

## Derived Spans

The sequenced station objects produce span views such as:

- HH to HH
- HH to splice case
- splice case to vault
- ILA to ILA
- structure to structure

Spans are views. They are not closure limits.

Continuous station closure remains preserved, so Field can close at `STA 112+41` or any station interval without being constrained by span boundaries.

## Linear Asset Span Attachments

Every derived span receives linear asset attachments for:

- conduit
- fiber
- trace wire
- warning tape
- mule tape / pull tape

These attachments reference Product Doctrine quantities and placement assumptions. They do not duplicate route geometry and do not recalculate pricing.

## Engineering Certification Readiness

Certification readiness now fails if:

- station object count does not match Product Doctrine quantity
- any action object lacks a station address
- station sequence has gaps
- station object IDs are duplicated
- span derivation fails
- linear assets are not attached to station spans

These failures appear as deterministic validation counters instead of runtime exceptions.

## Files Modified

- `src/products/DoctrineObjectInstantiationEngine.ts`
- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/api/teralinxRuntime.ts`
- `src/engineering/EngineeringCertificationProjection.ts`
- `server/routes/engineering-certification.js`
- `cip033-doctrine-quantity-placement-station-sequencing-validation.mjs`
- `CIP_033_DOCTRINE_QUANTITY_PLACEMENT_STATION_SEQUENCING_REPORT.md`

## Validation Results

Validation script:

`node cip033-doctrine-quantity-placement-station-sequencing-validation.mjs`

Result:

`PASS`

TypeScript:

`npx tsc --noEmit -p tsconfig.json`

Result:

`PASS`

Production build:

`npm run build`

Result:

`PASS`

Diff whitespace:

`git diff --check`

Result:

`PASS`

Note: Git reported existing CRLF normalization warnings in the working copy, but no whitespace errors.
