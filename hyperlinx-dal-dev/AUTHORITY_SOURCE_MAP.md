# Authority Source Map

Date: 2026-06-22

Scope: DAL only.

Constitutional rule: `ScopeVersion.canonicalTruth.lifecycleState` is the authoritative lifecycle state. UI lenses must read lifecycle through `getAuthoritativeLifecycleState(scopeVersion)`.

| File | Field Used | Authority Source | Lifecycle State Displayed |
|---|---|---|---|
| `src/scopeversion/ScopeVersionLifecycleGuard.ts` | `canonicalTruth.lifecycleState`, fallback `status` | Canonical getter and monotonic guard | Authoritative canonical lifecycle |
| `src/scopeversion/LifecycleAuthorityEngine.ts` | `getAuthoritativeLifecycleState(scopeVersion)` | Execution gate authority | Canonical lifecycle only |
| `src/components/ScopeVersionLifecycleRibbon.tsx` | `getAuthoritativeLifecycleState(scopeVersion)` | ScopeVersion canonical truth | Canonical lifecycle ribbon |
| `src/workspaces/RouteEngineeringWorkspace.tsx` | Approves to `APPROVED` and writes `canonicalTruth.lifecycleState` | Route Engineering approval authority | Canonical lifecycle in selector |
| `src/workspaces/ControlWorkspace.tsx` | `getAuthoritativeLifecycleState(activeScope)` | Control work authority with ScopeVersion guard | Canonical lifecycle; work status remains Control package state |
| `src/workspaces/FieldWorkspace.tsx` | `getAuthoritativeLifecycleState(activeScope)` | Field closure authority gated by selected active Control work | Canonical lifecycle in diagnostics and selector |
| `src/workspaces/TwinWorkspace.tsx` | `getAuthoritativeLifecycleState(projectionScopeVersion)` | Twin projection reads selected ScopeVersion only | Canonical lifecycle |
| `src/workspaces/OperationalIntelligenceWorkspace.tsx` | `getAuthoritativeLifecycleState(scope)` | Portfolio authority across many ScopeVersions | Canonical portfolio counts |
| `src/workspaces/MarketplaceWorkspace.tsx` | `getAuthoritativeLifecycleState(scope)` | Commercial lens reads ScopeVersion truth | Canonical lifecycle in selector |
| `src/workspaces/PrismSiteDecisionWorkspace.tsx` | `getAuthoritativeLifecycleState(scopeVersion)` | Site Decision preview reads ScopeVersion truth | Canonical lifecycle metadata |
| `src/api/scopeVersionRepository.ts` | Normalizes `canonicalTruth.lifecycleState` | Repository read/write authority | Canonical lifecycle persisted for legacy records |
| `src/api/dalClient.ts` | `saveScopeVersion()` delegates repository and validation | DAL API/repository authority | Does not independently render lifecycle |
| `src/commercial/quoteEngine.ts` | Advances only `ANALYZED -> QUOTED` through canonical lifecycle | Quote mutation evidence | Preserves higher canonical lifecycle |
| `src/mapkernel/ScopeVersionRenderer.ts` | `getAuthoritativeLifecycleState(scopeVersion)` | Map Kernel render metadata | Canonical lifecycle metadata |
| `src/api/iofPackageRepository.ts` | `getAuthoritativeLifecycleState(scopeVersion)` | IOF package audit metadata | Source lifecycle snapshot from canonical state |
| `server/routes/scopeversions.js` | Normalized `canonicalTruth.lifecycleState` | DAL server persistence authority | Server merge guard and closure gate |
| `server/routes/twin-state.js` | Server canonical lifecycle helper | Server Twin selected-scope projection | Canonical lifecycle for violations |

## Gate Summary

Route Engineering may transition a ScopeVersion to `APPROVED`.

Control may create work only when lifecycle is `APPROVED`.

Control may activate work only when lifecycle is `APPROVED` or `CONTROL`; activation writes `CONTROL_ACTIVE`.

Field may execute only when lifecycle is `CONTROL_ACTIVE` or already `FIELD_ACTIVE`, with an `ACTIVE` Control work item for the same ScopeVersion.

Twin projects only the selected ScopeVersion and does not mutate truth.

Operational Intelligence aggregates portfolio state across ScopeVersions.
