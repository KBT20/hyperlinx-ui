# SPRINT 20A - Engineering Certification Twin Report

## Summary

Sprint 20A projects the Commercial-owned Draft IOF Package into Engineering Certification as the Sales-to-Operations gate. Engineering now opens the persisted Draft IOF Package artifact, renders its route/spine/stations/objects on the Engineering Canvas, reviews PD-001 compliance, manages constraints, records object moves/redlines/doctrine exceptions, and creates a Certified IOF Package through the `CERTIFY PACKAGE` action.

## Files Changed

- `src/engineering/EngineeringCertificationProjection.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/workspaces/RouteEngineeringWorkspace.tsx`
- `src/api/teralinxRuntime.ts`
- `src/dal/DALState.tsx`
- `src/dal/DALNavigation.tsx`
- `src/dal/DALApp.tsx`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/styles.css`
- `server/routes/engineering-certification.js`
- `sprint20a-engineering-certification-twin-validation.mjs`
- `SPRINT_20A_ENGINEERING_CERTIFICATION_TWIN_REPORT.md`

## Draft IOF Package Intake

Commercial still assembles and persists the Draft IOF Package. Opening or handing off that package now sets shared DAL state and navigates to Engineering Certification. The Engineering workspace consumes `DraftIofPackageRuntime` through `openDraftIofPackageForCertification` and queue selection, not Commercial Corridor Draft state.

## Engineering Canvas Projection

`EngineeringCertificationProjection` reads route/centerline/spine/station/object artifacts from the Draft IOF Package and converts them to MapKernel render primitives. The canvas does not regenerate route geometry, recalculate a route, or create a ScopeVersion at intake. Station labels support hidden, major-station, and dense engineering label modes.

## Doctrine Compliance

The right panel shows PD-001 categories for geometry, spine, stationing, graph, objects, structures, conduit, fiber, ILA/regen facilities, crossings, quantities, pricing summary, O&M, constraints, and engineering readiness. Status values are `PASS`, `WARNING`, `FAIL`, or `PENDING`.

## Constraint Queue

Engineering constraints are persisted on the Draft IOF Package via `/constraints`. Supported categories match the sprint list. Each record carries id, station/range, object reference, severity, status, disposition, notes/evidence, actor, and timestamps.

## Object Move Behavior

Object moves are limited to station-attached objects such as ILA/regen facilities, vaults, handholes, splice cases, markers, and pull points. The server changes only the object's station reference and records previous station, new station, distance delta, reason, authority, actor, timestamp, impact summary, and engineering revision metadata. Stations are not moved.

## Redline Behavior

Route redlines are persisted through `/route-redlines`. Each redline creates new engineering revision metadata and increments Draft IOF package revision metadata. The redline record lists the governed regeneration scope required before ScopeVersion promotion; Commercial Revision 0 remains immutable.

## Certification Behavior

The primary action is `CERTIFY PACKAGE`. The UI batch-certifies any remaining proposed IOF units as part of that action, builds the engineering checklist, and calls the existing certification endpoint. The server now blocks certification when constraints are unresolved or PD-001 failures lack approved doctrine exceptions. The Certified IOF Package includes source draft reference, engineering actor/timestamp, constraints reviewed, exceptions approved, redline history, object move history, final engineering manifest, and readiness for ScopeVersion promotion.

## Validation Results

- `npx tsc --noEmit` - PASS
- `node sprint20a-engineering-certification-twin-validation.mjs` - PASS, 10 checks
- `npm run build` - PASS

Build note: Vite reported the existing large bundle chunk warning after minification.

## Known Gaps

- Existing server behavior still auto-generates a ScopeVersion during package certification. This sprint documents that behavior and does not add new ScopeVersion generation paths.
- Route redline acceptance/regeneration is recorded as governed revision metadata; the actual route/centerline/spine/station/object/quantity/pricing regeneration workflow remains a future sprint.
- Constraint resolution editing is not yet a full workflow; constraints can be added and certification honors resolved/accepted status.

## Next Recommended Sprint

Build the governed Certified IOF Package to ScopeVersion promotion workflow: explicit promotion action, redline acceptance/regeneration, immutable Certified IOF manifest comparison, ScopeVersion creation without implicit side effects, and then a Service Order preparation gate.
