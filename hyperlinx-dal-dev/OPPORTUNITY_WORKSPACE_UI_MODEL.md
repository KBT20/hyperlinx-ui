# Opportunity Workspace UI Model

Phase: 6.8H

## Workspace Source

The UI consumes the existing `OpportunityDetailWorkspace` model from `src/opportunity/OpportunityDetailWorkspace.ts`.

Primary fields displayed:

- `summary.customerName`
- `summary.opportunityName`
- `summary.networkType`
- `summary.protectionSchema`
- `summary.currentStatus`
- `opportunity.locations`
- `opportunity.attachments`
- `statusCards`
- `nextAction`
- `stageContext.baselineNetwork`
- `stageContext.scopeReviewStatus`
- `stageContext.prismStatus`
- `stageContext.preliminaryQuoteStatus`

## UI Sections

- Header
- Customer / Opportunity Summary
- Network Intent
- Locations
- Attachments
- Baseline Network
- Workflow Cards
- Next Action
- Advanced Diagnostics

## Fixture Contract

The workspace renders `googleTexasAiExpansionWorkspace` by default and allows switching between existing opportunity workspace fixtures. Fixture switching is local React state only.

## Non-Authority Flags

The UI displays fixture-only and non-authoritative signals. Buttons are visual-only and disabled when they imply future execution.
