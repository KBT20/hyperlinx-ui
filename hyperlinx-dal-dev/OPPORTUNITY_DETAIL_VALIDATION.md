# Opportunity Detail Validation

Phase: 6.8E

## Draft Opportunity

A draft opportunity without customer or opportunity context returns `DRAFT` or `BLOCKED` and next action `COMPLETE_INTAKE`.

## Ready-To-Launch Opportunity

An opportunity with customer, opportunity, network type, protection schema, and at least one location returns `READY_TO_LAUNCH_TRANSLATE` and next action `LAUNCH_TRANSLATE`.

## Baseline-Ready Opportunity

An opportunity with completed Translate and a ready Baseline Network Candidate returns `SCOPE_REVIEW_READY` and next action `OPEN_SCOPE_REVIEW`.

## Scope-Review-Ready Opportunity

An opportunity with a baseline candidate and pending review remains in Scope Review flow.

## Ready-For-Prism Opportunity

An opportunity with Scope Review `APPROVED_FOR_PRISM` returns `READY_FOR_PRISM` and next action `RUN_PRISM`.

## Quote-Ready Opportunity

An opportunity with Prism complete and Preliminary Quote ready returns `QUOTE_READY` and next action `PREPARE_CUSTOMER_DISCUSSION`.

## Blocked Opportunity

Missing location or protection returns `BLOCKED` and next action `ADD_LOCATIONS`, `SELECT_INTENT`, or `RESOLVE_BLOCKERS`.

## Google Workflow Example

```text
Google Texas AI Expansion
  -> AI_CORRIDOR
  -> DIVERSE
  -> Translate complete
  -> AI_CORRIDOR_DIVERSE_REFERENCE_ARCHITECTURE
  -> OPEN_SCOPE_REVIEW
```

## Ryan Workflow Example

```text
Ryan
  -> Customer Workspace
  -> Google
  -> Opportunity Detail
  -> Launch Translate
  -> Open Scope Review
  -> Run Prism
  -> Generate Preliminary Quote
```

## Validation Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```
