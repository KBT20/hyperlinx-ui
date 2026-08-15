# CIP-038 Constitutional State Authority Report

Date: 2026-07-09

## Objective

Lock the Layer 1 execution constitution so every projected object and span is born with state authority, closure authority, audit hooks, domain responsibility, and twin projection metadata.

This sprint does not change Product Doctrine quantity logic, pricing formulas, route generation, geometry authority, repository truth, ScopeVersion signature rules, Marketplace, Control, Field workflows, Twin workflows, or Operational Intelligence.

## Constitutional Rule

Assembly defines the object.

Closure advances the object.

Twin projects the object.

The only authority allowed to change object or span state is:

`ObjectTransitionEngine`

## State Authority

Created:

- `ObjectTransitionEngine`
- `CONSTITUTIONAL_LIFECYCLE_STATES`
- `DOMAIN_AUTHORITY_MATRIX`
- `ClosureLedger`
- `IofPackageTwinProjection`
- `WorkSegment`
- `ClosureEvent`

The lifecycle includes all required states from `COMMERCIAL_ASSEMBLED` through `RETIRED`.

The domain authority matrix maps states to:

- Commercial
- Engineering
- ScopeVersion
- Marketplace
- Control
- Field
- Twin

## Object And Span Birth

Doctrine Projection now initializes every projected object and projected span with:

- current state
- current authority
- next state
- next authority
- allowed transitions
- required evidence for the next transition
- domain responsibility matrix
- lifecycle state machine
- transition rules
- audit ledger hooks
- twin projection metadata
- labor template
- material template
- evidence template
- execution sequence
- close sequence
- payment sequence
- dependencies

## Closure Segments

Projected spans now create closure/work segments that reference:

- parent span
- measured centerline
- start station
- end station
- start measure
- end measure

Closure segments contain no independent geometry.

## Repository References

Draft IOF artifact persistence now includes:

- Closure Ledger
- IOF Package Twin
- execution graph ID
- lifecycle graph ID
- commercial audit reconciliation
- constitutional state validation

Draft IOF repository records remain reference-only and strip embedded work segments, commercial audit payloads, state validation payloads, and projection graphs from the package envelope.

## Engineering Integration

Engineering Package now stores and verifies:

- `closureLedgerId`
- `iofPackageTwinId`
- `executionGraphId`
- `lifecycleGraphId`
- `workSegmentCount`
- `commercialAuditStatus`
- `constitutionalStateValidationStatus`

Engineering Certification fails if:

- Closure Ledger is missing
- IOF Package Twin is missing
- execution graph is missing
- lifecycle graph is missing
- work segments do not match Closure Ledger
- Commercial audit is not `PASS`
- constitutional state validation is not `PASS`
- projected objects or spans lack state, authority, templates, audit hooks, or twin metadata

## Certification And ScopeVersion

Certification Ledger and Certified IOF Package projections now reference the state authority artifacts.

ScopeVersion promotion still requires:

- Customer Acceptance
- Service Order
- signed Service Order / Customer Signature
- Geometry Authority `PASS`

It now also requires certified references to:

- Closure Ledger
- IOF Package Twin
- Execution Graph
- Lifecycle Graph
- Commercial Audit `PASS`
- Constitutional State Authority validation `PASS`

No ScopeVersion authority rule was weakened.

## UI Integration

Commercial hover cards and click inspectors now expose:

- doctrine
- quantity source
- station
- measure
- lifecycle state
- current authority
- next authority
- domain responsibility
- audit status
- closure ledger
- twin projection
- execution sequence
- labor template
- material template
- evidence template
- dependencies
- payment sequence
- close sequence

Engineering Certification projection and selected object inspector expose the same state authority payload.

## Validation Results

Validation script:

`node cip038-constitutional-state-authority-validation.mjs`

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
