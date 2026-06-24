# Marketplace Price Book Model

Status: doctrine and contracts only.

## Purpose

Marketplace price books provide advisory unit pricing for assets, capabilities, and products.

Price books support evaluation. They do not create quote authority, purchase authority, or contract authority.

## Pricing Doctrine

Price books are advisory.

Price books may support:

- preliminary product planning.
- Prism scoring evidence.
- commercial range estimates.
- marketplace availability review.
- executive comparison.

Price books may not:

- award work.
- bind vendors.
- override quote governance.
- replace commercial approval.
- create execution authority.

## Pricing Models

Supported pricing models:

| Pricing model | Description |
| --- | --- |
| `UNIT_PRICE` | Direct unit price |
| `NRC` | Non-recurring charge model |
| `MRC` | Monthly recurring charge model |
| `IRU` | Long-term IRU model |
| `TERM` | Term-based service model |
| `HYBRID` | Combination of recurring and non-recurring pricing |
| `ADVISORY_UNIT` | Planning-only unit pricing |

## Unit Types

Initial unit types include:

| Unit type | Example label |
| --- | --- |
| `CONDUIT_FOOT` | Conduit / Foot |
| `FIBER_FOOT` | Fiber / Foot |
| `SPLICE_EACH` | Splice / Each |
| `CABINET_EACH` | Cabinet / Each |
| `MW_MONTH` | MW / Month |
| `RACK_MONTH` | Rack / Month |
| `CROSSING_EACH` | Crossing / Each |
| `PERMIT_EACH` | Permit / Each |
| `BORE_FOOT` | Bore / Foot |
| `TRANSPORT_MBPS` | Transport / Mbps |
| `TRANSPORT_GBPS` | Transport / Gbps |
| `WAVE_CIRCUIT` | Wave / Circuit |
| `DARK_FIBER_PAIR_MILE` | Dark Fiber / Pair Mile |
| `GPU_RACK_MONTH` | GPU Rack / Month |
| `ENGINEERING_HOUR` | Engineering / Hour |
| `CREW_DAY` | Crew / Day |

## Price Book Contract

A price book should define:

- price book id.
- owner name.
- pricing model.
- linked assets.
- linked capabilities.
- linked products.
- unit prices.
- advisory flag.
- effective date.
- notes.

## Commercial Review

Every price book value is advisory until reviewed by a commercial authority.

Examples:

- Bore cost may be affected by soil, ROW, crossings, and restoration.
- MW pricing may not indicate available capacity.
- Transport price may depend on term, SLA, port type, and committed bandwidth.
- Dark fiber pair mile pricing may depend on availability and route diversity.

## Boundary

This phase does not implement:

- quote generation.
- bid submission.
- contract negotiation.
- provider acceptance.
- purchase orders.
- award logic.

## ScopeVersion Close Authority Alignment

All authority resolves through ScopeVersion Close events.

Price books remain advisory until commercial review produces a validated close against `scopeVersionId`.

Budget Lock requires `BUDGET_CLOSE`; vendor acceptance requires `VENDOR_ACCEPTANCE_CLOSE`.
