# Marketplace Asset Doctrine

Status: doctrine and contracts only.

## Purpose

Marketplace is an asset and capability discovery layer. It is not limited to vendors, bids, or project procurement.

The marketplace evaluates whether assets and capabilities can support an opportunity, product plan, or future ScopeVersion. It does not create execution authority, contractual authority, or construction truth.

## Core Doctrine

Vendors do not sell projects.

Vendors expose assets and capabilities.

Customers consume products.

Products are assembled from assets.

Assets are represented as objects.

Marketplace evaluates assets against opportunities.

## Asset Authority Boundary

Marketplace assets are commercial and operational evidence. They may support Prism scoring, product planning, quote assumptions, and executive review.

Marketplace assets do not:

- create ScopeVersions.
- mutate ScopeVersions.
- create IOF Packages.
- create Close Events.
- approve work.
- award contracts.
- establish physical infrastructure truth.

ScopeVersion remains the authoritative state object. Certified and marketplace objects remain evidence until promoted through governed workflows.

## First-Class Market Objects

Marketplace must support these domains as first-class market objects:

- Facilities.
- Power.
- Land.
- Construction.
- Materials.
- Labor.
- Fiber.
- Duct.
- Interconnection.
- GPU capacity.
- Transport.
- Managed services.

## Required Asset Types

The initial marketplace asset contract includes:

| Asset type | Purpose |
| --- | --- |
| `GPU_FACILITY` | AI compute facility, edge GPU site, or GPU hosting location |
| `DATA_CENTER` | Data center, colocation, or interconnection-ready facility |
| `SUBSTATION` | Power substation relevant to corridor or facility planning |
| `POWER_FEED` | Available or potential power service feed |
| `TRANSMISSION_LINE` | Transmission infrastructure relevant to power proximity |
| `PARCEL` | Land, easement, or site control opportunity |
| `FIBER_ROUTE` | Existing or available fiber route asset |
| `DUCT_ROUTE` | Duct path available for sale, lease, or reservation |
| `CONDUIT_SYSTEM` | Conduit and duct bank infrastructure |
| `CARRIER_HOTEL` | Carrier hotel or meet-me location |
| `IX` | Internet exchange or peering point |
| `CLOUD_ONRAMP` | Cloud on-ramp or hyperscaler handoff point |
| `CONSTRUCTION_CAPABILITY` | Civil construction delivery capability |
| `ENGINEERING_CAPABILITY` | Engineering, design, survey, or certification capability |
| `PERMITTING_CAPABILITY` | Permitting and jurisdictional coordination capability |
| `LABOR_CAPABILITY` | Field labor and crew capability |
| `MATERIAL_CAPABILITY` | Material supply capability |
| `TRANSPORT_CAPABILITY` | Lit transport, wave, Ethernet, or operational network capability |

## Marketplace Evidence

Each marketplace asset should retain:

- owner or provider name.
- service area.
- status.
- related corridor object types.
- related capabilities.
- related price books.
- evidence references.
- review requirement.
- notes for limits, uncertainty, and operational caveats.

## Review Requirement

Marketplace may identify possible assets, but human review remains required before any asset becomes part of a quote basis, product basis, or execution basis.

Examples:

- A power feed may indicate proximity, not available capacity.
- A GPU facility may indicate hosting relevance, not reserved capacity.
- A fiber route may indicate commercial option value, not installable route truth.
- A parcel may indicate land opportunity, not site control.

## Non-Goals

This phase does not implement:

- bidding.
- transactions.
- vendor onboarding.
- persistence.
- contracts.
- awards.
- procurement workflows.
- execution workflows.

## ScopeVersion Close Authority Alignment

All authority resolves through ScopeVersion Close events.

Marketplace assets and capabilities remain advisory evidence until a validated close exists against `scopeVersionId`.

Marketplace does not create authority by itself.
