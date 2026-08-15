# CIP-023 Route Edit Session, Delta Patch Engine, and Crash Isolation Report

Date: 2026-07-07

## Objective

Fix runtime instability caused by editing assembled commercial routes. Operator edits now become patches inside a Route Edit Session. Patches create projections. Only explicit Save Revision commits a patch set.

No ScopeVersion, Engineering Certification authority, repository truth, proposal lifecycle, pricing formulas, or route generation behavior was changed.

## Root Cause

Commercial edit controls were writing directly into shared estimate and route-control state. Removing bookends, moving ILAs, changing rates, or changing assumptions could trigger broad route, ILA, workbook, and map recalculation in the same render cycle. Invalid intermediate states could then surface as runtime crashes or lag.

The fix is to isolate edits from assembled route truth.

## Route Edit Session Architecture

Created `src/routeEdit`:

- `RouteEditSession`
- `RouteEditPatch`
- `RouteEditProjection`
- `RouteEditReducer`
- `RouteEditImpactEngine`

The session stores:

- assembled route snapshot metadata
- base estimate
- base controls
- staged patches
- failed patch diagnostics
- projected estimate
- projected controls
- recalculation impact report

The assembled route object is not mutated.

## Patch Model

Supported patch types:

- `REMOVE_BOOKEND`
- `RESTORE_BOOKEND`
- `MOVE_BOOKEND`
- `MOVE_ILA`
- `REMOVE_ILA`
- `RESTORE_ILA`
- `CHANGE_PLOW_RATE`
- `CHANGE_BORE_RATE`
- `CHANGE_TRENCH_RATE`
- `CHANGE_ROCK_RATE`
- `CHANGE_CONSTRUCTION_MIX`
- `CHANGE_SEGMENT_UNIT_COST`
- `EXCLUDE_SEGMENT`
- `RESTORE_SEGMENT`
- `ADD_MANUAL_COST_ADJUSTMENT`
- `REMOVE_MANUAL_COST_ADJUSTMENT`
- `CHANGE_MARGIN_ASSUMPTION`
- `CHANGE_MONTHLY_REVENUE`
- `CHANGE_TERM_MONTHS`

Every patch is marked `noRepositoryCommit: true`.

## Projection Model

The projection layer derives:

- projected controls
- projected ILA station visibility
- projected affected spans
- excluded station IDs
- excluded segment IDs
- moved station IDs
- estimate deltas
- affected domains and sections

Projection does not call OSRM, rebuild KMZ/KML projections, re-import inventory, or rebuild the assembled route.

## Bookend Removal Handling

Bookend removal creates a `REMOVE_BOOKEND` patch.

The projection:

- excludes start/end bookend stations from visible station projection
- filters affected spans
- updates the route edit summary
- records an estimate delta
- marks the recalculation boundary as affected spans only

The original route and Route Repository geometry remain intact.

## Rate Change Handling

Plow, bore, trench, rock, margin, revenue, and term changes are staged as estimate-domain patches.

The impact engine marks these as `ESTIMATE_DOMAIN_ONLY`.

Geometry, stationing, route repository records, and inventory are untouched.

## ILA Edit Handling

ILA movement/removal/restoration creates `MOVE_ILA`, `REMOVE_ILA`, or `RESTORE_ILA` patches.

The projection updates only:

- selected/moved station IDs
- visible station IDs
- affected spans
- ILA controls in the projected estimate

Unaffected spans are preserved.

## Recalculation Boundaries

The impact engine always reports:

- `fullRouteRebuild: false`
- `fullWorkbookRecalculation: false`
- `inventoryReimport: false`
- `kmzProjectionRebuild: false`
- `mapFullRerender: false`

Patch categories map to:

- `PATCH_ONLY`
- `AFFECTED_SPANS_ONLY`
- `ESTIMATE_DOMAIN_ONLY`

## Crash Isolation Strategy

Route edit application uses `safeApplyRouteEditPatch()`.

If a patch fails:

- original route remains intact
- edit session is preserved
- patch failure is recorded
- operator-safe message is shown
- projection continues from the last valid state

## Commercial UI

Commercial Planning now shows a Route Edit Session panel with:

- Start Edit
- Save Revision
- Compare Revision
- Restore Original
- Discard Revision

Save Revision commits only a patch-set revision into Opportunity revision history. It does not overwrite route geometry, estimate snapshots, or Route Repository truth.

## Files Modified

- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/routeEdit/RouteEditSession.ts`
- `src/routeEdit/RouteEditProjection.ts`
- `src/routeEdit/RouteEditReducer.ts`
- `src/routeEdit/RouteEditImpactEngine.ts`
- `src/routeEdit/index.ts`
- `cip023-route-edit-session-validation.mjs`
- `CIP_023_ROUTE_EDIT_SESSION_DELTA_PATCH_ENGINE_REPORT.md`

## Validation Results

Validation script:

`node cip023-route-edit-session-validation.mjs`

Result:

PASS

TypeScript:

`npx tsc --noEmit -p tsconfig.json`

Result:

PASS

Production build:

`npm run build`

Result:

PASS

Diff whitespace:

`git diff --check`

Result:

PASS

## Confirmation

CIP-023 is crash-isolation and performance stability work. It does not create ScopeVersion, change Engineering Certification authority, change proposal lifecycle, mutate Route Repository truth during local edits, or alter pricing formulas.
