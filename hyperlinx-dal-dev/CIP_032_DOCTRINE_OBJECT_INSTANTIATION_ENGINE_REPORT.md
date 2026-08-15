# CIP-032 Doctrine Object Instantiation Engine Report

Date: 2026-07-08

## Objective

Implement the Doctrine Object Instantiation Engine, responsible for transforming the selected Product Doctrine into a deterministic Engineering Object Manifest before Engineering Certification.

No Engineering object class is manually invented during certification. Product Doctrine defines what must exist. DOIE instantiates the governed object graph. Engineering certifies that graph.

## Constitutional Placement

Commercial Opportunity -> Commercial Route Repository -> Commercial Change Set -> Commercial Revision -> Proposal -> Customer Acceptance -> Draft IOF Package -> Product Doctrine -> Doctrine Object Instantiation Engine -> Engineering Package -> Engineering Certification -> Certified IOF Package -> ScopeVersion Projection

DOIE does not create ScopeVersion.

## Engine

Created:

`src/products/DoctrineObjectInstantiationEngine.ts`

Authority:

`DOCTRINE_OBJECT_INSTANTIATION_ENGINE`

Version:

`32.1`

## Engineering Object Manifest

The DOIE manifest contains:

- object ID
- object type
- product ID
- doctrine ID
- revision
- parent object
- child objects
- station start
- station end
- geometry
- hierarchy
- required services
- required assets
- construction method
- placement strategy
- execution sequence
- close sequence
- payment sequence
- evidence requirements
- inspection requirements
- acceptance criteria
- visibility profile
- current state
- authority

The engine avoids placeholder `n/a` values.

## Object Addressing

Every instantiated object receives a deterministic address containing:

- scopeVersionCandidateId
- routeId
- segmentId
- stationStart
- stationEnd
- objectType
- objectSequence
- parentObjectId
- geometryHash
- jurisdiction
- latitude/longitude for point objects
- station range for linear objects
- human-readable address label

Certification fails if the manifest is missing or any object address is missing.

## Instantiated Outputs

DOIE builds:

- required Engineering Objects
- required Services
- required Assets
- dependency graph
- execution sequence
- close sequence
- payment sequence
- evidence requirements
- station lifecycle rules
- Marketplace projection
- Control projection
- Field projection
- Twin projection

Marketplace, Control, Field, and Twin remain downstream projections. They do not create execution truth.

## Dependency Graph

The Dependency Graph preserves parent/child hierarchy, prerequisite relationships, and deterministic sequence edges.

## Execution Sequence

The Execution Sequence is inherited from Product Doctrine and attached to instantiated objects.

## Close Sequence

The Close Sequence is inherited from Product Doctrine and attached to instantiated objects.

## Payment Sequence

The Payment Sequence is derived from each object billable trigger, payment trigger, and capital/cash-flow trigger.

## Station Lifecycle

Station Lifecycle rules project required services, assets, blocked reasons, evidence, close eligibility, payment eligibility, and Twin transitions to every station.

## Draft IOF Integration

Draft IOF assembly now invokes DOIE when a Product Doctrine Assembly exists.

The Draft IOF package carries:

- `doctrineObjectManifest`
- `engineeringObjectManifest`
- `doctrineObjectManifestId`
- `engineeringObjectManifestId`
- `doctrineInstantiatedObjects`
- `doctrineObjectAddresses`
- `doctrineObjectDependencyGraph`
- `doctrineObjectExecutionSequence`
- `doctrineObjectCloseSequence`
- `doctrineObjectPaymentSequence`
- `doctrineObjectEvidenceRequirements`
- `doctrineStationLifecycleRules`
- `doctrineObjectInstantiationValidation`
- `doctrineObjectInstantiationSummary`

## Engineering Certification Integration

Engineering Certification projection now reads DOIE outputs and adds compliance rows for:

- doctrine object manifest
- payment sequence
- station lifecycle

The server certification endpoint blocks certification when:

- Doctrine Object Manifest is missing.
- DOIE validation fails.
- Any instantiated Engineering Object lacks a deterministic address.

## Engineering Baseline Reference

Engineering Baseline reference selection now prefers the DOIE manifest ID when present.

This keeps Engineering Repository intake tied to the Product Doctrine object authority.

## ScopeVersion Boundary

ScopeVersion behavior was not modified.

DOIE publishes the certified object graph candidate. Runtime promotion remains downstream of Certified IOF Package and executed Service Order.

## Files Modified

- `src/products/DoctrineObjectInstantiationEngine.ts`
- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/api/teralinxRuntime.ts`
- `src/engineering/EngineeringCertificationProjection.ts`
- `server/routes/engineering-certification.js`
- `server/routes/engineering-baselines.js`
- `cip032-doctrine-object-instantiation-validation.mjs`
- `CIP_032_DOCTRINE_OBJECT_INSTANTIATION_ENGINE_REPORT.md`

## Validation Results

Validation script:

`node cip032-doctrine-object-instantiation-validation.mjs`

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
