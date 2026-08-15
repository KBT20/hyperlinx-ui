# CIP-036 OSRM Completion IOF Assembly Commercial Map Projection Report

Date: 2026-07-09

## Objective

As soon as OSRM completes a route and the Commercial Route Repository commits, assemble and project the complete Initial IOF Package onto the Commercial map.

This sprint does not change Product Doctrine quantity logic, pricing, ScopeVersion, Marketplace, Control, Field, Twin, or Operational Intelligence.

Supported product:

`Point-to-Point Long Haul Conduit + Dark Fiber`

## Final Flow

```text
Addresses / A-Z
-> OSRM Route Complete
-> Route Repository Commit
-> Commercial Revision / Release Package Restore or Create
-> Initial IOF Package Assembly
-> Measured Spine
-> Stationing
-> Product Doctrine Loaded
-> Doctrine Math
-> Object Quantities
-> Object Placement
-> Object Addressing
-> Span Creation
-> Linear Asset Attachment
-> Repository Artifact Persistence
-> Commercial Map Projection
-> Commercial Review
```

## Route Completion Trigger

The Commercial workspace already commits and verifies the Route Repository after OSRM routing.

CIP-036 keeps that ordering and uses the committed `generatedRouteRepositorySnapshot` as the trigger for automatic Initial IOF Package assembly.

The route commit still happens before assembly.

## Doctrine Projection

The existing Product Doctrine assembly remains the quantity authority.

The Doctrine Projection Engine now also projects manifest-present:

- `CROSSING`
- `TERMINATION_POINT`

These counts are read from the existing Doctrine Object Manifest. No new commercial quantity logic was introduced.

Count-based projected objects include:

- handholes
- vaults
- splice cases
- ILA / regen sites
- marker posts
- slack loops
- crossings when present
- terminations when present

Linear assets remain span attachments, not per-foot objects:

- conduit
- fiber
- trace wire
- warning tape
- mule tape / pull tape

## Commercial Map Projection

The Commercial map now accepts an Initial IOF projection overlay sourced from the displayed Draft IOF Package.

It renders:

- clickable point/action objects
- clickable projected spans
- labels for projected IOF objects

Clicking a projected object opens an inspector with:

- object ID
- object type
- station address
- coordinate
- billable material
- billable labor
- dependencies
- execution sequence
- payment sequence
- close sequence
- evidence requirements
- lifecycle state

Clicking a projected span opens an inspector with:

- span ID
- start/end object
- start/end station
- length
- contained assets
- construction method
- billable material
- billable labor
- dependencies
- lifecycle state

## Commercial Doctrine Diagnostics

Added a visible Commercial Doctrine Diagnostics panel.

It shows the four requested gates:

1. Math Present
2. Objects Calculated
3. Addresses Assigned
4. Objects Projected

For each projected object or billable linear class it reports:

- doctrine quantity source
- route feet
- station count
- object count
- nominal interval
- calculated station list
- resolved coordinates
- placement authority
- projection result

Linear classes are shown as span attachments and station ranges.

## Repository Behavior

Draft IOF Package persistence remains reference-only.

The persisted package strips:

- embedded manifests
- projected objects
- projected spans
- object addresses
- station graphs
- route geometry

Immutable projection artifacts are persisted separately and restored through `iofArtifactRepositoryReferences`.

CIP-036 also hydrates from the Projected Object Manifest:

- projected spans
- object addresses
- linear asset span attachments

Commercial Draft IOF list/open paths now return hydrated projection artifacts for restore, while repository truth remains reference-only on disk.

## Engineering Inheritance

Engineering continues to consume the same projected object graph through Draft IOF artifact references.

Engineering does not regenerate objects or recalculate placement for the happy path.

If Engineering makes no changes, certification consumes the same projected objects and spans Commercial rendered.

## Unchanged Areas

CIP-036 does not change:

- Product Doctrine quantity logic
- pricing formulas
- route generation logic
- ScopeVersion behavior
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence

## Files Modified

- `server/routes/_shared.js`
- `server/routes/commercial-iof-packages.js`
- `src/products/DoctrineProjectionEngine.ts`
- `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx`
- `src/components/workspaces/proposednetwork/ProposedGraphInspectorPanel.tsx`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `cip034-doctrine-projection-engine-validation.mjs`
- `cip036-osrm-completion-iof-assembly-commercial-map-projection-validation.mjs`
- `CIP_036_OSRM_COMPLETION_IOF_ASSEMBLY_COMMERCIAL_MAP_PROJECTION_REPORT.md`

## Validation Results

Validation script:

`node cip036-osrm-completion-iof-assembly-commercial-map-projection-validation.mjs`

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

Regression validation:

`node cip035a-commercial-lifecycle-sequencing-validation.mjs`

Result:

`PASS`

`node cip035-happy-path-scopeversion-validation.mjs`

Result:

`PASS`

`node cip034b-spine-math-object-placement-validation.mjs`

Result:

`PASS`

`node cip034-doctrine-projection-engine-validation.mjs`

Result:

`PASS`

`node cip033a-doctrine-manifest-materialization-validation.mjs`

Result:

`PASS`

`node cip033-doctrine-quantity-placement-station-sequencing-validation.mjs`

Result:

`PASS`
