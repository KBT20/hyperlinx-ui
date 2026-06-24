# Prism Workspace Model

Phase: 6.8I

## Contracts

Created contracts:

- `src/prism/PrismWorkspace.ts`
- `src/prism/PrismWorkspaceStatus.ts`
- `src/prism/PrismWorkspaceSummary.ts`
- `src/prism/PrismAdvisoryCard.ts`
- `src/prism/PrismWorkspaceOrchestrator.ts`

## Workspace Sections

The workspace supports:

- Opportunity Summary
- Baseline Network Summary
- Marketplace Opportunities
- Candidate Facilities
- Candidate Sites
- Network Affinity
- Route Alternatives
- Cost Drivers
- Diversity Gaps
- Risks
- Recommendations
- Diagnostics

## Status

Prism status values:

- `DRAFT`
- `READY_FOR_PRISM`
- `ANALYZING`
- `READY_FOR_QUOTE`
- `BLOCKED`

## Quote Readiness

Prism is `READY_FOR_QUOTE` when:

- Baseline exists.
- Scope Review is approved or complete.
- No critical blockers exist.
- Recommendations are generated.

Readiness remains advisory and does not generate a quote.
