# Corridor Relationship Model

Status: doctrine only.

## Core Relationship

```text
Corridor
  -> CorridorEndpoint[]
  -> CorridorRequirement[]
  -> CorridorRouteCandidate[]
  -> Infrastructure Objects
  -> Buildability Objects
  -> Monetization Objects
  -> CorridorEvidence[]
  -> selectedScopeVersionId?
```

Corridor is the development/opportunity object. ScopeVersion remains the execution object.

## ScopeVersion Boundary

```text
CorridorRouteCandidate
  -> Human Engineering Approval
  -> ScopeVersion
  -> IOF Package
  -> Close Event
  -> Child ScopeVersion
```

A route candidate may become ScopeVersion truth only after approval. The selected ScopeVersion executes the corridor design. Corridor itself does not execute work.

## Endpoint Relationships

Endpoints represent the assets being connected:

- A end.
- Z end.
- Intermediate.
- Regeneration.
- Interconnect.

Endpoint evidence may originate from customer files, public facility datasets, geocoders, human review, or field validation. Endpoint evidence must be preserved if conflicting sources disagree.

## Route Candidate Relationships

Route candidates may originate from:

- Customer-supplied geometry.
- OSRM.
- GraphHopper.
- OpenRouteService.
- Google Roads.
- DOT GIS.
- Human engineering.
- Hybrid synthesis.

Route candidates may belong to diversity groups. Two candidates in the same diversity group should not be treated as independent route diversity without evidence.

## Infrastructure Relationships

```text
Corridor
  -> ConduitSystem
  -> FiberSystem
  -> OpticalSystem
  -> InterconnectionNode[]
  -> RegenerationSite[]
```

Conduit, fiber, and optical systems describe productizable design intent. They do not mutate kernel execution state until the design is promoted into a ScopeVersion.

## Buildability Relationships

```text
CorridorRouteCandidate
  -> Jurisdiction[]
  -> Crossing[]
  -> Constraint[]
  -> UtilityAsset[]
  -> ServiceZone[]
```

Buildability objects influence constructability, permitting, cost, and risk. They are not authoritative by themselves. External APIs and GIS datasets provide evidence only.

## Monetization Relationships

```text
Corridor
  -> ResidualCapacity
  -> MonetizationOpportunity[]
  -> CorridorProduct[]
```

Primary monetization is the requested corridor product. Residual duct/fiber monetization is secondary and must not distort the required hyperscaler or neocloud design objective.

## Lineage

When a corridor design is selected, the ScopeVersion should retain references to:

- `corridorId`
- `routeCandidateId`
- endpoint IDs
- requirement IDs
- evidence IDs
- product IDs

Future lineage can connect:

```text
Corridor
  -> Selected ScopeVersion
  -> Executed ScopeVersion
  -> As-Built ScopeVersion
  -> Operational ScopeVersion
```

Twin projects selected ScopeVersion lineage. Operational Intelligence aggregates corridor and ScopeVersion portfolio performance.

