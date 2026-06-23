# Prism Scoring Method

Status: Phase 6.3A method doctrine.

## Method

Each category starts from a neutral score of 50.

Evidence can increase or decrease category scores.

Evidence contributions are weighted by confidence:

- `VERY_LOW`
- `LOW`
- `MEDIUM`
- `HIGH`
- `VERIFIED`

Scores are clamped to the 0-100 range.

## Evidence Sources

The engine uses:

- corridor objects.
- enrichment findings.
- corridor classification.
- decision hierarchy context.

## Object-Driven Signals

Examples:

- `SUBSTATION` increases `POWER` and `AI`.
- `TRANSMISSION_LINE` increases `POWER`.
- `DATA_CENTER` increases `INTERCONNECTION`, `COMMERCIAL`, and `AI`.
- `CARRIER_HOTEL` increases `INTERCONNECTION`.
- `IX` increases `STRATEGIC`.
- `CONDUIT` increases `INFRASTRUCTURE`.
- `FIBER` increases `COMMERCIAL`.
- `DUCT_OPPORTUNITY` increases `COMMERCIAL`.
- `IRU_OPPORTUNITY` increases `COMMERCIAL`.
- `CROSSING` decreases `ENGINEERING`.
- `JURISDICTION` decreases `ENGINEERING`.
- `ENVIRONMENTAL_AREA` decreases `ENGINEERING`.

## Conflict Handling

Conflicts do not get resolved automatically.

Conflicts:

- remain attached to evidence.
- emit diagnostics.
- reduce category confidence.
- do not create recommendations.

## Diagnostics

The engine emits:

- `[PRISM_SCORE_CALCULATED]`
- `[PRISM_SCORE_WARNING]`
- `[PRISM_SCORE_CONFLICT]`
- `[PRISM_SCORE_CONFIDENCE]`
- `[PRISM_SCORE_CATEGORY]`

