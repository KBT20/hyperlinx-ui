# DAL Kernel Transition Authority

Scope: `hyperlinx-dal-dev` only.

Purpose: document where transition authority currently lives and where duplicate definitions remain.

## Authoritative Transition Sources

| Domain | Canonical authority | Notes |
|---|---|---|
| ScopeVersion lifecycle | `src/scopeversion/ScopeVersionLifecycleGuard.ts` | Defines monotonic lifecycle order, merge guard, inference from authority events, and `[KERNEL_LIFECYCLE_AUTHORITY]` startup diagnostic. |
| ScopeVersion validation | `src/scopeversion/scopeVersionValidation.ts` | Validates transition shape and calls lifecycle merge guard before persistence. |
| Station/object closure transitions | `src/scopeversion/ClosureAuthorityEngine.ts` | Client authority for field closure application and station/object state transitions. |
| ScopeVersion server persistence | `server/routes/scopeversions.js` | Server mirror for lifecycle merge, closure application, and station/object transitions. |
| Control work status | `src/scopeversion/LifecycleAuthorityEngine.ts` and `server/routes/control-work-items.js` | Client projections and server persistence normalize `HOLD` aliases. |
| Certified route state | `src/routing/RouteAuthorityEngine.ts`, `src/serviceability/routeCertification.ts`, `server/routes/certified-routes.js` | Route authority and certification paths emit canonical `DRAFT`/`REJECTED` values. |

## Duplicate Authority Locations

The following mirrors remain intentionally documented because full consolidation would require a generated/shared server-client contract pass:

| Authority | Client file | Server file | Risk |
|---|---|---|---|
| Lifecycle order and lifecycle aliases | `src/scopeversion/ScopeVersionLifecycleGuard.ts` | `server/routes/scopeversions.js`, `server/routes/twin-state.js` | Manual drift can make server persistence and Twin projection disagree. |
| Station transition table | `src/scopeversion/ClosureAuthorityEngine.ts` | `server/routes/scopeversions.js` | Invalid closure acceptance can diverge between client and server. |
| Object transition table | `src/scopeversion/ClosureAuthorityEngine.ts` | `server/routes/scopeversions.js` | Object lifecycle may render differently after server reload. |
| Route authority aliases | `src/kernel/KernelStateRegistry.ts` | `server/routes/certified-routes.js` | Server/client alias maps must stay synchronized until shared code generation exists. |
| Control work aliases | `src/kernel/KernelStateRegistry.ts` | `server/routes/control-work-items.js` | Server/client alias maps must stay synchronized until shared code generation exists. |

## TODO Markers

```text
TODO(KERNEL_AUTHORITY): Generate server lifecycle constants from the client kernel registry or move them to a shared package.
TODO(KERNEL_AUTHORITY): Generate station/object transition tables from one canonical source.
TODO(KERNEL_AUTHORITY): Generate route authority and control work alias maps from one canonical source.
```

## Runtime Diagnostics

Lifecycle authority source logs:

```text
[KERNEL_LIFECYCLE_AUTHORITY]
```

Regression prevention logs:

```text
[LIFECYCLE_REGRESSION_BLOCKED]
```

Duplicate authority warning logs:

```text
[KERNEL_DUPLICATE_AUTHORITY]
```

## Constitutional Rule

Transitions must be validated by the owning authority and persisted through the DAL repository/API boundary.

No workspace may directly write a lifecycle, route-authority, station, object, or control-work state without using the kernel guard or repository normalizer.
