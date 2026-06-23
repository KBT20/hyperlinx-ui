# Prism Recommendation Method

Prism Recommendation V1 converts scoring, decision hierarchy, architecture fit, lens context, and design standards into an advisory recommendation.

## Recommendation Levels

- RECOMMENDED
- ACCEPTABLE
- CONDITIONAL
- NOT_RECOMMENDED
- REJECTED

## Rules

If Hard Exclusion fails:

`recommendationLevel = REJECTED`

If Hard Exclusion requires review:

`recommendationLevel = CONDITIONAL`

If Strategic Fit is weak:

`recommendationLevel = NOT_RECOMMENDED` or `CONDITIONAL`

If scores are strong but required tools, evidence, design standards, or reviews are missing:

`recommendationLevel = CONDITIONAL`

If score is strong, evidence confidence is strong, reference architecture fit is strong, and no major blockers exist:

`recommendationLevel = RECOMMENDED`

If score is acceptable but risks exist:

`recommendationLevel = ACCEPTABLE` or `CONDITIONAL`

## Non-Authority Rule

Recommendation does not promote.

Recommendation does not approve.

Recommendation does not persist.

Recommendation does not create ScopeVersions.

Recommendation does not create execution work.
