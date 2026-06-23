# Corridor Object Catalog

Status: canonical object catalog doctrine and type contract.

## Objective

The Corridor Object Catalog defines the infrastructure, power, interconnection, property, network, operational, and monetization objects that may appear inside Teralinx corridors.

Objects create:

- value.
- risk.
- monetization opportunity.
- strategic advantage.
- operational burden.

## Constitutional Rule

Corridor objects are evidence-backed. They are not authority.

Objects influence Prism evaluation, but objects do not create truth.

ScopeVersion remains execution truth. Route Engineering remains authoritative for executable corridor design.

## Catalog Contract

Implementation:

- `src/corridor/CorridorObjectCatalog.ts`

Defines:

- `CorridorObjectType`
- `CorridorObjectCategory`
- `CorridorObjectDefinition`
- `CorridorObjectImportance`
- `CorridorObjectMonetization`
- `CorridorObjectRisk`

## Definition Fields

Every object definition includes:

- `objectType`
- `category`
- `description`
- `corridorRoles`
- `importance`
- `monetizationImpact`
- `riskImpact`
- `providerSources`
- `evidenceRequirements`

## Lens-Driven Use

The object catalog is canonical, but object priority changes by Corridor Lens.

Example:

- `CONDUIT` is primary under `DUCT_MONETIZATION`.
- `SUBSTATION` is primary under `HYPERSCALER` and `POWER_AI_EXPANSION`.
- `CARRIER_HOTEL` is primary under `INTERCONNECTION`, `TRANSPORT`, and `CARRIER_WHOLESALE`.

Lens definitions live in:

- `src/corridor/CorridorLens.ts`
- `src/corridor/CorridorLensRegistry.ts`

## Non-Goals

This catalog does not:

- score objects.
- recommend candidates.
- route geometry.
- enrich evidence.
- call providers.
- persist data.
- create ScopeVersions.
- modify kernel or execution contracts.
## Design Standards Context

Objects must be interpreted through applicable Corridor Design Standards.

The object catalog identifies what an object is.

The lens determines whether that object matters for a specific corridor view.

The reference architecture determines whether that object must be considered for a specific customer ask.

The design standard determines what that object requires before it can support engineering decisions.

Prism may score object evidence only after standards context exists.

Route Engineering remains the authority for object approval, redlines, exceptions, and ScopeVersion handoff.

## Prism Recommendation Relationship

Prism Recommendation may suggest object packages from the catalog.

Suggested objects do not become truth.

Object population plans are draft-only until human review and Route Engineering disposition.

Route Engineering remains authority.
