# CIP-039 Constitutional Closure Engine Report

Date: 2026-07-09

## Objective

Implement a constitutional Closure Engine so IOF object, span, closure segment, and ScopeVersion state advances only through validated Closure Events.

State determines Domain. Domain does not determine State.

This sprint does not change Product Doctrine, quantity logic, pricing, route geometry authority, Doctrine Projection, IOF Package Assembly, ScopeVersion authority, Marketplace logic, Control logic, or Field logic.

## Constitutional Authority

Added the new state authority stack:

- `StateRegistry`
- `DomainProjectionEngine`
- `ClosureLedger`
- `ClosureEngine`
- `ClosureReplayEngine`

`submitClosure()` is the new state advancement authority.

The prior CIP-038 `transitionObjectState()` path remains only as a legacy compatibility export. No active source calls it.

## State Registry

`StateRegistry` defines every lifecycle state with:

- state ID
- domain
- authority
- visible lens
- allowed transitions
- required evidence
- diagnostics
- audit checks
- next states
- render style
- hover template
- toolbar and close actions

Workspaces can project visible actions and diagnostics from the registry instead of owning state rules.

## Domain Projection

`DomainProjectionEngine` derives:

- current domain
- current authority
- visible actions
- diagnostics
- audit checks
- toolbar actions
- close actions
- next states
- hover template

The projection is derived solely from current state. It does not store Current Domain as independent truth.

## Closure Engine

`submitClosure()` accepts:

- object ID, span ID, or closure segment ID
- current state
- requested state
- authority
- actor
- evidence IDs
- station range
- ScopeVersion ID
- reason

It validates:

- current state
- allowed transition
- authority ownership
- required evidence
- dependencies

On success it appends an immutable Closure Ledger event, advances the entity state, refreshes domain projection, and marks Twin/OI refresh as required.

## Closure Ledger

Closure Ledger entries include:

- closure ID
- timestamp
- object/span/closure segment reference
- from state
- to state
- domain
- authority
- actor
- evidence
- geometry authority ID
- ScopeVersion ID
- reason
- audit hash

The ledger is append-only, immutable after creation, hashable, and replayable.

## Closure Replay

`ClosureReplayEngine` reconstructs the IOF Package Twin from:

- Assembly Graph
- Closure Ledger

Replay rebuilds current state by entity and derives domain projection from the State Registry. It does not rely on mutable workspace state or stored current-domain snapshots.

## Workspace Projection

Commercial projected-object hover cards and Engineering object projection now derive authority/domain from `DomainProjectionEngine`.

The rich Commercial hover payload remains intact:

- doctrine
- quantity source
- station
- measure
- lifecycle state
- execution sequence
- labor template
- material template
- evidence template
- dependencies
- payment sequence
- close sequence

## ScopeVersion Boundary

ScopeVersion authority was not changed.

The new state model allows ScopeVersion state to advance through a validated closure event after Customer Signed evidence, but ScopeVersion promotion gates remain owned by the existing ScopeVersion authority engine.

## Unchanged Areas

CIP-039 does not change:

- Product Doctrine
- quantity logic
- pricing
- Route Repository
- Geometry Authority
- Doctrine Projection
- IOF Package Assembly
- ScopeVersion authority
- Marketplace logic
- Control logic
- Field logic

## Files Modified

- `src/state/StateRegistry.ts`
- `src/state/DomainProjectionEngine.ts`
- `src/state/ClosureLedger.ts`
- `src/state/ClosureEngine.ts`
- `src/state/ClosureReplayEngine.ts`
- `src/state/ObjectTransitionEngine.ts`
- `src/engineering/EngineeringCertificationProjection.ts`
- `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx`
- `cip039-constitutional-closure-engine-validation.mjs`
- `CIP_039_CONSTITUTIONAL_CLOSURE_ENGINE_REPORT.md`

## Validation Results

Validation script:

`node cip039-constitutional-closure-engine-validation.mjs`

Result:

`PASS`

CIP-038 regression:

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

## Final Finding

The constitutional state lifecycle now has a dedicated Closure Engine authority.

Domains contribute validated closure events. The State Registry determines which domain owns the current state, what evidence is required, what actions are visible, and how the object/span/closure segment should render. The Closure Ledger is the replayable record, and the IOF Package Twin can be reconstructed from the Assembly Graph plus that ledger.
