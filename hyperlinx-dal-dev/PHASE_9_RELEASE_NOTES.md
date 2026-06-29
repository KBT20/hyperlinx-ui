# Phase 9 Release Notes

Date: 2026-06-28
Milestone: Intelligent ILA Placement and Station-Based Facility Planning, plus pre-commit DAL doctrine audit context.

## What Was Added

- Customer design import and library workflow for staged customer route/design evidence.
- Opportunity and commercial planning flows that can restore active planning state.
- Transparent estimate authoring with algorithm review, human overrides, approval states, audit events, and live recalculation.
- `CommercialFinancialAuthority` for canonical construction cost, direct cost, sell price, margin, NRC/MRC, lifecycle revenue, cost/mile, cost/foot, revenue/mile, and margin/mile metrics.
- `IlaPlanningEngine` for station-based ILA placement from active route geometry, bookend controls, station counts, facility profiles, station overrides, optical spans, and cost profiles.
- ILA station table, graph-style planning view, and map station overlays with synchronized station selection.
- Sales Engineering / corridor candidate support and Route Engineering draft/revision handoff workflow.
- Design persistence and handoff state through DAL shared state and DAL storage.

## Key Workflows Now Supported

1. Import customer design evidence and preserve provenance without creating ScopeVersion truth.
2. Price a customer route as a commercial draft.
3. Review transparent estimate values, enter human values, approve overrides, restore algorithm values, and inspect estimate audit history.
4. Adjust civil mix controls in automatic or manual modes.
5. Generate ILA stations from route stationing and route geometry.
6. Enable or disable bookend ILAs and immediately update totals.
7. Set desired intermediate ILA count and redistribute stations.
8. Reposition ILA stations along the active corridor through station overrides.
9. Change ILA facility profile and update station cost, route cost, optical spans, and financial metrics.
10. Select a station and synchronize table, planning graph, and map markers.
11. Hand a commercial draft into Route Engineering for revision/candidate work.

## Validation Performed

Validation completed for this audit pass:

- `npm.cmd run typecheck`: PASS
- `npm.cmd run build`: PASS, with Vite large chunk warning for the main JavaScript bundle.
- `git diff --check -- hyperlinx-dal-dev`: PASS, with Git LF-to-CRLF working-copy normalization warnings on existing touched files.

## Known Limitations

- ScopeVersion lifecycle authority is split between older lifecycle guard logic and newer close-event lifecycle doctrine.
- Commercial Planning still owns too much workflow and authority logic inside UI components.
- Customer Design Library persistence is local DAL storage, not a server-backed source of record.
- ILA planning is station-based and cost-profile-driven, but engineering revision recommendation approval still needs a stronger station diff workflow.
- Route Engineering optical/spacing preview assumptions should be unified with `IlaPlanningEngine`.
- Map overlays are reactive, but stale-geometry regression tests should be added before relying on map display as a review artifact.
- The current system should not be treated as production Control, Field, Twin, or OI authority.

## What Ryan Should Test

- Import a customer design, leave the workspace, return, and confirm the design persists.
- Price an imported route and confirm the commercial draft opens without creating ScopeVersion or inventory authority.
- Edit transparent estimate values, approve them, restore algorithm values, and confirm audit history is retained.
- Toggle civil mix automatic/manual modes and verify automatic totals stay at 100 while manual mode only warns.
- Toggle ILA bookends, change intermediate station count, change facility profile, and confirm financial cards update.
- Move an ILA station and confirm station, GPS, span, optical loss, map marker, and station table selection stay in sync.
- Hand a commercial route into Route Engineering, create or select a candidate, and verify revision state is preserved.
- Attempt ScopeVersion approval without certified route evidence and confirm the gate blocks it.

## What Should Not Be Trusted Yet

- Production ScopeVersion lifecycle closure until lifecycle convergence is complete.
- Customer Twin mutation from commercial or imported customer evidence.
- Control, Field, Marketplace, or OI execution from commercial planning actions.
- Final optical engineering, construction quantities, or permitting outputs without engineering review.
- Server durability of customer design library records.

## Recommended Next Sprint

1. Collapse ScopeVersion lifecycle mutation onto close-event transition authority.
2. Move civil mix, estimate override, and commercial audit mutations from UI into dedicated engines/reducers.
3. Server-back Customer Design Library and commercial-to-engineering handoff records.
4. Complete ILA recommendation approval for engineering revisions: added, removed, moved, cost delta, optical delta, and lifecycle delta.
5. Add regression tests for financial authority metrics and map/station synchronization.
