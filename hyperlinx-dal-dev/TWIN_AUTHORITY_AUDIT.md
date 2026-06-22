# Twin Authority Audit

Audit date: 2026-06-22

Scope: audit only. No code changes were made for this report.

## Twin Workspace Data Sources

File: `src/workspaces/TwinWorkspace.tsx`

Relevant references:

- `src/workspaces/TwinWorkspace.tsx:1`
- `src/workspaces/TwinWorkspace.tsx:65`
- `src/workspaces/TwinWorkspace.tsx:83`
- `src/workspaces/TwinWorkspace.tsx:106`
- `src/workspaces/TwinWorkspace.tsx:113`
- `src/workspaces/TwinWorkspace.tsx:116`
- `src/workspaces/TwinWorkspace.tsx:236`
- `src/workspaces/TwinWorkspace.tsx:432`

Twin loads:

- `loadTwinState()`
- `listControlWorkItems()`
- `listFieldClosures()`
- `listCandidateSites()`
- `listOpportunitySeeds()`

Twin also consumes:

- selected ScopeVersion from DAL state
- selected inventory graph from DAL state
- ScopeVersion closure records from `canonicalTruth.closures` and top-level `closures`

## Projection Sources

Twin builds:

- `twinProjection = buildScopeVersionTwinProjection(selectedScopeVersion)`
- `selectedScopeWorkItems = workItems filtered by selectedScopeVersion.scopeVersionId`
- `selectedScopeFieldClosures = field closure ledger filtered by selected scope`
- `selectedScopeClosureRecords = ScopeVersion closure ledger`
- `completedClosureSource`:
  - `SERVER_FIELD_CLOSURE_LEDGER` if server FieldClosure records exist
  - otherwise `SCOPEVERSION_CLOSURE_LEDGER`
- `projectionSource`:
  - `MIXED`
  - `SERVER`
  - `LOCAL_FALLBACK`

## Lifecycle Violations

Twin calls:

```ts
deriveLifecycleViolations(
  selectedScopeVersion ? [selectedScopeVersion] : [],
  workItems,
  [...selectedScopeFieldClosures, ...selectedScopeClosureRecords]
)
```

File: `src/scopeversion/LifecycleAuthorityEngine.ts`

Relevant references:

- `src/scopeversion/LifecycleAuthorityEngine.ts:103`
- `src/scopeversion/LifecycleAuthorityEngine.ts:122`
- `src/scopeversion/LifecycleAuthorityEngine.ts:142`
- `src/scopeversion/LifecycleAuthorityEngine.ts:176`
- `src/scopeversion/LifecycleAuthorityEngine.ts:203`
- `src/scopeversion/LifecycleAuthorityEngine.ts:257`

Violation logic for Control work:

```ts
if (!scope || !isScopeVersionApprovedForControl(scope)) {
  code: "CONTROL_WORK_WITHOUT_APPROVED_SCOPE"
}
```

`isScopeVersionApprovedForControl(scope)` requires:

- status in:
  - `APPROVED`
  - `ACTIVATED`
  - `IN_CONSTRUCTION`
  - `CONTROL`
  - `CONTROL_ACTIVE`
  - `FIELD`
  - `PARTIALLY_COMPLETE`
  - `COMPLETE`
- route authority present
- stations present
- objects present

It does not infer approval from `events`.

## Actual Source-of-Truth Hierarchy

Actual implementation order:

1. ScopeVersion top-level lifecycle fields:
   - `status`
   - `certifiedRouteReference`
   - `canonicalTruth.stations`
   - `canonicalTruth.objects`
2. Control work ledger:
   - `ControlWorkItem[]`
3. Closure ledgers:
   - server FieldClosure ledger
   - ScopeVersion ClosureRecord ledger
4. Twin local projection:
   - `buildScopeVersionTwinProjection(...)`

Events are displayed/retained but are not treated as lifecycle state authority.

## Finding

Twin is correctly flagging `SV-FBL-131760` because the selected ScopeVersion's top-level status is `PROVISIONALLY_CERTIFIED`. An event named `scopeversion.approved` exists, but Twin does not and should not treat event history as a substitute for the current authoritative lifecycle state.
