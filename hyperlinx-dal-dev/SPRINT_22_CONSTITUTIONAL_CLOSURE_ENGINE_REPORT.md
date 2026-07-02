# SPRINT_22_CONSTITUTIONAL_CLOSURE_ENGINE_REPORT

## Executive Summary

Sprint 22 establishes the Constitutional Closure Engine for the Kernel Execution Graph.

The Kernel Execution Graph now exposes deterministic closure authority without creating Marketplace, Control, Field, Operational, ScopeVersion, or Service Order workflows.

The constitutional model is:

```text
Execution Expectation
        |
        v
Evidence
        |
        v
Validation
        |
        v
Validated Close
        |
        v
Derived Truth
```

Current truth is derived by replaying immutable validated Closes. It is not manually edited.

## Constitutional Principles

1. Kernel Execution Graph

   The Kernel Execution Graph is the constitutional execution substrate of IOF. It is derived from Product Doctrine, Measured Spine, Station Authority, Audit Projection, Spine Objects, and Closure Expectations. No workspace owns a separate execution model.

2. Spine Object Authority

   Every physical facility, segment, structure, asset, or engineered feature attached to the Measured Spine is a Spine Object. A Spine Object is the constitutional unit of execution.

3. Station Authority

   Stations are spatial addresses. They locate Spine Objects but do not replace them. Field, Engineering, Marketplace, Control, and Twin all operate against Spine Objects anchored to stations.

4. Audit Projection

   The Commercial Audit is not merely a pricing report. It projects quantities, costs, production assumptions, unknowns, review items, and closure expectations onto the Measured Spine.

5. Draft IOF Baseline

   The Draft IOF Package is the first instantiated execution model of the opportunity. It freezes the commercial baseline, including objects, quantities, audit projection, dependencies, and legal Close sequences.

6. Constitutional Close

   System truth evolves only through validated Closes. A Close is immutable, replayable, spatially addressed, and attached to one or more Spine Objects.

7. Derived State

   State is never manually edited. Current truth is derived by replaying validated Closes against the Spine Object's expectations and constitutional rules.

8. Close Sequence

   Each Spine Object receives a legal Close sequence before Draft IOF approval. The sequence defines what must happen before the next Close is legal.

9. Dependency Over Schedule

   The sequence is not a linear construction schedule. It is a dependency graph. Independent Spine Objects may advance concurrently when their prerequisite Closes are satisfied.

10. Field Redline Authority

    Field may redline real-world deviations, including offset, depth, placement, material substitution, utility conflict, obstruction, or quantity variance. Field Redlines do not modify ScopeVersion. Engineering must accept or reject them.

11. Segment Validation

    Payment is not released by reported progress. Payment becomes eligible only when all required Spine Objects in a payment segment have validated Closes, the as-built is generated from those Closes, and the segment is accepted.

12. Revenue Realization

    Revenue realization is the result of deterministic execution. No close, no validation. No validation, no payment.

13. Constitutional Assembly

    Before a Draft IOF Package may be created, the Commercial Audit shall assemble and validate the complete constitutional execution model of the opportunity. Every Spine Object must possess a doctrine, dependencies, constitutional Close sequence, evidence requirements, and payment validation relationship. Draft IOF approval is prohibited until Constitutional Assembly succeeds.

## Execution Expectations

Added:

- `src/kernel/closure/ExecutionExpectationEngine.ts`

Every executable KEG node can now receive an immutable `ExecutionExpectation` containing:

- expected work
- expected materials
- expected quantities
- expected evidence
- expected measurements
- expected tolerance
- expected doctrine
- expected dependencies
- expected acceptance criteria
- expected close sequence
- legal close sequence
- payment eligibility rule

Expectations are created from the execution node and its station/object/audit context.

## Closure Contracts

Added:

- `src/kernel/closure/ClosureContracts.ts`

Supported close types include:

- Commercial Close
- Engineering Close
- Marketplace Close
- Funding Close
- Control Release Close
- Construction Close
- Placement Close
- Fiber Placement Close
- Splice Close
- Testing Close
- Inspection Close
- As-Built Close
- Acceptance Close
- Operational Close
- Maintenance Close
- Retirement Close
- Field Redline Close
- Engineering Acceptance Close

