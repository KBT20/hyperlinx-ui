# Opportunity Workspace UI Validation

Phase: 6.8H

## Rendered Google Opportunity

Default fixture:

- Customer: Google
- Opportunity: Google Texas AI Opportunity
- Network Type: `AI_CORRIDOR`
- Protection: `DIVERSE`
- Translate: `COMPLETE`
- Baseline Network: `READY_FOR_SCOPE_REVIEW`
- Next Action: `OPEN_SCOPE_REVIEW`

## Blocked Opportunity

Fixtures:

- Blocked Opportunity Missing Location
- Blocked Opportunity Missing Protection

Expected:

- Status displays `BLOCKED`.
- Blockers appear in workflow cards and advanced diagnostics.
- Next action resolves to blocker remediation.

## Ready For Translate

Fixture:

- Google Oklahoma AI Opportunity

Expected:

- Translate is ready or not started depending on fixture stage.
- Next action remains fixture-derived.

## Ready For Scope Review

Fixture:

- Google Texas AI Opportunity

Expected:

- Baseline Network is ready.
- Next action displays `OPEN_SCOPE_REVIEW`.
- No ScopeVersion is created.

## Ready For Prism

Fixture:

- Oracle GPU Expansion Opportunity

Expected:

- Scope Review status displays `APPROVED_FOR_PRISM`.
- Next action displays `RUN_PRISM`.

## Quote Ready

Fixture:

- Quote-ready Google Texas AI fixture

Expected:

- Prism displays complete.
- Preliminary Quote displays ready.
- Next action displays customer discussion readiness.

## Build Validation

Required commands:

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```

## Boundary Validation

- No API calls.
- No persistence.
- No server routes.
- No lifecycle changes.
- No authority changes.
- No Chicago/root production modifications.
