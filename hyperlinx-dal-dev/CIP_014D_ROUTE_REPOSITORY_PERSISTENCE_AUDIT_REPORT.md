# CIP-014D Route Repository Persistence Audit Report

Date: 2026-07-06

## Scope

CIP-014D audits and repairs Commercial Planning route persistence for A/Z generated OSRM routes. This is not a UI redesign and does not create ScopeVersion authority.

No ScopeVersion, Engineering, Marketplace, Control, Field, Operational Twin, Operational Intelligence, route engine, pricing engine, graph engine, or doctrine engine behavior was changed.

## Root Cause

The missing Route Repository reference was caused by the previous save path creating a Route Repository snapshot only during Opportunity save, and only from route state that happened to be visible to the save builder at that moment.

A/Z Generate Route stored geometry in runtime component state as `commercialRouteResult` and derived `commercialCorridorDraft` through memoized workflow state. The route displayed and priced correctly, but Route Repository creation was not a required post-route-generation transaction. If the save ran without a durable route snapshot, the Opportunity could persist without `routeRepositoryId`.

The missing geometry was downstream of the missing reference. Open Opportunity correctly refused to regenerate geometry or fall back to runtime memory, but because no durable Route Repository object was linked, the map had no authoritative geometry to restore.

Attachment warnings were caused by generated OSRM routes having no uploaded source file. Restore validation previously checked only uploaded `attachments` or `sourceFiles`, so generated route evidence was incorrectly reported as missing. Generated routes now create immutable `GENERATED_ROUTE_AUDIT` evidence in the Route Repository.

## Complete Save Sequence

The repaired transaction is:

1. Generate Route.
2. Log vertices, length, geometry hash, and route status.
3. Create Commercial Route Repository snapshot.
4. Save Route Repository.
5. Reload Route Repository from repository storage.
6. Verify route repository id, vertex count, geometry, and geometry hash.
7. Store `Workspace.routeRepositoryId` in workspace state.
8. Build Opportunity snapshot with the verified route repository reference.
9. Preflight Opportunity save: route repository id, geometry, estimate, and workbook must exist.
10. Save Opportunity.
11. Reload Opportunity from repository storage.
12. Reload Route Repository from repository storage.
13. Verify Opportunity route reference and Route Repository geometry hash match memory.
14. Commit local workspace state only after verification succeeds.

If any required route transaction step fails, Opportunity save aborts. If a post-save verification fails, the workspace attempts to restore the previous Opportunity snapshot and does not commit the failed snapshot locally.

## Complete Restore Sequence

Open Opportunity now follows:

1. Opening Opportunity.
2. Load Opportunity Repository record.
3. Read `routeRepositoryId`.
4. Load Route Repository.
5. Verify geometry exists and hash is stable.
6. Hydrate Opportunity from Route Repository.
7. Validate Map.
8. Restore Estimate.
9. Restore Workbook.
10. Restore Proposal.
11. Restore Proposal Preview.
12. Restore Service Order Preview.
13. Restore Attachments or generated route evidence.
14. Render workspace.

The restore path does not call OSRM, regenerate geometry, rebuild the estimate, or fall back to runtime memory.

## Instrumentation

Structured route persistence audit events now log:

- Generate Route
- Route Repository creation
- Workspace route repository id verification
- Save Opportunity preflight
- Route Repository save/reload verification
- Opportunity save
- Immediate reload verification
- Commit
- Rollback
- Open Opportunity
- Loading Route Repository
- Component restore steps

A collapsed developer inspector was added inside Runtime / Diagnostics. It displays:

- Opportunity ID
- Route Repository ID
- Route Geometry ID
- Geometry Hash
- Vertex Count
- Length
- Estimate ID
- Workbook ID
- Proposal ID
- Attachment IDs
- Saved Timestamp
- Restored Timestamp

## Files Modified

- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/repositories/commercialRepositories.ts`
- `server/routes/commercial-routes.js`
- `cip014d-route-persistence-audit-validation.mjs`

## Validation Results

Run:

```bash
node hyperlinx-dal-dev/cip014d-route-persistence-audit-validation.mjs
node hyperlinx-dal-dev/cip014c-complete-opportunity-persistence-validation.mjs
npx tsc --noEmit -p hyperlinx-dal-dev/tsconfig.json
npm run build
```

The CIP-014D validation proves Route Repository record creation, `routeRepositoryId` persistence into Opportunity, durable geometry, geometry hash comparison before and after save, repository-backed open instrumentation, no geometry regeneration, no fallback to runtime memory, generated-route evidence handling, and no ScopeVersion creation.

Commercial Opportunities backed by generated A/Z OSRM routes now restore deterministically from the Opportunity Repository and Commercial Route Repository.
