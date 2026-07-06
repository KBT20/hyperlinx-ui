# RUNTIME_PROJECTION_CACHE_DESIGN

Date: 2026-07-03

## Purpose

The projection cache stabilizes expensive constitutional outputs by binding each artifact to deterministic inputs and a content hash. It prevents repeat assembly or projection execution when inputs have not changed.

## Contract

Each cache record includes:

- `artifactId`
- `artifactType`
- `inputHash`
- `revision`
- `timestamp`
- `sourceDoctrineVersions`
- `dependencies`
- `generationDurationMs`
- `cacheStatus`
- `producer`
- `value`

## Artifact Types

The cache supports Product Doctrine, Commercial Audit Projection, Audit Object Manifest, Constitutional Assembly, Draft IOF Package, PD-002A Address Projection, Spine Object Catalog Projection, PD-003 Production Projection, Spine Object Instantiation, Kernel Execution Graph, Engineering Projection, Revenue Projection, Marketplace Projection, Operational Intelligence Projection, and Map Layer Projection.

## Invalidation

An artifact is reused only when the artifact id and input hash match. If the input hash changes, the artifact is regenerated and the revision increments. Explicit invalidation is available through `invalidateConstitutionalArtifact`.

## Diagnostics

Cache hits, misses, entries, generation duration, and artifact revisions are recorded in `RuntimeDiagnostics`.

## Current Scope

The cache is in-memory. It is intentionally small and deterministic. Persistent artifact storage is deferred to a later event-sourced runtime pass.

