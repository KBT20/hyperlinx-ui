# Marketplace Capability Model

Status: doctrine and contracts only.

## Purpose

Capabilities describe what a provider can do, where they can do it, and what unit models may be used for advisory pricing.

Capabilities are not work orders. They are not vendor awards. They are not construction authority.

## Capability Doctrine

A marketplace capability is reusable operational evidence.

It answers:

- What can this provider deliver?
- What assets or objects are required?
- Where can it be delivered?
- Which unit types are relevant?
- Is price book evaluation allowed?
- Is review required?

## Initial Capability Types

| Capability type | Description |
| --- | --- |
| `DIRECTIONAL_DRILLING` | Boring and directional drilling capability |
| `FIBER_PLACEMENT` | Fiber placement, pulling, and make-ready support |
| `SPLICING` | Fiber splicing and related field work |
| `OPTICAL_DEPLOYMENT` | Lit transport, waves, optics, and equipment deployment |
| `PERMITTING` | Permit preparation and jurisdiction coordination |
| `ELECTRICAL_CONSTRUCTION` | Power service, utility, and electrical construction |
| `DATA_CENTER_DEPLOYMENT` | Facility fit-out, cabinet, cage, or data center deployment |
| `GPU_HOSTING` | GPU hosting, rack capacity, or edge compute service capability |
| `DARK_FIBER` | Dark fiber sale, lease, or IRU capability |
| `TRANSPORT` | Lit transport, Ethernet, wavelength, or capacity service capability |
| `INTERCONNECTION` | Cross-connect, meet-me, peering, or cloud on-ramp capability |
| `MATERIAL_SUPPLY` | Materials supply such as conduit, fiber, cabinets, or handholes |
| `DUCT_INSTALLATION` | Duct and innerduct placement capability |
| `CONDUIT_PLACEMENT` | Conduit placement and restoration capability |
| `ROUTE_OPERATIONS` | Route maintenance, operations, and restoration support |

## Capability Contract Fields

Each capability should define:

- `capabilityId`.
- `capabilityName`.
- `capabilityType`.
- `ownerName`.
- `requiredObjects`.
- `serviceAreas`.
- `unitTypes`.
- `priceBookEligible`.
- `reviewRequired`.
- `notes`.

## Required Objects

Required objects identify the asset context needed for a capability to be relevant.

Examples:

- Directional drilling requires a construction capability.
- Splicing requires labor capability and fiber context.
- GPU hosting requires a GPU facility.
- Interconnection requires a carrier hotel, data center, or cloud on-ramp.
- Electrical construction requires a power feed, substation, or related power asset.

## Service Area

Capabilities are only meaningful inside their service area.

Service area may be defined by:

- state.
- county.
- metro.
- market.
- future geometry.

No geographic enforcement is implemented in this phase.

## Price Book Eligibility

`priceBookEligible` means a capability may be evaluated against advisory unit pricing.

It does not mean:

- the price is active.
- the provider is awarded.
- the unit cost is binding.
- work can begin.

## Review Rules

Most capabilities should begin with `reviewRequired = true` until provider evidence, coverage, insurance, capacity, and commercial terms are validated.

