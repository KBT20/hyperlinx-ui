# CIP-034 Doctrine Projection Engine Report

Date: 2026-07-09

## Objective

Implement the Doctrine Projection Engine and materialize Product Doctrine objects onto the continuous Station Spine before Engineering Certification.

Projection is not quantity logic. It does not recalculate commercial assumptions, pricing, or Product Doctrine decisions. It places already-instantiated doctrine objects onto the station authority surface and creates the object/span graph Engineering can restore.

## Constitutional Authority

The Doctrine Projection Engine consumes:

- Product Doctrine
- Doctrine Object Manifest
- Route Geometry
- Route Repository reference
- Commercial Release Package reference
- Station Spine authority objects

The engine produces:

- `measuredCenterlineId`
- `stationProjectionId`
- `stationGraphId`
- `stationAuthorityIds`
- `projectedObjectManifestId`

No ScopeVersion, Marketplace, Control, Field, Twin, or Operational Intelligence behavior was changed.

## Projection Architecture

Added:

- `src/products/DoctrineProjectionEngine.ts`

The engine projects every Doctrine Object Manifest object onto the Station Spine and records:

- deterministic object ID
- doctrine object type
- station address
- geographic coordinate
- parent span
- parent route
- placement authority
- placement reason
- doctrine quantity source
- execution sequence
- close sequence
- payment sequence
- dependency list
- evidence requirements
- engineering authority

## Span Materialization

The engine derives view spans between sequenced doctrine action objects.

Projected spans carry:

- start object / end object
- start station / end station
- span length
- route coordinates
- contained linear assets
- dependencies

Linear assets attached to spans include:

- conduit
- fiber
- trace wire
- warning tape
- mule tape / pull tape

The map renders spans as selectable span primitives. It does not render every foot of conduit as an individual object.

## Draft IOF Integration

Draft IOF assembly now executes:

Doctrine Object Instantiation

-> Doctrine Projection Engine

-> Draft IOF Package

The package preserves projection artifacts for handoff:

- measured centerline
- station projection
- station graph
- station authorities
- projected object manifest
- projected objects
- projected spans
- object station attachments

The reference-only Draft IOF save path preserves these projection artifacts while continuing to strip embedded route geometry bodies, workbook rows, proposal bodies, runtime inventory, and map objects.

## Engineering Package Restore

Engineering Package references now include:

- `measuredCenterlineId`
- `stationProjectionId`
- `stationGraphId`
- `stationAuthorityIds`
- `projectedObjectManifestId`

Repository integrity verifies those IDs against the restored Draft IOF Package before Engineering Certification projection begins.

## Certification Gates

Engineering Certification now fails if Doctrine Projection outputs are missing:

- measured centerline
- station projection
- station graph
- station authority IDs
- projected object manifest

Certification also fails if any projected object is missing:

- station address
- coordinate
- parent span
- execution sequence
- close sequence
- payment sequence

## Unchanged Areas

CIP-034 does not change:

- Product Doctrine quantity logic
- pricing
- Commercial Change Sets
- Engineering Change Sets
- ScopeVersion
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence

## Files Modified

- `src/products/DoctrineProjectionEngine.ts`
- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/api/teralinxRuntime.ts`
- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-packages.js`
- `server/routes/engineering-certification.js`
- `src/engineering/EngineeringCertificationProjection.ts`
- `cip034-doctrine-projection-engine-validation.mjs`
- `CIP_034_DOCTRINE_PROJECTION_ENGINE_REPORT.md`

## Validation Results

Validation script:

`node cip034-doctrine-projection-engine-validation.mjs`

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

Regression validation:

`node cip033a-doctrine-manifest-materialization-validation.mjs`

Result:

`PASS`

`node cip033-doctrine-quantity-placement-station-sequencing-validation.mjs`

Result:

`PASS`

Note: Git reported existing CRLF normalization warnings in the working copy, but no whitespace errors.
