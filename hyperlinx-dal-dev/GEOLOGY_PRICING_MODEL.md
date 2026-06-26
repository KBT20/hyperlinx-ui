# Geology Pricing Model

Phase: 7.4G  
Scope: DAL sales estimator only.

## Doctrine

Geology is independent of Construction Strategy.

The estimator edits only:

```text
Rock %
```

Dirt % is derived:

```text
Dirt % = 100 - Rock %
```

## Dirt Bore Pricing

Base Dirt Bore applies to all Dirt Bore footage:

```text
Dirt Bore Feet x $15 / LF
```

Rock Adder applies only to the rock portion of Dirt Bore footage:

```text
Dirt Bore Feet x Rock % = Rock Feet
Rock Feet x $30 / LF = Rock Adder
```

Total Dirt Bore cost:

```text
Base Dirt Bore Cost + Rock Adder
```

The total unit cost for rock bore footage is therefore:

```text
$15 / LF base + $30 / LF adder = $45 / LF
```

## Non-Geology Methods

Plow is a construction method, not a dirt condition.

Open Cut is a construction method, not a dirt condition.

Neither Plow nor Open Cut receives the Dirt Bore rock adder in this phase.

## Future Engineering Boundary

Future engineering may model:

- plow interruptions;
- crossing production impacts;
- HDD mobilization;
- engineered bore profiles;
- crossing-specific construction methods.

This phase preserves existing crossing quantities and does not model crossing production impacts.
