# Prism Corridor Scoring Doctrine

Status: doctrine and contract creation only.

## Constitutional Rule

Prism evaluates corridor candidates. Prism does not approve corridor candidates.

Prism recommendations are not authority. Prism provides decision support. Human engineering review remains authoritative. Route Engineering creates executable truth.

## Chain Of Responsibility

```text
Translate
  -> normalized evidence
Corridor Synthesis
  -> corridor candidates
Prism
  -> deterministic recommendations
Promotion
  -> ScopeVersion drafts
Route Engineering
  -> executable truth
```

## Non-Goals

This phase does not:

- execute scoring.
- route.
- call APIs.
- persist results.
- create ScopeVersions.
- modify UI.
- modify kernel lifecycle, closure, completion, Control, Field, Twin, OI, or ScopeVersion execution contracts.

## Prism Output

Prism should eventually produce:

- category component scores.
- profile-weighted candidate scores.
- recommendations.
- ranking.
- diagnostics.
- evidence references.

Every score must remain explainable through evidence and category rationale.

## Authority Boundary

Prism may say:

```text
Recommended
Acceptable
Conditional
Not Recommended
Rejected
```

Prism may not:

- approve.
- promote.
- create execution truth.
- overwrite customer geometry.
- bypass human engineering review.

