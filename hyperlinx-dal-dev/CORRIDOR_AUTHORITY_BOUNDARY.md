# Corridor Authority Boundary

Status: doctrine only.

## Frozen Kernel Boundary

This phase does not modify:

- lifecycle authority.
- closure authority.
- completion engine.
- Twin projection contracts.
- Control execution contracts.
- Field execution contracts.
- Operational Intelligence portfolio contracts.

Corridor objects are additive development objects. They do not mutate execution state.

## Authority Owners

| Domain | Owner | Authority |
| --- | --- | --- |
| Translate | Translate | Ingestion and normalization |
| Corridor Synthesis | Corridor Synthesis | Candidate generation |
| Prism | Prism | Scoring and ranking |
| Marketplace | Marketplace | Product/commercial modeling |
| Kernel | DAL Kernel | Lifecycle, execution, closure, completion, projection |
| Twin | Twin | Selected ScopeVersion projection |
| Operational Intelligence | OI | Portfolio and corridor aggregation |
| Human Engineering | Human reviewer | Promotion decision and certified review evidence |

## External API Rule

No external API is authoritative.

APIs may provide:

- route evidence.
- endpoint evidence.
- cost evidence.
- permit evidence.
- parcel evidence.
- power evidence.
- latency evidence.

APIs may not:

- mutate ScopeVersion truth.
- bypass human engineering approval.
- create execution authority.
- replace certified ScopeVersion state.

## Promotion Boundary

```text
CorridorRouteCandidate
  -> Promotion Gate
  -> Human Engineering Approval
  -> ScopeVersion Draft
  -> Route Engineering Approval
  -> ScopeVersion
```

Promotion evaluation is not authority.

Promotion recommendation is not authority.

Promotion may prepare a ScopeVersion draft only. Route Engineering owns certification and approval. Only after Route Engineering approval does corridor design enter the kernel truth chain.

Promotion may not:

- save authoritative ScopeVersion truth.
- create ACTIVE work.
- create FIELD closures.
- mutate lifecycle authority.
- bypass Route Engineering approval.

## ScopeVersion Boundary

ScopeVersion remains:

- truth object.
- execution source.
- map render source.
- Twin projection source.
- IOF package source.

Corridor remains:

- development object.
- opportunity object.
- evidence container.
- synthesis context.
- product context.

Do not merge them.

## Work Boundary

IOF Package establishes work. Close Event establishes authorized transformation. Child ScopeVersion establishes new truth.

Corridor objects may inform work package generation later, but this phase does not wire that behavior.
