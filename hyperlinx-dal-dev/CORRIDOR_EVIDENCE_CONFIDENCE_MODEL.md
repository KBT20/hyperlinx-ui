# Corridor Evidence Confidence Model

Status: doctrine and isolated scoring helper.

## Confidence Categories

| Category | Score range | Meaning |
| --- | ---: | --- |
| VERY_LOW | 0-24 | Weak, unknown, failed, or heavily conflicted evidence |
| LOW | 25-49 | Usable context but not enough for promotion |
| MEDIUM | 50-74 | Useful evidence with incomplete validation |
| HIGH | 75-89 | Strong source but not fully certified |
| VERIFIED | 90-100 | Human-reviewed, field-validated, or otherwise review-grade evidence |

## Default Examples

| Evidence source | Default category |
| --- | --- |
| Customer supplied route | HIGH |
| Human reviewed route | VERIFIED |
| OSRM generated route | MEDIUM |
| DOT jurisdiction data | HIGH |
| Unknown geometry | LOW |

## Additive Scoring

Confidence starts from the source registry default and adjusts for:

- geometry present.
- endpoint fields present.
- required fields present.
- human review.
- field validation.
- conflict count.
- unknown geometry.

## Conflict Handling

Conflicting evidence should not delete confidence and should not delete evidence.

Instead:

- create a warning.
- reduce confidence.
- preserve both evidence records.
- require human review before promotion.

## Implementation Reference

`src/corridor/CorridorConfidenceEngine.ts`

Exports:

- `scoreCorridorEvidenceConfidence()`
- `corridorConfidenceCategory()`
- `detectEvidenceConflicts()`

