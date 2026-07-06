# CONSTITUTIONAL_RUNTIME_KERNEL

Date: 2026-07-03

## Purpose

The Constitutional Runtime Kernel is the authoritative execution layer between doctrine and every user interface. Doctrine defines behavior. The Runtime Kernel creates and manages constitutional artifacts. React consumes artifact records.

## Kernel Surface

Primary entry point:

`ConstitutionalRuntimeKernel.requestArtifact(...)`

Supporting capabilities:

- read artifact
- list artifacts
- invalidate artifact
- invalidate artifact graph
- inspect lineage
- inspect dependency graph
- inspect diagnostics

## Implemented Modules

- `ConstitutionalRuntimeKernel.ts`
- `ArtifactRegistry.ts`
- `ArtifactDependencyGraph.ts`
- `ProjectionCache.ts`
- `AssemblyScheduler.ts`
- `ArtifactRevisionManager.ts`
- `ArtifactLineageEngine.ts`
- `RuntimeDiagnostics.ts`
- `RuntimeContracts.ts`

## Rule

React may request artifacts through the Kernel or through Kernel-backed scheduler facades. React shall not directly execute constitutional assembly engines.

