# Opportunity Next Action Model

Phase: 6.8E

Next Action is deterministic and derived from the current opportunity state.

## Rules

- Missing customer or opportunity: `COMPLETE_INTAKE`
- Missing network type or protection schema: `SELECT_INTENT`
- Missing locations: `ADD_LOCATIONS`
- Intake ready: `LAUNCH_TRANSLATE`
- Baseline ready: `OPEN_SCOPE_REVIEW`
- Review approved: `RUN_PRISM`
- Prism complete: `GENERATE_PRELIMINARY_QUOTE`
- Quote ready: `PREPARE_CUSTOMER_DISCUSSION`
- Blocked: `RESOLVE_BLOCKERS`

Next actions point to a target workspace. They do not invoke execution, persistence, or authority transitions.
