# ASSEMBLY_SCHEDULER_DESIGN

Date: 2026-07-03

## Purpose

The assembly scheduler is the ownership layer between React and constitutional engines. React requests an artifact; the scheduler determines whether to reuse a cached record or execute the engine.

## Scheduler-Owned Engines

- `scheduleProductDoctrineAssembly`
- `scheduleDraftIofPackageAssembly`
- `scheduleEngineeringProjection`
- `buildCachedMapRenderProjection`

## Ownership Matrix

| Engine | Owner | Output | Trigger |
| --- | --- | --- | --- |
| Product Doctrine Assembly | Commercial Planning | Product Doctrine Assembly | Product, route, pricing, or doctrine version changes |
| Draft IOF Package Assembly | Commercial Planning | Draft IOF Package | Commercial audit, product, route, pricing, or customer approval changes |
| Engineering Projection | Engineering Certification | Engineering Projection | Draft IOF Package revision changes |
| Map Layer Projection | MapKernel | Visible primitives, metrics, audit | Source revision, visibility, or style profile changes |

## React Boundary

React workspaces may provide inputs and display outputs. They may not be the engine owner for artifact creation.

## Future Extension

The scheduler should become a persistent artifact orchestration service once ScopeVersion readiness gating is introduced.

