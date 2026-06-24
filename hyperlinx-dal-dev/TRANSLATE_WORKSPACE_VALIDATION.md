# Translate Workspace Validation

Phase: 6.8F

## Blocked Translate

Missing customer, opportunity, intent, protection, architecture, or baseline objects blocks Scope Review readiness.

## Missing Protection

An opportunity with network type but no protection returns `INTENT_SELECTED` and next action `SELECT_PROTECTION`.

## Missing Intent

An opportunity with no network type returns `INTAKE` and next action `SELECT_NETWORK_TYPE`.

## Baseline Synthesized

An opportunity with intent and protection generates a Baseline Network Candidate using architecture selection and baseline synthesis.

## Ready For Review

An opportunity with:

- opportunity context
- network type
- protection
- reference architecture
- baseline objects

returns `READY_FOR_SCOPE_REVIEW` and next action `OPEN_SCOPE_REVIEW`.

## Google Workflow

```text
Google Texas AI Expansion
  -> AI_CORRIDOR
  -> DIVERSE
  -> AI_CORRIDOR_DIVERSE_REFERENCE_ARCHITECTURE
  -> Scope Review Ready
```

## Ryan Workflow

```text
Ryan
  -> Opportunity Detail
  -> Launch Translate
  -> Translate Workspace
  -> Generate Baseline
  -> Open Scope Review
```

## Validation Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```
