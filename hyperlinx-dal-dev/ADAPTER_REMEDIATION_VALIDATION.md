# Adapter Remediation Validation

Phase: 6.7C

## Implemented Files

- `src/adapters/AdapterGap.ts`
- `src/adapters/AdapterRemediation.ts`
- `src/adapters/AdapterRemediationEngine.ts`
- `src/adapters/fixtures/adapterRemediationFixtures.ts`

## Gap Examples

Fixtures cover:

- Missing customer mapping
- Missing lifecycle mapping
- Missing close mapping
- Missing marketplace mapping
- Legacy object mapping
- Authority mismatch
- Partial alignment
- Full alignment
- Critical gap
- Production-ready runtime

## Normalization Examples

Lifecycle:

```text
RELEASED_TO_CONTROL -> CONTROL
ACTIVATED -> CONTROL_ACTIVE
IN_FIELD -> FIELD
```

Close:

```text
FIELD_CLOSURE -> FIELD_CLOSE
CONTROL_ACTIVATED -> CONTROL_CLOSE
```

Marketplace:

```text
candidateId -> budgetCandidateId
```

## Reconciliation Examples

`reconcileLifecycle()` identifies missing, legacy, and unmapped lifecycle values.

`reconcileClosures()` identifies missing, legacy, duplicate, and unmapped close labels.

`reconcileTraceability()` identifies missing customer, opportunity, corridor, and ScopeVersion references.

## Remediation Plans

`generateRemediationPlan()` returns:

- Gap
- Severity
- Recommended Adapter
- Required Mapping
- Owner
- Risk
- Priority

Plans are recommendations only.

## Production Readiness Summary

The remediation layer can convert adapter and shadow runtime gaps into bounded remediation plans. It does not write to DAL, create ScopeVersions, create closes, alter lifecycle, or mutate authority.

## Required Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```
