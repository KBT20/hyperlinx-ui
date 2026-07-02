# SPRINT_21_KERNEL_EXECUTION_GRAPH_REPORT

## Executive Summary

Sprint 21 establishes the Kernel Execution Graph as the constitutional execution model for IOF.

Every new Draft IOF Package now persists a single execution graph derived from the authority artifacts created in Sprints 20B and 20F:

- measured spine
- station authority
- station index
- station-to-coordinate map
- engineering objects
- object station attachments
- station-indexed graph
- audit projection
- closure expectations

The graph does not create ScopeVersion. It becomes the execution substrate that later workspaces project from.

## Kernel Files Added

Added:

- `src/kernel/KernelExecutionGraph.ts`
- `src/kernel/ExecutionNode.ts`
- `src/kernel/ExecutionEdge.ts`
- `src/kernel/ExecutionGraphBuilder.ts`
- `src/kernel/ExecutionGraphProjection.ts`
- `src/kernel/ExecutionGraphContracts.ts`

Authority label:

- `KERNEL_EXECUTION_GRAPH_AUTHORITY`

Graph version:

- `KEG-1`

## Execution Node Authority

The Kernel Execution Graph creates first-class nodes for:

- measured spine
- every authorized station
- engineering objects
- station range expectations
- stationed audit expectations
- audit review objects
- closure expectations

Engineering objects are child nodes of station nodes when object station attachment authority exists.

## Execution Edge Authority

The graph creates deterministic edges for:

- spine to station containment
- station physical order from the station-indexed graph
- station to object attachment
- audit projection to station/range/object context
- closure and review requirements

Graph validation requires acyclic execution dependencies.

## Projection Layers

The graph supports these constitutional projections from the same source graph:

- Physical
- Commercial
- Stations
- Engineering
- Execution
- Marketplace
- Control
- Field
- Operational
- Lifecycle

No workspace owns a separate execution state model. Workspaces should project from the Kernel Execution Graph.

## Draft IOF Package Persistence

`src/commercial/IOFPackageAssemblyEngine.ts` now persists:

- `kernelExecutionGraph`
- `executionNodes`
- `executionEdges`
- `executionGraphProjections`
- `executionGraphValidation`
- `executionGraphSummary`

The package validation also checks that the Kernel Execution Graph exists and that stations are projected as first-class execution nodes.

Commercial submit-to-Engineering readiness now blocks packages that are missing the Kernel Execution Graph, execution nodes, execution edges, or a passing execution graph validation state.

## Graph Viewer Repurpose

`src/workspaces/GraphViewerWorkspace.tsx` has been repurposed from `DAL Graph Viewer` to `Kernel Execution Graph`.

It now exposes projection tabs:

- Physical
- Stations
- Engineering
- Execution
- Marketplace
- Control
- Field
- Operational

The selected details panel is now labeled `Selected Execution Node`.

## Validation Results

Validation added:

- `sprint21-kernel-execution-graph-validation.mjs`

Commands run:

- `npx tsc --noEmit`: PASS
- `node sprint21-kernel-execution-graph-validation.mjs`: PASS, 75 checks
- `npm run build`: PASS

Build note: Vite reported the existing large chunk warning after a successful build.

The validation confirms:

- Kernel Execution Graph files exist.
- Draft IOF Package persists the Kernel Execution Graph.
- Every station becomes a first-class execution node.
- Engineering objects are children of station nodes.
- Audit projection enriches the graph.
- Closure expectations become execution nodes.
- Physical order is sourced from station-indexed graph edges.
- Dependencies are acyclic.
- Node and edge identity is immutable.
- Execution nodes expose identity, lifecycle state, parents, children, and dependencies.
- Deterministic regeneration preserves graph identity.
- Every projection resolves from the same graph.
- Commercial submit validates Kernel Execution Graph readiness.
- The graph viewer exposes Kernel Execution Graph projection tabs.
- Workspaces do not rebuild the execution graph.
- ScopeVersion is not created.

## Constitutional Result

The Draft IOF Package now contains a Kernel Execution Graph.

The graph is derived from measured spine and station authority, enriched by engineering objects and audit projection, and persisted as the single execution substrate for downstream workspace projection.

ScopeVersion remains downstream and out of scope for Sprint 21.
