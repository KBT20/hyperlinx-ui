# DAL Kernel Drift Audit

Scope: `hyperlinx-dal-dev` only.

Search targets:

- `status ===`
- `lifecycleState`
- `PROVISIONALLY_CERTIFIED`
- `CONTROL_ACTIVE`
- `FIELD`
- `COMPLETE`
- `workItem.status`
- `objectState`
- `stationState`
- `allowedTransitions`

## Drift Findings

| File | Drift risk | Duplicate logic | Recommended consolidation | Severity |
|---|---|---|---|---|
| `src/scopeversion/ScopeVersionLifecycleGuard.ts` | Low | Authoritative lifecycle order and merge logic. | Keep as the single client lifecycle source. | Low |
| `server/routes/scopeversions.js` | Medium | Server duplicates lifecycle order/aliases/merge logic from client. | Accept short term for server independence; future shared package or generated contract should eliminate drift. | Medium |
| `server/routes/twin-state.js` | Medium | Server Twin route duplicates lifecycle alias/order and inference. | Import/share server lifecycle contract when server bundling supports it. | Medium |
| `src/scopeversion/scopeVersionValidation.ts` | Medium | Transition table includes legacy `FIELD_ACTIVE`, `IN_FIELD`, `IN_CONSTRUCTION`, `RELEASED_TO_CONTROL`. | Keep aliases accepted but document `FIELD` and `CONTROL` as canonical. | Medium |
| `src/scopeversion/ClosureAuthorityEngine.ts` | Low | Station/object transition tables also appear in server `scopeversions.js`. | Treat ClosureAuthorityEngine as client authority; server copy exists for API enforcement. | Medium |
| `server/routes/scopeversions.js` | Medium | Station/object transition tables duplicate `ClosureAuthorityEngine`. | Future shared transition matrix for server/client. | Medium |
| `src/scopeversion/LifecycleAuthorityEngine.ts` | Low | Gate sets contain lifecycle constants. | Keep as gate authority; update only from state registry. | Low |
| `src/workspaces/ControlWorkspace.tsx` | Low | Uses `getAuthoritativeLifecycleState`, `canControlCreateWork`, `canControlActivateWork`, and `transitionScopeVersionLifecycle`. | Continue routing transitions through lifecycle helpers. | Low |
| `src/workspaces/FieldWorkspace.tsx` | Low | Uses `canFieldExecute`, `createClosureRecord`, `applyClosureToScopeVersion`, and server closure append. | Continue using ClosureAuthorityEngine. | Low |
| `src/workspaces/TwinWorkspace.tsx` | Low | Reads selected projection and `getAuthoritativeLifecycleState`. | Keep Twin read-only. | Low |
| `src/workspaces/OperationalIntelligenceWorkspace.tsx` | Medium | Portfolio aggregates directly filter statuses and object/station state counts. | Accept as projection logic; do not allow OI writes. Consider a portfolio projection helper later. | Medium |
| `src/api/dalClient.ts` | Medium | Local fallback merges remote and IndexedDB collections in several APIs. | Keep for development continuity but mark fallback as non-authoritative. | High for shared truth if server unavailable |
| `src/api/scopeVersionRepository.ts` | Low | ScopeVersion fallback exists but save path uses lifecycle merge. | Maintain diagnostics and avoid using fallback as production truth. | Medium |
| `src/types/dal.ts` | Medium | `ControlWorkStatus` uses `ON_HOLD`, while kernel doctrine names `HOLD`. `BLOCKED` is not supported for ControlWorkItem. | Normalize display/docs now; add wire alias in future API contract if needed. | Medium |
| `src/types/dal.ts` | Medium | Route authority uses `DRAFT_ROUTE`/`REJECTED_ROUTE`, while doctrine names `DRAFT`/`REJECTED`. | Keep current wire values; document doctrine aliases. | Low |
| `src/workspaces/PrismSiteDecisionWorkspace.tsx` | Medium | Builds ScopeVersion and CertifiedRoute references; route authority checks are local. | Keep Site Decision as creator of candidate truth only; approval remains Route Engineering. | Medium |
| `src/workspaces/MarketplaceWorkspace.tsx` | Low | Quote action applies quote through `applyQuoteToScopeVersion`. | Keep quote lifecycle in quote engine. | Low |
| `src/api/iofPackageRepository.ts` | Medium | IOF package close can create child ScopeVersion. | Keep package close path documented as CloseEvent-to-child-truth bridge. | Medium |

## Kernel Bypass Risks

1. Any workspace that writes `scopeVersion.status` directly can bypass lifecycle doctrine.
2. Any code path that writes `canonicalTruth.stations` or `canonicalTruth.objects` after closures can erase field truth.
3. Any projection that combines global work items or closures into selected Twin state can violate selected-ScopeVersion isolation.
4. Any browser fallback write can create non-shared truth if DAL server is unavailable.

## Recommended Consolidation Order

1. Server/client lifecycle contract sharing.
2. Server/client closure transition table sharing.
3. Explicit fallback authority labeling in all UI write paths.
4. Portfolio projection helper for OI.
5. Wire alias cleanup for `ON_HOLD`, `DRAFT_ROUTE`, and `REJECTED_ROUTE`.
