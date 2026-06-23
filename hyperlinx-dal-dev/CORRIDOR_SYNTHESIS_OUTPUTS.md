# Corridor Synthesis Outputs

Status: doctrine and type contract.

## Output Object

Corridor Synthesis outputs `CorridorCandidate[]`.

Implementation contract:

- `src/corridor/CorridorCandidate.ts`
- `src/corridor/CorridorSynthesisContract.ts`

## Candidate Types

| Type | Purpose |
| --- | --- |
| PRIMARY | Most direct candidate intended to satisfy the customer ask |
| DIVERSE | Route intended to provide physical or operational diversity |
| LOW_LATENCY | Candidate optimized around distance or expected latency evidence |
| LOW_COST | Candidate expected to minimize cost evidence |
| LOW_RISK | Candidate expected to reduce permit, crossing, ROW, or construction risk |
| EXPANSION | Candidate designed around future expansion and residual capacity |
| AI_CORRIDOR | Candidate emphasizing power, data center, cloud, interconnect, and future AI demand signals |
| CUSTOMER_SUPPLIED | Candidate preserving customer-supplied geometry |
| HYBRID | Candidate combining customer, provider, GIS, and/or human evidence |

## Required Candidate Fields

Each candidate should include:

- candidate ID.
- corridor ID.
- candidate type.
- candidate source.
- endpoint references.
- requirement references.
- geometry.
- provider IDs.
- source evidence IDs.
- preserved customer route evidence IDs.
- segments.
- attributes.
- diversity group and evidence when available.
- score placeholder.
- promotion eligibility flag.

## Score Placeholder

Synthesis does not score.

It may create a score placeholder:

```text
UNSCORED
PRISM_PENDING
HUMAN_REVIEW_PENDING
```

Prism owns scoring in a later phase.

## Diagnostics

Synthesis result should include diagnostics for:

- unsupported inputs.
- missing evidence.
- conflicting geometry.
- unsupported provider.
- preserved customer geometry.
- diversity uncertainty.

