# Prism Workspace Validation

Phase: 6.8I

## Google Workflow

Fixture:

- Google Texas AI Expansion

Expected:

- Opportunity context renders.
- Baseline Network context renders.
- Marketplace matches render.
- Route alternatives render.
- Recommendations remain advisory.

## Marketplace Match Example

Marketplace assets include:

- Edge GPU Facility
- DFW Data Center
- Texas Power Provider
- Regional Transport Provider
- DFW Carrier Hotel

Expected:

- Assets display as advisory marketplace opportunities.
- Review-required assets remain non-authoritative.

## Diversity Gap Example

When diverse protection is requested, Prism displays a diversity evidence gap requiring engineering review.

## Risk Example

Prism displays risk categories and mitigations without blocking or mutating workflow state outside its own fixture model.

## Cost Reduction Example

Marketplace leverage appears as a cost driver and recommendation when assets are available.

## Ready For Quote Example

Fixture:

- Ready For Quote Example

Expected:

- Status: `READY_FOR_QUOTE`
- Next Action: `GENERATE_PRELIMINARY_QUOTE`
- Generate quote button remains disabled / visual-only.

## Blocked Example

Fixture:

- Blocked Example

Expected:

- Status: `BLOCKED`
- Blockers appear in diagnostics.
- No quote readiness.

## Ryan Workflow

Ryan can view one opportunity, inspect advisory Prism output, understand blockers, and see quote readiness without leaving the opportunity-centered workflow model.

## Required Validation

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```

## Boundary Validation

- No API calls.
- No live reasoning.
- No persistence.
- No server routes.
- No lifecycle mutation.
- No authority mutation.
- No ScopeVersion creation.
- No Chicago/root production modifications.
