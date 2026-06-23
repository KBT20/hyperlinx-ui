# Prism Decision Precedence

Status: decision doctrine.

## Precedence Rules

Layer 1 supersedes all lower layers.

Layer 2 supersedes Layers 3-5.

Layer 3 supersedes Layers 4-5.

Layer 4 supersedes Layer 5.

Layer 5 only compares candidates that remain viable after higher layers.

## Rule Examples

### Exceptional Latency, Impossible Permitting

```text
Hard Exclusion: FAIL
Optimization: OPTIMAL
Decision: FAIL
```

The corridor fails because impossible permitting is a hard exclusion.

### Strong Monetization, No Power Availability

```text
Hard Exclusion: FAIL
Commercial: HIGH
Decision: FAIL
```

The corridor fails because power availability is mandatory for the stated objective.

### Moderate Revenue, Ideal AI Expansion

```text
Hard Exclusion: PASS
Strategic Fit: STRONG
Commercial: MEDIUM
Engineering: FAVORABLE
Optimization: GOOD
Decision: viable for future recommendation
```

This candidate may outperform a higher-revenue corridor if the higher-revenue corridor has weak AI strategic fit.

## Flat Scoring Prohibition

Prism must not flatten all categories into one weighted score before applying hierarchy.

Weighted scoring may occur inside layers in future phases, but layer precedence governs decision behavior.

