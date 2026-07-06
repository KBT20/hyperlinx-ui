# PERFORMANCE_ANALYSIS

Date: 2026-07-03
Program: CIP-010 - Constitutional Workspace Rationalization, Performance Audit & Foundation Review

This analysis is static source review plus existing validation execution. No new functionality was implemented.

## Executive Finding

The likely lag root cause is not a single infinite React loop. It is render-adjacent projection pressure:

- `GoogleRfpWorkspace.tsx` is the default workspace and is a 400k+ character monolith.
- The commercial workspace builds product doctrine, Draft IOF Package preview, audit projection, object addressing, catalog, manifest, kernel graph, PD-003 production artifacts, and spine object instantiation from React memo chains.
- `OperationalIntelligenceWorkspace.tsx` computes portfolio-wide MapKernel specs, completion projections, lifecycle slices, and field execution models directly in render scope.
- `MapKernel.tsx` flattens all primitives, computes metrics, runs render-authority audit, and builds tile lists each time its `specs` or visibility inputs change.
- Several components log during render/projection, which adds dev instability and noisy profiling.
- React StrictMode in `src/main.tsx` doubles render/effect paths in development, amplifying the above.

## Static Measurements

Hook counts from `rg -c`:

| Area | `useEffect` | `useMemo` | `useCallback` | Finding |
| --- | ---: | ---: | ---: | --- |
| `GoogleRfpWorkspace.tsx` | 15 | 67 | 0 | Highest render-derivation pressure. |
| `PrismSiteDecisionWorkspace.tsx` | 4 | 27 | 0 | Heavy decision/map projection surface. |
| `MapKernel.tsx` | 8 | 19 | 0 | Heavy primitive, audit, metric, viewport, tile computation. |
| `ProposedNetworkMapPanel.tsx` | 4 | 15 | 0 | Independent map stack with its own layer filtering. |
| `NetworkAffinityWorkspace.tsx` | 3 | 12 | 0 | Serviceability/map projection pressure. |
| `FieldWorkspace.tsx` | 4 | 9 | 0 | Repeated progress/field model derivation. |
| `OperationalIntelligenceWorkspace.tsx` | 2 | 0 | 0 | Many large arrays are computed without memoization. |
| `DALState.tsx` | 4 | 3 | 6 | Shared context value changes can fan out broadly. |

Constitutional execution sites:

| Execution | Current execution site | Performance risk |
| --- | --- | --- |
| Product Doctrine assembly | `GoogleRfpWorkspace.tsx` around the `productDoctrineAssembly` memo. | Rebuilds when many commercial dependencies change. |
| Draft IOF Package assembly | `GoogleRfpWorkspace.tsx` around `commercialDraftIofPackagePreview`; calls `assembleDraftIofPackage`. | Cascades into audit, manifest, addressing, kernel, PD-003, instantiation. |
| Engineering projection | `EngineeringCertificationWorkspace.tsx` calls `buildEngineeringCertificationProjection`; certification flow calls it again. | Map spec and object layers can be rebuilt per draft update. |
| Operational completion projection | `OperationalIntelligenceWorkspace.tsx` maps every ScopeVersion through `calculateCompletionProjection`. | Runs each render after refresh state changes. |
| Map rebuilds | `MapKernel.tsx` calls `renderMapKernelPrimitives`, `summarizeMapKernelMetrics`, `auditMapKernelRenderAuthority`. | Three passes over flattened specs; hidden layers are filtered after flattening. |
| Runtime serialization | Multiple `<pre>{JSON.stringify(...)}</pre>` blocks in ScopeVersion, Marketplace, OI, Prism, Commercial Review, and diagnostics panels. | Large runtime objects are serialized in visible render paths. |

## Render Loop Review

No obvious unconditional state-update loop was found. The risky patterns are controlled effects with broad dependencies:

- Commercial session autosave effect updates `liveCommercialSession` whenever selected pricing/assumption/scope dependencies change. If upstream objects are not referentially stable, this can cause repeated recalculation timestamps.
- Commercial draft recalculation effects update `transparentEstimateRecalculatedAt` based on draft estimate fields. This is bounded, but it still adds an extra render after estimate changes.
- Runtime lifecycle bridge auto-advances when quick quote is ready. It is guarded by `runtimeLifecycleState` and pending flags, but it performs async state updates from a render-derived workflow state.
- MapKernel persists viewport state whenever active layer ids, view, mode, or base layer changes. This is expected, but can write often during pan/zoom.

## Repeated Projection Findings

1. `GoogleRfpWorkspace.tsx` should not run constitutional assembly as a preview memo. A Draft IOF Package preview should be a cached artifact from an explicit "assemble/refresh" transition.
2. `OperationalIntelligenceWorkspace.tsx` should not build MapKernel specs for every ScopeVersion and IOF Package in render scope. It needs a summary projection or memo keyed by repository revisions.
3. `MapKernelDiagnostics.ts` repeats primitive rendering/audit/metrics independent of `MapKernel.tsx`. Diagnostics should reuse the same computed primitive cache.
4. `ScopeVersionRenderer.ts` includes `console.log("[RENDER_AUTHORITY_STATIONS]", ...)` during rendering. Remove or gate it behind debug mode.
5. `IOFPackageRenderer.ts` uses `Date.now()` as package-id fallback. If a package has no id, render identities become unstable.

## Map Rebuild Findings

Current MapKernel flow:

1. Flatten every spec primitive.
2. Attach render identity.
3. Filter by layer visibility.
4. Dedupe and sort.
5. Repeat similar flatten/filter work for metrics and render-authority audit.

This means hidden layers reduce paint output but do not fully eliminate upstream projection work.

Recommended architecture:

| Layer stage | Recommendation |
| --- | --- |
| Source projection | Build per-source immutable `MapKernelRenderSpec` only when source revision changes. |
| Layer registry | Maintain `LayerProjectionCache` keyed by source id, source revision, layer id, and style profile. |
| Visibility | Do not build hidden expensive layers; visible-only should apply before primitive construction where possible. |
| Diagnostics | Derive metrics and audits from the same primitive list used for render. |
| Viewport | Add optional viewport culling for large point/station/object layers. |
| Debug | Gate all map render logs behind a debug flag. |

## Current Measurement Gaps

The codebase does not yet expose counters for:

- render count per workspace,
- constitutional assembly execution count,
- object instantiation execution count,
- engineering projection execution count,
- map primitive rebuild count,
- runtime serialization frequency.

Until counters exist, static site counts are the available measurement. The next stabilization CIP should add development-only counters without changing business functionality.

## Performance Stabilization Strategy

1. Extract constitutional assembly from `GoogleRfpWorkspace` into a cached runtime command.
2. Add artifact hashes/revision ids for doctrine assembly, Draft IOF Package assembly, audit projection, object addressing, kernel graph, PD-003 artifacts, and instantiation.
3. Replace the default full Commercial Planning render with a lightweight shell and lazy panels.
4. Memoize or background-compute OI aggregate arrays.
5. Convert MapKernel to a single primitive derivation pass per input hash and share the result with metrics/audit.
6. Remove render-scope logs and unstable id fallbacks.
7. Add development instrumentation counters and include them in future validation scripts.

