# Corridor Synthesis Workflow

Status: V1 workflow.

## Workflow

```text
Evidence Bundle
  -> Endpoint extraction
  -> Customer route preservation
  -> Placeholder candidate creation
  -> Provenance attachment
  -> Diagnostics
  -> Candidate result
```

## Endpoint Pair Synthesis

Function:

```ts
synthesizeFromEndpoints()
```

Input:

- A endpoint evidence.
- Z endpoint evidence.
- requirements.

Output:

- PRIMARY candidate.

V1 behavior:

- uses straight-line placeholder geometry.
- does not call routing providers.
- does not claim route validity.

## Customer Route Preservation

Function:

```ts
synthesizeFromCustomerRoute()
```

Behavior:

- creates `CUSTOMER_SUPPLIED` candidate for each route evidence record.
- preserves geometry.
- preserves evidence IDs.
- does not mutate source geometry.

## Diversity Placeholder

Function:

```ts
createDiverseCandidate()
```

V1 behavior:

- creates placeholder candidate.
- sets diversity status to `NOT_EVALUATED`.
- does not calculate overlap or shared ROW.

## AI Corridor Placeholder

Function:

```ts
createAiCorridorCandidate()
```

Adds placeholder attributes for:

- power.
- substations.
- transmission.
- interconnection.
- expansion land.
- AI demand.

No enrichment occurs.

## Expansion Placeholder

Function:

```ts
createExpansionCandidate()
```

Adds placeholder attributes for:

- future capacity.
- residual duct.
- residual fiber.
- expansion land.
- future build zones.

No calculations occur.

## End-To-End Function

```ts
synthesizeCorridorCandidates()
```

Creates requested candidates and returns provider hooks for future implementation.

