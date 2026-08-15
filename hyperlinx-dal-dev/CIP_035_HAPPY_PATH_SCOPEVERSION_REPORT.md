# CIP-035 Happy Path to ScopeVersion Report

Date: 2026-07-09

## Objective

Suspend feature expansion and prove one constitutional lifecycle for the only supported product:

`Point-to-Point Long Haul Conduit + Dark Fiber`

This sprint is a lifecycle proof, not a feature sprint.

## Final Happy Path

The supported workflow is now:

```text
Opportunity
-> Select Product
-> Generate Route
-> Automatic IOF Package Assembly
-> Commercial Review
-> Save Proposal
-> Customer Approval
-> Submit to Engineering
-> Engineering Certification
-> Certified IOF Package
-> Generate Service Order
-> Customer Signature
-> Create ScopeVersion
```

No Commercial Change Set or Engineering Change Set is required for this path.

## Automatic IOF Package Assembly

Commercial route generation now triggers automatic Initial IOF Package Assembly after the Route Repository commits and reloads.

The client saves the existing Draft IOF assembly through the canonical Draft IOF save API once per generated Route Repository.

This uses the existing `IOFPackageAssemblyEngine` output. It does not create new quantity logic, pricing logic, or route generation logic.

## Repository Artifact Persistence

Draft IOF Package persistence now separates repository artifacts from the Draft IOF envelope.

Persisted immutable artifact repositories:

- Engineering Object Manifest
- Station Projection
- Station Graph
- Station Object Manifest
- Measured Centerline
- Projected Object Manifest

The Draft IOF Package stores references to these artifacts through `iofArtifactRepositoryReferences`.

The Draft IOF Package repository record is marked:

- `referenceOnly: true`
- `noEmbeddedManifests: true`
- `noEmbeddedGeometry: true`
- `noDuplicatedObjectGraphs: true`

Engineering restore hydrates those references for projection and certification, but repository truth remains separated.

## Commercial Boundary

Commercial remains limited to:

- route generation
- automatic Initial IOF Package assembly
- proposal save
- customer approval
- submit to Engineering

Commercial does not move objects or create Change Sets in this happy path.

## Engineering Boundary

Engineering Certification continues to verify:

- Product Doctrine compliance
- customer requirements
- specifications
- quantities
- object placement
- sequences
- evidence requirements

Engineering Certification hydrates Draft IOF artifacts from repository references and persists any Draft IOF status changes back as reference-only package records.

No Engineering Change Set is required for the happy path.

## Certified IOF Package

The Certified IOF Package remains a projection of the Certification Ledger.

It now carries reference IDs for:

- measured centerline
- station projection
- station graph
- station authority IDs
- engineering object manifest
- station object manifest
- projected object manifest

It does not embed commercial truth or engineering object graphs.

## Service Order And Signature

Service Order generation already existed.

CIP-035 adds the missing final signature authority:

`POST /api/service-orders/:serviceOrderId/record-signature`

This records:

- `SIGNED_SERVICE_ORDER`
- `CUSTOMER_SIGNED`
- `EXECUTED_SERVICE_ORDER`
- `serviceOrderSignatureId`
- `customerSignatureId`

The previous placeholder endpoint remains unchanged and still does not authorize ScopeVersion promotion.

## ScopeVersion Promotion

ScopeVersion promotion now resolves Certified IOF Package references before invoking ScopeVersion authority.

Promotion resolves:

- source Draft IOF Package
- IOF artifact repository references
- Commercial Route Repository geometry
- measured centerline
- station projection
- station graph
- projected object manifest

ScopeVersion authority still enforces:

- Certified IOF Package
- Customer Acceptance
- Service Order
- signed Service Order / Customer Signature

## Promotion Trace

The constitutional trace represented by the path is:

```text
Commercial Review            PASS
Commercial Approval          PASS
Customer Approval            PASS
Engineering Certification    PASS
Certified IOF Package        PASS
Service Order                PASS
Customer Signature           PASS
ScopeVersion Created         PASS
```

When promotion blocks, ScopeVersion authority continues to report the failed stage and required authority, including missing Service Order or missing customer signature evidence.

## Unchanged Areas

CIP-035 does not change:

- Product Doctrine quantity logic
- pricing formulas
- Commercial Change Set doctrine
- Engineering Change Set doctrine
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence

## Files Modified

- `server/routes/_shared.js`
- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-baselines.js`
- `server/routes/engineering-packages.js`
- `server/routes/engineering-certification.js`
- `server/routes/certification-ledger.js`
- `server/routes/service-orders.js`
- `server/scopeversion-authority-engine.js`
- `src/api/teralinxRuntime.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `cip035-happy-path-scopeversion-validation.mjs`
- `CIP_035_HAPPY_PATH_SCOPEVERSION_REPORT.md`

## Validation Results

Validation script:

`node cip035-happy-path-scopeversion-validation.mjs`

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
