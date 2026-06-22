# Route Engineering Approval Audit

Audit date: 2026-06-22

Scope: audit only. No code changes were made for this report.

## Approval Paths Found

### Route Engineering ScopeVersion approval

File: `src/workspaces/RouteEngineeringWorkspace.tsx`

Function: `approveScopeVersionForControl`

Primary references:

- `src/workspaces/RouteEngineeringWorkspace.tsx:314`
- `src/workspaces/RouteEngineeringWorkspace.tsx:338`
- `src/workspaces/RouteEngineeringWorkspace.tsx:351`
- `src/workspaces/RouteEngineeringWorkspace.tsx:353`
- `src/workspaces/RouteEngineeringWorkspace.tsx:360`
- `src/workspaces/RouteEngineeringWorkspace.tsx:613`

Before state:

- Selected ScopeVersion may be `DRAFT`, `ANALYZED`, `PROVISIONALLY_CERTIFIED`, `QUOTED`, or another existing status.
- Approval is blocked unless a `certifiedRouteReference` exists.
- Route authority must be `CERTIFIED_ROUTE` or `PROVISIONALLY_CERTIFIED`.
- `canonicalTruth.stations` must exist and have at least one station.
- `canonicalTruth.objects` must exist and have at least one object.

After state intended by handler:

- Top-level `scopeVersion.status` is set to `APPROVED`.
- `certifiedRouteReference` is preserved or refreshed from the selected active CertifiedRoute.
- An event is appended:
  - `type: scopeversion.approved`
  - `entityType: ScopeVersion`
  - payload includes `certifiedRouteId`, `routeAuthorityState`, `stationCount`, and `objectCount`.

Fields modified:

- `status`
- `certifiedRouteReference`
- `updatedAt`
- `events`

Persistence method:

- Calls `saveScopeVersion(...)` from `src/api/dalClient.ts`.

Important observation:

- Approval is represented both as top-level lifecycle state (`status: APPROVED`) and as event history (`scopeversion.approved`).
- Downstream lifecycle authority checks use the top-level `status`, not the presence of the `scopeversion.approved` event.

## Non-ScopeVersion Approval Paths

### CertifiedRoute certification

File: `src/workspaces/RouteEngineeringWorkspace.tsx`

Function: `certifyActiveRoute`

Primary references:

- `src/workspaces/RouteEngineeringWorkspace.tsx:263`

Behavior:

- Certifies a `CertifiedRoute` through local `certifyRoute(...)`.
- Persists route authority through `createCertifiedRoute(...)`, `updateCertifiedRoute(...)`, and `certifyCertifiedRoute(...)`.
- Does not approve the ScopeVersion lifecycle.

### Prism Site Decision route attachment

File: `src/workspaces/PrismSiteDecisionWorkspace.tsx`

Primary references:

- `src/workspaces/PrismSiteDecisionWorkspace.tsx:1499`
- `src/workspaces/PrismSiteDecisionWorkspace.tsx:2000`
- `src/workspaces/PrismSiteDecisionWorkspace.tsx:2018`
- `src/workspaces/PrismSiteDecisionWorkspace.tsx:2419`

Behavior:

- Creates ScopeVersions and attaches `certifiedRouteReference`.
- Uses `PROVISIONALLY_CERTIFIED` route authority for OSRM-routed laterals.
- Generates quotes in some flows.
- Does not by itself create the Control approval lifecycle transition unless Route Engineering approval is invoked.

## Conclusion

The Route Engineering approval handler exists and is designed to persist `status: APPROVED`. The handler also appends `scopeversion.approved`, but that event is not treated as lifecycle authority by Control/Twin. The authoritative approval field remains the top-level `ScopeVersion.status`.
