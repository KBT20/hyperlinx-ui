# DAL Kernel Wire Registry

Scope: `hyperlinx-dal-dev` only.

Purpose: define canonical persisted wire values for kernel state and document legacy aliases accepted at DAL boundaries.

## Canonical Wire Values

| Domain | Canonical values | Compatibility aliases accepted on load | Normalizer |
|---|---|---|---|
| `ControlWorkItem.status` | `PENDING`, `ACTIVE`, `HOLD`, `COMPLETE`, `CANCELLED`, `BLOCKED` | `ON_HOLD -> HOLD` | `src/kernel/KernelStateRegistry.ts` |
| `CertifiedRoute.routeAuthorityState` | `DRAFT`, `ENGINEER_REVIEW_REQUIRED`, `PROVISIONALLY_CERTIFIED`, `CERTIFIED_ROUTE`, `REJECTED`, `SUPERSEDED`, `DIRECT_FALLBACK`, `BLOCKED` | `DRAFT_ROUTE -> DRAFT`, `REJECTED_ROUTE -> REJECTED` | `src/kernel/KernelStateRegistry.ts` |
| `RouteCertificationSnapshot.status` | `DRAFT`, `ENGINEER_REVIEW_REQUIRED`, `PROVISIONALLY_CERTIFIED`, `CERTIFIED_ROUTE`, `REJECTED`, `SUPERSEDED`, `BLOCKED` | `DRAFT_ROUTE -> DRAFT`, `REJECTED_ROUTE -> REJECTED` | `src/kernel/KernelStateRegistry.ts` |
| `ScopeVersion.status` | Lifecycle states from `LIFECYCLE_ORDER` | Lifecycle aliases in `ScopeVersionLifecycleGuard` | `src/scopeversion/ScopeVersionLifecycleGuard.ts` |
| `ScopeVersion.canonicalTruth.lifecycleState` | Lifecycle states from `LIFECYCLE_ORDER` | Lifecycle aliases in `ScopeVersionLifecycleGuard` | `src/scopeversion/ScopeVersionLifecycleGuard.ts` |

## Persistence Rule

DAL may accept legacy aliases at API, repository, and browser-cache boundaries.

DAL must persist canonical values.

When a legacy alias is normalized, the system logs:

```text
[KERNEL_ALIAS_NORMALIZED]
```

## Current Alias Boundary Points

| Boundary | File | Behavior |
|---|---|---|
| Client API | `src/api/dalClient.ts` | Normalizes CertifiedRoute and ControlWorkItem payloads before local/server persistence and after reads. |
| ScopeVersion repository | `src/api/scopeVersionRepository.ts` | Normalizes `certifiedRouteReference.routeAuthorityState` before persistence and after reads. |
| Certified routes server | `server/routes/certified-routes.js` | Normalizes legacy route authority aliases on create/update/read. |
| Control work server | `server/routes/control-work-items.js` | Normalizes `ON_HOLD` to `HOLD` on create/update/read. |
| Generic server route reads | `server/routes/_shared.js` | Applies per-route normalizers to list/read responses. |

## Fallback Wire Authority

Browser fallback is not server truth.

Fallback diagnostics must display one of:

```text
LOCAL_FALLBACK
DEVELOPMENT_FALLBACK
```

and log:

```text
[KERNEL_FALLBACK_ACTIVE]
```

Fallback data may support development continuity, but may not establish authoritative ScopeVersion truth when a DAL endpoint is expected.

## Invariant Warnings

`KernelInvariantEngine` emits:

| Warning | Trigger |
|---|---|
| `[KERNEL_ALIAS_WARNING]` | Alias value remains in loaded kernel state. |
| `[KERNEL_DUPLICATE_AUTHORITY]` | Transition/state authority is mirrored across implementations. |
| `[KERNEL_FALLBACK_WARNING]` | Fallback mode is active, especially in production. |

## Constitutional Rule

Kernel state is identified by canonical wire values only.

Aliases are migration input, never persisted output.
