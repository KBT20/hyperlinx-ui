# Control Authority Audit

Audit date: 2026-06-22

Scope: audit only. No code changes were made for this report.

## Control Workspace Entry Points

File: `src/workspaces/ControlWorkspace.tsx`

Relevant functions:

- `defaultControlScope`
- `selectScope`
- `createWorkPackage`
- `updateWorkStatus`
- `saveScopeStatus`

References:

- `src/workspaces/ControlWorkspace.tsx:31`
- `src/workspaces/ControlWorkspace.tsx:148`
- `src/workspaces/ControlWorkspace.tsx:180`
- `src/workspaces/ControlWorkspace.tsx:198`
- `src/workspaces/ControlWorkspace.tsx:235`
- `src/workspaces/ControlWorkspace.tsx:255`
- `src/workspaces/ControlWorkspace.tsx:307`
- `src/workspaces/ControlWorkspace.tsx:374`

## Work Generation Requirements

Control work generation calls:

```ts
canControlCreateWork(activeScope)
```

File: `src/scopeversion/LifecycleAuthorityEngine.ts`

References:

- `src/scopeversion/LifecycleAuthorityEngine.ts:122`
- `src/scopeversion/LifecycleAuthorityEngine.ts:125`

Allowed only when:

- ScopeVersion exists.
- `scope.status === "APPROVED"`.
- Route authority is `CERTIFIED_ROUTE` or `PROVISIONALLY_CERTIFIED`.
- ScopeVersion has constitutional stations.
- ScopeVersion has constitutional objects.

If allowed:

- `createWorkPackage` creates five work items:
  - `ENGINEERING`
  - `PERMITTING`
  - `CONSTRUCTION`
  - `ACTIVATION`
  - `VALIDATION`
- All are created with `status: PENDING`.
- ScopeVersion is saved with `status: CONTROL`.
- Event appended:
  - `scopeversion.control.work_created`

## Work Activation Requirements

Control work activation path:

- `updateWorkStatus(item, "ACTIVE")`

Behavior:

- Persists selected work item with `status: ACTIVE`.
- If the item belongs to the selected ScopeVersion, saves ScopeVersion with:
  - `status: CONTROL_ACTIVE`
- Event appended:
  - `scopeversion.control.activated`

## Actual `SV-FBL-131760` Control Work State

Source inspected:

- `GET http://67.213.118.179:3001/api/control/work-items`

Filtered by:

- `scopeVersionId = SV-FBL-131760`

Result:

```json
{
  "count": 5,
  "statuses": "ACTIVE=1,PENDING=4",
  "activeIds": "work-50db7189-c73c-4afd-bf85-6958e272644c"
}
```

Work items:

```text
work-50db7189-c73c-4afd-bf85-6958e272644c ENGINEERING ACTIVE
work-c9d0c474-0886-456f-be85-6cff4c209fd1 VALIDATION PENDING
work-e51b6e1e-b090-454a-8766-fff523eec8ed ACTIVATION PENDING
work-e5b7a958-4132-4a08-9d3d-04550fcd2651 PERMITTING PENDING
work-f0cb84c6-6e62-4e26-bcd0-4faa671cef08 CONSTRUCTION PENDING
```

## Answers

Can Control generate work from `PROVISIONALLY_CERTIFIED` scopes?

No, not under the current helper. `canControlCreateWork` requires:

```text
scope.status === APPROVED
```

It permits `PROVISIONALLY_CERTIFIED` only as route authority, not as ScopeVersion lifecycle status.

Can Control activate work from `PROVISIONALLY_CERTIFIED` scopes?

The UI activation action does not re-run `canControlCreateWork`. It can activate an existing work item if a work item already exists and is selected. This means a stale or previously-created work package can remain active even if the ScopeVersion top-level status later regresses to `PROVISIONALLY_CERTIFIED`.

## Control Finding

Control correctly requires `APPROVED` to create work. However, already-created work can remain active after the ScopeVersion record later regresses or is overwritten to `PROVISIONALLY_CERTIFIED`. Control work existence alone is therefore not proof of current ScopeVersion approval authority.
