# Prism Score Normalization

Status: Phase 6.3A normalization doctrine.

## Score Range

All category scores are normalized to:

```text
0-100
```

The engine starts each category at 50 and adjusts with evidence contributions.

## Confidence Weighting

Evidence confidence changes contribution strength:

| Confidence | Weight |
| --- | --- |
| `VERY_LOW` | 0.2 |
| `LOW` | 0.4 |
| `MEDIUM` | 0.6 |
| `HIGH` | 0.8 |
| `VERIFIED` | 1.0 |

## Confidence Output

Category confidence is produced as:

- confidence label.
- confidence value.

Overall confidence is the average category confidence after conflict penalties.

## Missing Evidence

Missing evidence produces warnings.

Missing evidence does not fabricate scores.

## Conflict Penalty

Conflicting enrichment findings reduce confidence.

Conflicts do not auto-resolve and do not produce recommendations.

