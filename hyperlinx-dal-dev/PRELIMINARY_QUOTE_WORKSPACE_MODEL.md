# Preliminary Quote Workspace Model

Phase: 6.8J

## Contracts

Created contracts:

- `src/quote/PreliminaryQuoteWorkspace.ts`
- `src/quote/PreliminaryQuoteWorkspaceSummary.ts`
- `src/quote/PreliminaryQuoteAssumption.ts`
- `src/quote/PreliminaryQuoteConfidence.ts`
- `src/quote/PreliminaryQuoteWorkspaceOrchestrator.ts`

## Workspace Sections

The workspace supports:

- Customer Summary
- Opportunity Summary
- Network Intent
- Protection Schema
- Reference Architecture
- Recommended Products
- Marketplace Inputs
- Estimated NRC
- Estimated MRC
- Estimated Term
- Assumptions
- Risks
- Confidence
- Diagnostics
- Next Action

## Readiness

Supported readiness values:

- `NOT_READY`
- `READY_FOR_QUOTE`
- `QUOTE_GENERATED`
- `BLOCKED`

## Required Inputs

Quote readiness requires:

- Opportunity exists.
- Translate complete.
- Scope Review approved.
- Prism complete or ready for quote.
- No critical blockers.

All inputs are fixture-driven in this phase.
