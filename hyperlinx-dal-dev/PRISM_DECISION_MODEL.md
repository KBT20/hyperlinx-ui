# Prism Decision Model

Status: doctrine only.

## Recommendation Levels

| Level | Meaning |
| --- | --- |
| RECOMMENDED | Strong candidate for human engineering review |
| ACCEPTABLE | Candidate appears usable but may not be optimal |
| CONDITIONAL | Candidate requires blockers, evidence gaps, or assumptions to be resolved |
| NOT_RECOMMENDED | Candidate is weak, risky, or misaligned |
| REJECTED | Candidate should not proceed without substantial change |

## Decision Doctrine

Prism never approves.

Prism never promotes.

Prism recommends.

Route Engineering approves.

## Required Decision Evidence

Every recommendation should retain:

- profile ID.
- category components.
- evidence IDs.
- diagnostics.
- blockers.
- recommendation summary.
- human review requirement.

## Human Review Boundary

Human engineering may accept, reject, or override a Prism recommendation. Any override should create human review evidence.

## Ranking Rule

Ranking is a decision-support view. It is not lifecycle state, promotion state, or execution truth.

