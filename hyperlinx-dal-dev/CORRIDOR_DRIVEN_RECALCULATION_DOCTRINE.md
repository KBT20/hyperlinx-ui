# Corridor-Driven Recalculation Doctrine

Audit date: June 26, 2026

Scope: Hyperlinx DAL Commercial Planning Workspace.

Status: DAL doctrine and UI behavior. No production authority, no ScopeVersion authority, no inventory mutation, no workbook write, no external submission.

## Doctrine

The active Proposal Corridor is the commercial authority for the selected pricing scope.

The Original Corridor is immutable and remains available only for comparison, route review, and revision history. It does not drive the active commercial plan after a proposal revision is saved.

When a Sales user saves a proposal corridor revision, the workspace must regenerate every downstream commercial object from the revised corridor. No derived quantity or dollar value may remain sourced from the previous active corridor.

## Recalculation Event

A successful Save Revision performs this event:

```text
Save Revision
  -> OSRM resnap
  -> Proposal Corridor replacement
  -> StationedCorridor replacement
  -> CorridorTakeoff replacement
  -> ProposedGraph replacement
  -> Bid plan rebuild
  -> SelectedScopePricingSummary regeneration
  -> Preview, readiness, vendor response, and supporting information refresh
```

During the save operation, the workspace displays:

```text
Recalculating Commercial Plan...
```

Derived commercial panels must not keep stale numbers visible while the revised corridor is becoming active.

## Required Chain

Every saved proposal corridor revision regenerates:

```text
Proposal Corridor
  -> Stationing
  -> Construction Strategy Quantities
  -> Crossings
  -> Vaults
  -> Handholes
  -> Slack
  -> Purchased Fiber
  -> Standard Duct Package
  -> FuturePath, if enabled
  -> Reel Count
  -> Butt Splice Locations
  -> Splice Cases
  -> Splicing Labor
  -> ILA / Regen Placement
  -> OSP Segment Pricing
  -> Commercial Summary
  -> Vendor Response Preview
  -> Submission Readiness
  -> Supporting Information
```

## Runtime Rule

Commercial Planning reads route quantities from the active `GoogleRfpRouteBidPlan.stationedCorridor.takeoff`.

`SelectedScopePricingSummary` is the single commercial authority for active pricing output. It must be rebuilt from the selected route plans after a saved corridor revision replaces the active route plan.

The workspace may display the Original Corridor for Compare, but it must not use Original Corridor quantities for active commercial values after a revision is saved.

## Non-Authority

This doctrine does not create:

- ScopeVersion truth;
- CertifiedRoute evidence;
- inventory graph mutation;
- lifecycle transition;
- marketplace execution;
- Control work authority;
- Field work authority;
- Twin projection authority;
- Operational Intelligence authority.

All outputs remain budgetary, advisory, and pending Route Engineering validation.
