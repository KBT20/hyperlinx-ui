# Prism Decision Conflict Model

Status: conflict doctrine.

## Constitutional Rule

Conflicts are preserved. Prism does not auto-resolve contradictory evidence.

Conflicts lower confidence and may require review.

## Conflict Types

### Power Availability Conflicts

Examples:

- one source indicates substation capacity is available.
- another source indicates capacity is unknown or constrained.

Handling:

- preserve both findings.
- lower confidence.
- require review when power is critical to objective.

### Parcel Conflicts

Examples:

- county parcel data lists municipal ownership.
- municipal data lists private commercial ownership.

Handling:

- preserve both parcel claims.
- require review before land or ROW assumptions are used.

### Jurisdiction Conflicts

Examples:

- DOT data lists state jurisdiction.
- county GIS lists county jurisdiction.

Handling:

- preserve both.
- require permitting review.

### Interconnection Conflicts

Examples:

- carrier hotel dataset indicates meet-me availability.
- facility data indicates no cross-connect availability.

Handling:

- preserve both.
- require interconnection verification.

### Commercial Conflicts

Examples:

- high residual duct opportunity but no evidence of buyer demand.
- strong revenue signal but high construction burden.

Handling:

- preserve both commercial and engineering evidence.
- allow future Prism to explain tradeoff.

### Engineering Conflicts

Examples:

- route appears feasible in geometry evidence.
- crossing evidence indicates impossible construction.

Handling:

- crossing evidence can trigger hard exclusion or review required.
- optimization must not override engineering infeasibility.

## Required Conflict Fields

The contract captures:

- conflict type.
- decision layer.
- evidence IDs.
- finding IDs.
- confidence impact.
- resolution policy.

