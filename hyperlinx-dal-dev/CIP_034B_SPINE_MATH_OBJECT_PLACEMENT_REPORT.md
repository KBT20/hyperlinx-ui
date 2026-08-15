# CIP-034B Spine Math Object Placement Report

Date: 2026-07-09

## Objective

Repair Engineering handoff and projection by making Doctrine Projection follow the field logic:

Run the math.
Look at the spine.
Address the objects.
Place them.

This repair does not redesign Product Doctrine, change pricing, change commercial quantities, change ScopeVersion, or weaken certification gates.

## Root Repair

The prior Doctrine Projection Engine could still depend on upstream object station addresses. CIP-034B moves the final station placement authority into the projection layer.

The projection now reads:

- route feet
- measured centerline
- station authority
- station graph
- existing Doctrine quantity schedule

It then places count-based objects using:

`nominal interval = route feet / doctrine count`

## Quantity Inputs

The engine consumes existing Product Doctrine quantity placement only:

- handhole count
- vault count
- splice case count
- ILA / regen count
- marker count
- slack loop count
- conduit feet
- fiber feet
- station count
- route feet

No new quantity logic was added.

## Object Placement

Count-based objects receive deterministic IDs:

- `HH-001`
- `VAULT-001`
- `SPLICE-001`
- `ILA-001`
- `MARKER-001`
- `SLACK-001`

Every projected object receives:

- route ID
- segment ID
- object type
- object sequence
- station address
- latitude / longitude
- geometry hash
- human-readable address label
- placement authority
- projection authority
- engineering authority

## Span And Linear Asset Projection

Objects are sorted by station and sequenced.

The projection derives spans between sequenced action objects and attaches:

- conduit
- fiber
- trace wire
- warning tape
- mule tape / pull tape

Linear asset station ranges also preserve full-spine coverage from `0+00` to route end. Spans remain views, not field closure limits.

## Handoff Repair

The server submit hydrator now uses the same spine math when creating handoff projection artifacts.

It populates:

- `measuredCenterlineId`
- `stationProjectionId`
- `stationGraphId`
- `stationAuthorityIds`
- `projectedObjectManifestId`
- `projectedObjects`
- `projectedSpans`
- `objectAddresses`
- `objectStationAttachments`
- `doctrineProjectionDiagnostics`

Submit to Engineering no longer depends on preexisting projection artifacts to avoid 409 failures for missing projection IDs.

## Diagnostics

Engineering now displays a visible `Doctrine Projection Diagnostics` panel.

For each object type it shows:

- doctrine quantity source
- route feet
- station count
- object count
- nominal interval
- calculated stations
- resolved coordinates
- placement authority
- projection result

Each object type reports four gates:

1. Math Present
2. Objects Calculated
3. Addresses Assigned
4. Objects Projected

Failed gates include exact reasons such as:

- missing route feet
- missing doctrine quantity
- zero object count
- station not resolved
- coordinate not resolved
- duplicate station
- duplicate object ID
- projection ID missing

## Certification Gate

Engineering Certification consumes the same diagnostics.

Certification fails with the specific failed diagnostic gate when:

- math count does not match doctrine quantity
- station cannot be resolved
- coordinate cannot be resolved
- object lacks address
- span cannot be derived
- required linear assets are not attached

## Unchanged Areas

CIP-034B does not change:

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
- `server/routes/engineering-certification.js`
- `src/engineering/EngineeringCertificationProjection.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `cip034b-spine-math-object-placement-validation.mjs`
- `CIP_034B_SPINE_MATH_OBJECT_PLACEMENT_REPORT.md`

## Validation Results

Validation script:

`node cip034b-spine-math-object-placement-validation.mjs`

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
