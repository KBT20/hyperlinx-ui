# Prism Decision Layers

Status: decision doctrine.

## Layer 1: Hard Exclusions

Purpose: eliminate corridors that cannot reasonably be executed.

Examples:

- prohibited environmental restrictions.
- impossible crossings.
- no feasible route.
- no power availability.
- no expansion capability.
- legal prohibition.
- unresolvable jurisdiction conflict.
- unacceptable risk concentration.

Output:

- `PASS`
- `FAIL`
- `REVIEW_REQUIRED`

A `FAIL` prevents recommendation regardless of lower-layer scores.

## Layer 2: Strategic Fit

Purpose: determine whether the corridor aligns with the requested objective.

Examples:

- `AI_FABRIC`
- `METRO_AGGREGATION`
- `MSA_INTERCONNECT`
- `BACKBONE_INTERCONNECT`
- `INTERCONNECTION`
- `CAMPUS`

Questions:

- Is this the correct corridor type?
- Does it serve the intended network role?
- Does it satisfy customer intent?

Output:

- `STRONG`
- `MODERATE`
- `WEAK`

## Layer 3: Commercial Potential

Purpose: evaluate economic opportunity.

Examples:

- IRU revenue.
- transport revenue.
- duct sale opportunity.
- residual capacity monetization.
- expansion revenue.
- route reuse.
- carrier displacement value.

Output:

- `HIGH`
- `MEDIUM`
- `LOW`

## Layer 4: Engineering Feasibility

Purpose: evaluate buildability and operational reality.

Examples:

- crossings.
- jurisdictions.
- maintenance complexity.
- restoration complexity.
- permitting burden.
- environmental constraints.
- route constructability.

Output:

- `FAVORABLE`
- `NEUTRAL`
- `UNFAVORABLE`

## Layer 5: Optimization

Purpose: compare otherwise acceptable candidates.

Examples:

- latency.
- diversity.
- scalability.
- future capacity.
- route efficiency.
- operational flexibility.
- redundancy.

Output:

- `OPTIMAL`
- `GOOD`
- `ACCEPTABLE`

Optimization should never rescue a corridor that failed a higher layer.

