# Vendor Profile Model

Status: doctrine and contracts only.

## Purpose

A vendor profile is the identity record for a marketplace participant.

It links vendor identity to categories, regions, capabilities, assets, price books, and qualification status.

## Vendor Categories

Supported categories:

| Category | Description |
| --- | --- |
| `CONSTRUCTION` | Civil construction, HDD, trenching, restoration, and field construction |
| `ENGINEERING` | Design, survey, permitting design, route engineering, and certification support |
| `POWER` | Power delivery and electrical construction providers |
| `UTILITY` | Utility companies and utility infrastructure operators |
| `DATA_CENTER` | Data center and colocation operators |
| `GPU_PROVIDER` | GPU capacity, hosting, and edge compute providers |
| `CARRIER` | Network carriers and wholesale operators |
| `FIBER_PROVIDER` | Fiber owners or fiber service providers |
| `LAND_OWNER` | Parcel, easement, and land opportunity owners |
| `MATERIAL_SUPPLIER` | Conduit, fiber, cabinet, handhole, and material suppliers |
| `EQUIPMENT_SUPPLIER` | Optical, electrical, facility, and equipment suppliers |
| `INTERCONNECTION_PROVIDER` | Carrier hotel, IX, cloud on-ramp, and meet-me providers |
| `TRANSPORT_PROVIDER` | Lit transport, wave, Ethernet, and capacity providers |
| `CLOUD_PROVIDER` | Cloud on-ramp and hyperscaler ecosystem providers |
| `PERMITTING_PROVIDER` | Permit preparation and jurisdiction coordination providers |

## Profile Fields

A vendor profile should include:

- `vendorId`.
- `vendorName`.
- `vendorCategory`.
- `website`.
- `serviceRegions`.
- `capabilities`.
- `assets`.
- `priceBooks`.
- `qualificationStatus`.
- `insuranceStatus`.
- `notes`.
- `createdAt`.
- `updatedAt`.

## Status

Vendor status describes registry state only.

Supported values:

- `DISCOVERED`.
- `REGISTERED`.
- `ACTIVE`.
- `INACTIVE`.
- `SUSPENDED`.
- `ARCHIVED`.

Status does not award work or create approval authority.

## Asset References

Vendor profiles may reference marketplace assets through:

- asset id.
- asset type.
- ownership type.
- notes.

Ownership types include:

- owns.
- operates.
- leases.
- represents.
- supplies.
- unknown.

No ownership enforcement is implemented in this phase.

## Capability References

Vendor profiles may reference capabilities through:

- capability id.
- capability type.
- capability name.
- notes.

Capabilities remain evidence until reviewed.

