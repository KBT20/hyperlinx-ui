# CONSTITUTIONAL_FOUNDATION_V1_0

Date: 2026-07-03
Program: CIP-011

This CIP copy mirrors the root foundation baseline and records the implementation boundary for future constitutional planning.

## Principle

The runtime shell displays, selects, and requests artifacts. Constitutional engines own artifact creation. Cache keys are derived from source identity, source revision, layer/style profile, and full input hash.

## Baseline Components

- `src/runtime/ConstitutionalProjectionCache.ts`
- `src/runtime/ConstitutionalAssemblyScheduler.ts`
- `src/runtime/RuntimeDiagnostics.ts`
- `src/mapkernel/MapLayerRegistry.ts`
- `src/mapkernel/MapRenderer.ts`
- `src/dal/DALNavigation.tsx`
- `src/dal/DALApp.tsx`

## Stabilization Result

The foundation now has a deterministic in-memory projection layer. This is sufficient to stop the largest render-time recomputation risks while preserving existing product, engineering, and ScopeVersion behavior.

