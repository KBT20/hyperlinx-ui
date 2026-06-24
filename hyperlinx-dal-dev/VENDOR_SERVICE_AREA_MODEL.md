# Vendor Service Area Model

Status: doctrine and contracts only.

## Purpose

Vendor service areas define where a vendor claims to operate.

Service areas are used for discovery and evidence alignment only. They do not establish service commitment or contractual coverage.

## Supported Service Area Types

The service area contract supports:

| Type | Description |
| --- | --- |
| `NATIONAL` | National coverage |
| `REGIONAL` | Named regional coverage |
| `STATE` | State-level coverage |
| `MSA` | Metropolitan statistical area or market coverage |
| `COUNTY` | County-level coverage |
| `CORRIDOR` | Corridor-specific coverage |
| `POLYGON` | Future custom polygon coverage |

## Examples

Vendor service areas may represent:

- Texas.
- DFW.
- West Texas.
- Kansas City.
- Oklahoma.
- National.
- Custom corridor coverage.
- Future custom polygons.

## Polygon Boundary

The contract supports polygon fields for future GIS integration.

No GIS implementation, spatial indexing, or coverage enforcement is implemented in this phase.

## Discovery Boundary

Service area matching is read-only string and metadata matching.

It is not a guarantee that:

- crews are available.
- assets are available.
- service is deliverable.
- pricing is active.
- permitting or utility approval exists.

