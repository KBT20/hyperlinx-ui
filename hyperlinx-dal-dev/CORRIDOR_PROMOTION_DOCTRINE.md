# Corridor Promotion Doctrine

Status: doctrine only.

## Constitutional Rule

Corridor is the development and opportunity object.

ScopeVersion is the executable truth object.

A CorridorRouteCandidate may not become ScopeVersion truth until it passes a promotion gate and is reviewed by human engineering authority.

## Promotion Is Not Execution

Promotion may prepare a ScopeVersion draft.

Promotion may not:

- save a ScopeVersion.
- approve a ScopeVersion.
- activate Control work.
- create Field closures.
- mutate lifecycle state.
- bypass Route Engineering.

Route Engineering owns certification and approval. Control owns work activation. Field owns closure evidence. Twin and Operational Intelligence project state after execution begins.

## Supported Input Paths

The doctrine supports:

- two endpoints.
- route files.
- KML/KMZ.
- shapefiles.
- GeoJSON.
- CSV site lists.
- hyperscaler requirement sheets.
- metro site lists.
- middle-mile route concepts.
- interstate corridor concepts.

It also supports both:

- customer-supplied routes.
- Teralinx-generated candidate corridors.

## Promotion Chain

```text
Corridor
  -> CorridorRouteCandidate
  -> Evidence Requirements
  -> Promotion Gate
  -> Human Engineering Review
  -> ScopeVersion Draft
  -> Route Engineering Approval
  -> Executable ScopeVersion Truth
```

## Human Authority

External APIs and files are evidence providers. Human engineering approval promotes evidence into draft truth. Route Engineering remains the authority that turns a draft into an approved ScopeVersion.

## Lifecycle Boundary

Promotion output must use a pre-execution lifecycle state only.

Allowed draft lifecycle:

```text
ANALYZED
```

Promotion must not create:

- `APPROVED`
- `CONTROL`
- `CONTROL_ACTIVE`
- `FIELD`
- `COMPLETE`
- `OPERATIONAL`

