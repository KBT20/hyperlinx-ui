# Corridor To ScopeVersion Mapping

Status: doctrine only.

## Mapping Rule

Corridor promotion may create a ScopeVersion draft only. Route Engineering must still certify and approve the resulting ScopeVersion before execution.

## Corridor Mapping

| Corridor field | ScopeVersion draft target |
| --- | --- |
| corridorId | corridor reference |
| corridorName | scope display/context name |
| customerType | customer metadata |
| designObjective | design objective metadata |
| requirements | requirement basis |
| evidenceIds | evidence basis |

## Route Candidate Mapping

| CorridorRouteCandidate field | ScopeVersion draft target |
| --- | --- |
| routeCandidateId | route candidate reference |
| geometry | draft route geometry |
| distanceMiles | route distance |
| source | route source metadata |
| routeClass | route class metadata |
| evidenceIds | route evidence |
| corridorName + routeClass | candidate route name |

Build feet are derived from route distance for draft context only. Route Engineering may later replace draft measurements with certified geometry measurements.

## Endpoint Mapping

| CorridorEndpoint field | ScopeVersion draft target |
| --- | --- |
| endpointId | endpoint reference |
| role | A/Z/intermediate/regen/interconnect role |
| name | endpoint metadata |
| latitude/longitude | endpoint coordinate evidence |
| evidenceIds | endpoint evidence |

Endpoints map to `sourceCandidate` or equivalent draft metadata. They are not Field production stations.

## Infrastructure Mapping

| Object | ScopeVersion draft target |
| --- | --- |
| ConduitSystem | planned infrastructure objects, duct assumptions, residual capacity assumptions |
| FiberSystem | planned infrastructure objects, fiber count assumptions, IRU eligibility |
| OpticalSystem | regen assumptions, transport capability, topology |
| InterconnectionNode | planned interconnect references |
| RegenerationSite | planned regen references |

## Risk Mapping

| Object | ScopeVersion draft target |
| --- | --- |
| Jurisdiction | permit basis |
| Crossing | crossing inventory and cost/risk basis |
| Constraint | constructability and risk basis |
| UtilityAsset | conflict/support basis |
| ServiceZone | operations and restoration basis |

## Forbidden Mapping

Promotion may not map directly to:

- active work packages.
- Field closures.
- Control state.
- Twin projection state.
- Operational lifecycle state beyond `ANALYZED`.

Promotion prepares a draft; Route Engineering owns authority.
## Customer Opportunity Traceability

Every ScopeVersion created from corridor work must preserve:

- customerId
- opportunityId
- corridorId

ScopeVersion is execution truth, but it must remain traceable to the customer and opportunity that initiated the work.

No ScopeVersion should be promoted as executable without business lineage.

