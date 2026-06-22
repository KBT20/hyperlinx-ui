# DAL Kernel Save/Merge Contract

Scope: `hyperlinx-dal-dev` only.

## Save Rules

1. ScopeVersion lifecycle is monotonic.
   - Client source: `src/scopeversion/ScopeVersionLifecycleGuard.ts`.
   - Server source: `server/routes/scopeversions.js`.
   - All ScopeVersion saves must pass through `mergeScopeVersionLifecycle`.

2. The authoritative lifecycle field is `ScopeVersion.canonicalTruth.lifecycleState`.
   - UI must read through `getAuthoritativeLifecycleState`.
   - `status` is kept in sync for compatibility, but must not be the only authority.

3. Geometry is immutable after certification unless superseded.
   - Certified ScopeVersions may create child ScopeVersions or superseding ScopeVersions.
   - Existing geometry must not be silently overwritten.

4. `certifiedRouteReference` is protected after approval.
   - Approved or later ScopeVersions require `CERTIFIED_ROUTE` or `PROVISIONALLY_CERTIFIED`.
   - Route evidence may be superseded through child/amendment truth, not replaced in place.

5. Stations and objects cannot be silently overwritten after closure activity.
   - ClosureAuthorityEngine may update station/object state through ClosureRecord application.
   - Other writers must preserve existing `canonicalTruth.stations`, `canonicalTruth.objects`, and closure ledger once closure activity exists.

6. Closure ledger is append-only.
   - ClosureRecord IDs are unique.
   - Duplicate same-state closures are rejected by `ClosureAuthorityEngine`.
   - Server `/api/scopeversions/:id/closures` rejects duplicate closure IDs.

7. Control work is server-authoritative.
   - `/api/control/work-items` is the DAL server persistence path.
   - Browser fallback is development continuity only and must be marked in diagnostics.

8. Twin projection is read-only.
   - Twin may display selected ScopeVersion truth, Control work, and closures.
   - Twin may not create ScopeVersion truth.

9. OI projection is read-only.
   - OI may aggregate across portfolio ScopeVersions.
   - OI may not mutate ScopeVersion, work, or closure truth.

10. Stale saves cannot regress lifecycle.
    - Stale incoming `PROVISIONALLY_CERTIFIED` cannot overwrite existing `APPROVED`, `CONTROL_ACTIVE`, `FIELD`, or higher states.
    - Regression attempts should log `[LIFECYCLE_REGRESSION_BLOCKED]`.

11. Local fallback must be clearly marked.
    - Current client repositories log `DAL LOCAL FALLBACK ACTIVE`, `DAL SCOPEVERSION LOCAL FALLBACK ACTIVE`, `DAL IOF PACKAGE LOCAL FALLBACK ACTIVE`, and `DAL CLOSE EVENT LOCAL FALLBACK ACTIVE`.
    - Fallback data must not establish production truth.

## Verification Points

| Contract | Current implementation | Status |
|---|---|---|
| ScopeVersion lifecycle monotonic | Client and server lifecycle guards preserve highest-ranked state and infer lifecycle from events/closures/execution state. | Implemented |
| Certified route reference required for approved workflows | ScopeVersion validation and invariant engine flag missing references. | Implemented |
| Closure append-only | ClosureAuthorityEngine rejects duplicates and server append validates station/object references. | Implemented |
| Work item server authority | Server route exists; client falls back if unreachable. | Implemented with fallback risk |
| Twin read-only | Twin state route builds projection only. | Implemented |
| OI read-only | OI consumes repositories and projections. | Implemented |
| Kernel invariant diagnostics | `src/kernel/KernelInvariantEngine.ts` logs `[KERNEL_INVARIANT_CHECK]` and `[KERNEL_INVARIANT_VIOLATION]`. | Implemented |

## Non-Regression Guidance

- Do not write `scopeVersion.status = ...` directly in a workspace.
- Do not save a ScopeVersion lifecycle transition without `transitionScopeVersionLifecycle` or `mergeScopeVersionLifecycle`.
- Do not update station/object state outside `ClosureAuthorityEngine` once field execution begins.
- Do not use browser fallback data to prove authority in shared DAL deployments.
