# SPRINT_20F_SPINE_AUDIT_PROJECTION_REPORT

## Executive Summary

Sprint 20F projects the Commercial Estimate Audit onto the Measured Spine and Station Authority.

The audit no longer exists as separate commercial metadata. It becomes stationed authority attached to:

- spine ranges
- station ranges
- station-attached engineering objects
- review objects
- closure expectations

ScopeVersion, Service Order, Field, and Operational Twin remain out of scope.

## Audit Projection Model

Added:

- `src/spine/SpineAuditProjectionContracts.ts`
- `src/spine/SpineAuditProjectionEngine.ts`

The engine reads commercial audit entries, Product Doctrine quantity fallbacks, pricing summaries, object station attachments, station authority, station-indexed graph, and unknown review items.

It classifies audit items as:

- `SPINE_WIDE`
- `SEGMENT_RANGE`
- `STATION_OBJECT`
- `STATION_RANGE`
- `COST_ONLY`
- `SCHEDULE_ONLY`
- `LIFECYCLE`
- `CONFIDENCE_REVIEW`
- `UNKNOWN_REVIEW`

It then creates:

- `spineAuditProjection`
- `spineAuditAttachments`
- `stationedExpectations`
- `stationRangeExpectations`
- `spineReviewObjects`
- `closureExpectations`
- `auditProjectionSummary`

## Spine Enrichment Model

Updated:

- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/api/teralinxRuntime.ts`

Draft IOF Package assembly now creates the audit projection after measured spine, station authority, station-indexed graph, and object station attachments exist.

The enriched package persists:

- measured spine authority
- station authority
- station-to-coordinate map
- object station attachments
- station-indexed graph
- audit projection artifacts
- closure expectations

Product Configurator packages also receive audit projection fallback records from PD-001 quantity and pricing summaries.

## Station Expectation Model

Stationed expectations are created for station-attached engineering objects such as:

- handholes
- ILAs
- regen huts
- splice cases
- vaults
- pull points
- markers

Each expectation records station ID, station label, measure, coordinate, expected work, expected quantity, expected cost where available, evidence placeholders, and `NOT_STARTED` closure status.

## Range Expectation Model

Range expectations are created for route work such as:

- plow
- directional bore
- open trench
- conduit placement
- fiber placement

Each range binds audit data to from/to stations, measures, spine segments, quantity feet, production rate, expected cost, schedule impact, and closure evidence placeholders.

## Closure Expectation Model

Closure expectations are created for:

- station objects
- station ranges
- review objects
- spine-wide expectations

Field closure is not implemented. Sprint 20F only creates closure-ready expectations with current status `NOT_STARTED`.

## Map Visualization Changes

Updated:

- `src/commercial/CommercialStationReviewEngine.ts`
- `src/components/commercial/StationAwareObjectReviewPanel.tsx`

Commercial Review now supports map modes:

- Route View
- Engineering Review View
- Field Preview View

Route View shows route and major stations only.

Engineering Review View shows measured spine, station ranges with audit overlays, engineering objects, major stations, and review markers.

Field Preview View shows closure-ready expectations and station/object/review context without creating a Field workflow.

Dense station labels are suppressed by mode to avoid clutter.

## Station Click Behavior

Clicking a station in the Commercial Review map now drives a Station Expectation Panel.

The panel shows:

- station ID
- station label
- measure feet
- coordinate
- attached objects
- expected work
- audit-derived closure expectations
- unresolved review items
- required evidence placeholders
- current status `NOT_STARTED`

## Baseline And Redline Rule

Updated:

- `server/routes/commercial-iof-packages.js`

Before Engineering submission, Commercial audit projection updates live with Draft IOF Package changes.

On submit to Engineering, the server freezes the commercial audit projection baseline:

- `baselineState = FROZEN`
- `baselineFrozenAt`
- `baselineProjectionId`
- `commercialBaselineFrozen = true`

Future redlines are represented as deltas against the frozen baseline. The original baseline is not mutated.

## PD-001 Compliance

Updated:

- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/engineering/EngineeringCertificationProjection.ts`

PD-001 compliance now includes audit projection checks:

- audit projection exists
- closure expectations exist
- cost-bearing audit lines are attached
- Engineering compliance displays audit projection status

Warnings remain valid for unknown review items and confidence review items. Cost-bearing unattached lines fail.

## Validation Results

Commands run:

- `npx tsc --noEmit`: PASS
- `node sprint20f-spine-audit-projection-validation.mjs`: PASS, 45 checks
- `npm run build`: PASS

Build note: Vite reported the existing large chunk warning after a successful build.

## Validation Coverage

The Sprint 20F validation confirms:

- audit entries load
- plowing projects to station range
- directional bore projects to station range
- conduit projects to spine/range
- fiber projects to spine/range
- handholes project to station objects
- ILA facilities project to station objects
- splice cases project to station objects
- lifecycle items attach to spine
- unknown railroad crossing creates review object
- unknown rock percentage creates review object
- closure expectations are created
- station click can retrieve expected work
- Draft IOF Package persists projection
- baseline freezes after approval/submission
- redline creates delta and does not mutate baseline
- ScopeVersion is not created

## Remaining Gaps Before ScopeVersion

Remaining gaps:

- Engineering must decide whether unknown review objects block certification or become accepted exceptions.
- Engineering redline acceptance must generate formal audit projection deltas from accepted geometry/object changes.
- Certified IOF Package must preserve frozen commercial baseline plus accepted Engineering deltas.
- ScopeVersion must consume only certified stationed expectations, not live Commercial review state.
- Field must later close against ScopeVersion expectations, not Draft IOF Package expectations.

## Constitutional Result

The Commercial Estimate Audit now projects onto the measured spine.

Audit items resolve to stations, engineering objects, station ranges, spine-wide obligations, or review objects.

The map can show enriched spine data without rendering thousands of labels.

Clicking a station shows expected work and audit-derived closure expectations.

Commercial submission freezes the enriched spine baseline.

Future redlines can be measured against that baseline.

ScopeVersion remains out of scope.
