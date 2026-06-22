# Field Authority Audit

Audit date: 2026-06-22

Scope: audit only. No code changes were made for this report.

## Field Workspace Gating

File: `src/workspaces/FieldWorkspace.tsx`

Relevant references:

- `src/workspaces/FieldWorkspace.tsx:17`
- `src/workspaces/FieldWorkspace.tsx:163`
- `src/workspaces/FieldWorkspace.tsx:251`
- `src/workspaces/FieldWorkspace.tsx:276`
- `src/workspaces/FieldWorkspace.tsx:325`
- `src/workspaces/FieldWorkspace.tsx:374`
- `src/workspaces/FieldWorkspace.tsx:408`
- `src/workspaces/FieldWorkspace.tsx:654`

## Active Work Definition

Field defines active work as:

```ts
item.status === "ACTIVE"
```

`PENDING` work is not executable.

## Field Execution Gate

Field uses:

```ts
canFieldExecute(activeScope, selectedWorkItem)
```

File: `src/scopeversion/LifecycleAuthorityEngine.ts`

References:

- `src/scopeversion/LifecycleAuthorityEngine.ts:142`
- `src/scopeversion/LifecycleAuthorityEngine.ts:145`
- `src/scopeversion/LifecycleAuthorityEngine.ts:147`

Closure submission is allowed only when:

- ScopeVersion exists.
- ScopeVersion status is one of:
  - `CONTROL`
  - `CONTROL_ACTIVE`
  - `ACTIVATED`
  - `IN_CONSTRUCTION`
  - `FIELD`
  - `PARTIALLY_COMPLETE`
- Selected work item exists.
- Selected work item status is `ACTIVE`.
- Work item belongs to the selected ScopeVersion.
- Route authority is `CERTIFIED_ROUTE` or `PROVISIONALLY_CERTIFIED`.
- ScopeVersion has stations.
- ScopeVersion has objects.

## Closure Payload

Field closure creation passes `workItemId` into `createClosureRecord(...)`.

Files:

- `src/workspaces/FieldWorkspace.tsx`
- `src/scopeversion/ClosureAuthorityEngine.ts`
- `src/types/dal.ts`

Closure includes:

- `workItemId`
- `scopeVersionId`
- `authority`
- station/object transition fields
- prior/new state fields

## Server Gate

File: `server/routes/scopeversions.js`

References:

- `server/routes/scopeversions.js:216`
- `server/routes/scopeversions.js:389`
- `server/routes/scopeversions.js:393`

Server closure endpoint:

```http
POST /api/scopeversions/:scopeVersionId/closures
```

Before append:

- Loads `DIRS.controlWorkItems`.
- Requires at least one `ACTIVE` work item matching `scopeVersionId`.

If not found:

```json
{
  "error": "ACTIVE_CONTROL_WORK_REQUIRED",
  "message": "Cannot append closure without an ACTIVE ControlWorkItem for this ScopeVersion."
}
```

## Answers

Does Field validate ScopeVersion authority?

Yes. Client-side Field requires the ScopeVersion status to be in an executable Control/Field lifecycle state. It does not allow a `PROVISIONALLY_CERTIFIED` ScopeVersion status.

Does Field validate ACTIVE work authority?

Yes. Client-side Field requires a selected work item with `status: ACTIVE`.

Does Field validate both?

Yes. Client-side `canFieldExecute(...)` validates both ScopeVersion lifecycle status and ACTIVE work. Server-side closure append validates ACTIVE work but does not currently independently validate ScopeVersion lifecycle status.

## Actual `SV-FBL-131760` Field-Relevant State

Persisted ScopeVersion status:

```text
PROVISIONALLY_CERTIFIED
```

Active work:

```text
work-50db7189-c73c-4afd-bf85-6958e272644c ACTIVE
```

Persisted closure:

```text
closure-9c86fcfa-db84-4356-8e90-2096adcca944
workItemId = work-50db7189-c73c-4afd-bf85-6958e272644c
newObjectState = RELEASED
persistenceStatus = PERSISTED
```

## Field Finding

The current client gate would block new Field closures for `SV-FBL-131760` because the ScopeVersion top-level status is `PROVISIONALLY_CERTIFIED`, not `CONTROL`, `CONTROL_ACTIVE`, or another executable Field state. The existing persisted closure likely occurred before or during lifecycle status divergence, or through a path where server accepted active-work authority without checking ScopeVersion lifecycle status.
