# ScopeVersion Persistence Audit

Audit date: 2026-06-22

Scope: audit only. No code changes were made for this report.

## ScopeVersion Persistence Paths

### Client persistence entry point

File: `src/api/dalClient.ts`

Function: `saveScopeVersion`

References:

- `src/api/dalClient.ts:381`
- `src/api/dalClient.ts:382`
- `src/api/dalClient.ts:394`

Behavior:

- Loads an existing ScopeVersion through `loadScopeVersionRecord(...)`.
- Merges with `mergeImmutableScopeVersion(...)`.
- Validates through `validateScopeVersion(...)` and `assertValidScopeVersion(...)` for non-draft/strict flows.
- Removes large route geometry through `stripRouteGeometryFromScopeVersion(...)`.
- Creates or updates through `scopeVersionRepository`.

### Client repository

File: `src/api/scopeVersionRepository.ts`

Functions:

- `listScopeVersions`
- `loadScopeVersion`
- `createScopeVersion`
- `updateScopeVersion`
- `appendScopeVersionClosure`

References:

- `src/api/scopeVersionRepository.ts:214`
- `src/api/scopeVersionRepository.ts:226`
- `src/api/scopeVersionRepository.ts:235`
- `src/api/scopeVersionRepository.ts:256`

Authoritative fields:

- `scopeVersionId`
- top-level `status`
- top-level `certificationState`
- top-level `isImmutable`
- `certifiedRouteReference`
- `canonicalTruth`
- `events`
- `closures`

Fallback behavior:

- Remote failure logs `DAL SCOPEVERSION LOCAL FALLBACK ACTIVE`.
- Local fallback writes to browser IndexedDB collection `scopeVersions`.
- Browser fallback can preserve continuity but is not authoritative DAL server truth.

### DAL server route

File: `server/routes/scopeversions.js`

Functions:

- `loadScopeVersion`
- `persistScopeVersion`
- `handleScopeVersions`
- closure append path

References:

- `server/routes/scopeversions.js:319`
- `server/routes/scopeversions.js:323`
- `server/routes/scopeversions.js:380`
- `server/routes/scopeversions.js:418`
- `server/routes/scopeversions.js:424`

Behavior:

- `POST /api/scopeversions` persists normalized ScopeVersion JSON.
- `PUT /api/scopeversions/:id` persists the proposed ScopeVersion unless an existing record is certified immutable.
- If existing record is certified immutable, server creates a child ScopeVersion instead of mutating parent.
- `POST /api/scopeversions/:id/closures` applies closure state and recalculates lifecycle state.

## Actual Record Inspection: `SV-FBL-131760`

Source inspected:

- `GET http://67.213.118.179:3001/api/scopeversions/SV-FBL-131760`

Result:

```json
{
  "scopeVersionId": "SV-FBL-131760",
  "status": "PROVISIONALLY_CERTIFIED",
  "type": "CANDIDATE",
  "certificationState": "DRAFT",
  "isImmutable": false,
  "lifecycleState": "PROVISIONALLY_CERTIFIED",
  "constitutionalAuthority": "NON_AUTHORITATIVE",
  "routeAuthority": "PROVISIONALLY_CERTIFIED",
  "certifiedRouteId": "CR-06b6e9ca-5323-41ce-88a0-4f9a31c7ae17",
  "stationCount": 372,
  "objectCount": 7,
  "closureCount": 1
}
```

Events present:

```text
scopeversion.site_decision.created
certifiedroute.reference.attached
scopeversion.stationing.generated
scopeversion.approved
scopeversion.control.work_created
scopeversion.control.activated
scopeversion.quoted
```

Closure present:

```json
{
  "closureId": "closure-9c86fcfa-db84-4356-8e90-2096adcca944",
  "workItemId": "work-50db7189-c73c-4afd-bf85-6958e272644c",
  "closureType": "OBJECT_STATE_TRANSITION",
  "stationId": "STA-0000",
  "newObjectState": "RELEASED",
  "persistenceStatus": "PERSISTED"
}
```

## Answer: Does `APPROVED` Exist in Persisted Records?

For `SV-FBL-131760`, `APPROVED` exists only as an event:

```text
scopeversion.approved
```

It does not exist as the persisted top-level lifecycle state:

```text
status = PROVISIONALLY_CERTIFIED
canonicalTruth.lifecycleState = PROVISIONALLY_CERTIFIED
```

## Persistence Finding

The persisted ScopeVersion contains approval and Control activation events, but the authoritative lifecycle fields remain `PROVISIONALLY_CERTIFIED`. Downstream systems that correctly read top-level `status` will not treat this ScopeVersion as approved for Control execution.