Every Close carries execution object, node, station, measure, coordinate, workspace, authority, actor, evidence, validation result, ledger hash, and immutable/no-ScopeVersion flags.

Every Close also carries `spineObjectId` and `spineObjectIds`, making the Spine Object the constitutional unit being proven while station remains the spatial address.

## Closure Ledger

Added:

- `src/kernel/closure/ClosureLedger.ts`

The ledger stores:

- validated closes
- rejected closes
- pending closes
- ledger hash
- immutable close sequence

Rejected Closes remain recorded but do not become current truth.

## Replay Engine

Added:

- `src/kernel/closure/ClosureReplayEngine.ts`

Replay functions:

- `replayObject()`
- `replayStation()`
- `replayCorridor()`
- `replayPackage()`
- `replayGraph()`

Replay derives current truth from validated Closes only.

## Current Truth Derivation

Current truth is represented as a derived replay result:

- derived close ids
- rejected close ids
- last close
- next expected close
- accepted close types
- evidence ids
- redline count
- future ScopeVersion delta signal
- payment eligibility
- revenue realization

No mutable execution truth is stored directly.

## Execution Object Enrichment

KEG execution nodes now expose:

- execution object identity
- closure ledger
- expectation
- validated closes
- pending closes
- rejected closes
- current truth
- last close
- next deterministic close
- dependency status

## Kernel Graph Enrichment

Added:

- `src/kernel/closure/ClosureEngine.ts`

`enrichKernelExecutionGraphWithClosures()` enriches nodes without changing graph topology.

No nodes or edges are added or removed during closure enrichment.

Draft IOF Package persistence now includes:

- `executionExpectations`
- `closureLedgers`
- `closureReplaySummary`
- `constitutionalClosureSummary`
- `constitutionalAssembly`

Commercial submit-to-Engineering readiness blocks packages missing those closure artifacts.

`constitutionalAssembly` validates that every Spine Object has doctrine, dependency graph, legal Close sequence, evidence requirements, and payment validation relationship. Commercial package validation fails and Draft IOF approval is blocked unless this assembly status is `PASS`.

## Field Redline Authority

Field Redline Close is supported as an immutable Close.

It records:

- offset
- depth
- placement
- material substitution
- utility conflict
- obstruction
- access issue
- quantity variance
- photos
- gps
- notes

Field Redline Close does not modify ScopeVersion and does not certify Engineering.

## Engineering Acceptance Boundary

Engineering Acceptance Close is supported.

It may set:

- `requiresScopeVersionDelta = true`

It does not create ScopeVersion.

## Validation Results

Validation added:

- `sprint22-constitutional-closure-engine-validation.mjs`

Commands run:

- `npx tsc --noEmit`: PASS
- `node sprint22-constitutional-closure-engine-validation.mjs`: PASS, 104 checks
- `npm run build`: PASS

Build note: Vite reported the existing large chunk warning after a successful build.

The validation confirms:

- Execution Expectations are created.
- Spine Object authority is encoded.
- Stations are treated as spatial addresses, not execution identity.
- Constitutional Assembly validates every Spine Object before Draft IOF approval.
- Closure Contracts exist.
- Close Ledger exists.
- Replay Engine exists.
- Current Truth is derived through replay.
- Payment eligibility and revenue realization are derived from validation.
- No mutable state is stored as truth.
- Field Redline Close is supported.
- Field cannot modify ScopeVersion.
- Engineering Acceptance Close is supported.
- Rejected Close is preserved.
- Every Close references Execution Object.
- Every Close references Spine Object.
- Every Close references Station.
- Replay produces identical truth.
- Kernel graph is enriched.
- Graph topology is unchanged.
- Next Deterministic Close resolves correctly.
- Constitutional Assembly succeeds before Draft IOF approval.
- ScopeVersion is not created.
- Service Order is not created.
- Marketplace is not created.
- Control is not created.

## Remaining Gaps Before Execution Object Constitution

- Formal execution object constitution.
- ScopeVersion Delta Engine.
- Service Order projection.
- Marketplace projection.
- Control projection.
- Field workflow.
- Operational Twin projection.

## Constitutional Result

The Kernel Execution Graph is now a deterministic closure engine.

Execution state is derived from immutable validated Closes attached to Execution Objects.

Workspaces may later create Closes within their authority, but no workspace directly mutates execution truth.
