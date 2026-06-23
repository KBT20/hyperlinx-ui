# Corridor Route Engineering Review Model

Route Engineering is the authority that turns corridor evidence and standards into executable design decisions.

This phase defines the review boundary only. It does not implement a review workflow.

## Inputs

Route Engineering may review:

- normalized evidence
- corridor objects
- corridor lens context
- object design standards
- lens design standards
- standards exceptions
- customer requirements
- provider evidence
- Prism advisory scores

## Route Engineering Owns

Route Engineering owns:

- design validation
- redlines
- route certification
- object approval
- standards exceptions
- optical and topology review
- capacity availability review
- ScopeVersion handoff

## Sales May Define

Sales may define:

- customer
- endpoints
- desired service
- commercial target
- preferred lens
- product intent

## Sales May Not Define

Sales may not define:

- regen spacing
- ADM placement
- optical reach
- restoration design
- route diversity sufficiency
- engineering feasibility
- final capacity availability
- permitting assumptions as truth

## Review Outputs

Potential review outputs:

- approved standard
- rejected standard
- redline
- requested evidence
- approved exception
- rejected exception
- engineering hold
- ScopeVersion handoff readiness

No review persistence or workflow is implemented here.

## Exception Model

DesignStandardException fields:

- exceptionId
- standardId
- objectId
- reason
- requestedBy
- reviewedBy
- status
- evidenceIds
- notes

Status values:

- REQUESTED
- APPROVED
- REJECTED
- SUPERSEDED

## Rule

Prism may explain why a corridor looks attractive.

Route Engineering determines whether the corridor can be engineered.
