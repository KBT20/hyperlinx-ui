# Opportunity Workflow Panel Model

Phase: 6.8H

## Cards

The workflow panel renders existing `OpportunityStatusCard` records:

- Intake
- Translate
- Baseline Network
- Scope Review
- Prism
- Preliminary Quote

Each card displays:

- Status
- Summary
- Blockers
- Next action when assigned
- Last updated timestamp

## Status Semantics

- `COMPLETE` and `READY` display as pass.
- `BLOCKED` displays as fail.
- `NOT_STARTED` and `IN_PROGRESS` display as warning.

## Panel Doctrine

The panel summarizes workflow readiness only. It does not launch Translate, open Scope Review, run Prism, generate quotes, or mutate state.

## Next Action

The next action is sourced from the existing opportunity orchestrator. Examples:

- `SELECT_INTENT`
- `SELECT_PROTECTION`
- `LAUNCH_TRANSLATE`
- `GENERATE_BASELINE`
- `OPEN_SCOPE_REVIEW`
- `RUN_PRISM`
- `GENERATE_PRELIMINARY_QUOTE`
- `RESOLVE_BLOCKERS`
