# Vendor Identity Validation

Status: doctrine, fixtures, and contract validation only.

## Validation Purpose

This document validates the Phase 6.4C vendor identity and price book registry model at the contract level.

No transactions, bids, awards, contracts, persistence, or execution are implemented.

## Created Contracts

The vendor identity layer defines:

- `VendorProfile`.
- `VendorQualification`.
- `VendorServiceArea`.
- `VendorPriceBook`.
- `VendorDiagnostic`.
- `VendorCategory`.
- `VendorStatus`.
- `VendorCapabilityReference`.
- `VendorAssetReference`.

## Discovery Helpers

Read-only helper functions support:

- `findVendorByCategory()`.
- `findVendorByCapability()`.
- `findVendorByAsset()`.
- `findVendorByRegion()`.
- `findVendorPriceBooks()`.
- `findQualifiedVendors()`.

These helpers do not call providers, mutate state, persist data, create bids, or create procurement objects.

## Vendor Examples

Fixture vendors include:

| Vendor | Category |
| --- | --- |
| Duos Edge | `GPU_PROVIDER` |
| FiberLight | `FIBER_PROVIDER` |
| Zayo | `CARRIER` |
| Lumen | `TRANSPORT_PROVIDER` |
| DC Blox | `DATA_CENTER` |
| Regional HDD Contractor | `CONSTRUCTION` |
| Regional Fiber Contractor | `CONSTRUCTION` |
| Regional Power Contractor | `POWER` |
| Land Owner | `LAND_OWNER` |
| Carrier Hotel Provider | `INTERCONNECTION_PROVIDER` |

## Asset Ownership Examples

- Duos Edge owns a GPU facility.
- Utility or power provider represents a power feed and substation context.
- FiberLight owns fiber route and conduit system assets.
- Land Owner owns a parcel.
- Carrier Hotel Provider owns carrier hotel and IX assets.

Ownership is registry evidence only. No ownership enforcement exists in this phase.

## Capability Examples

Fixture capabilities include:

- GPU Hosting.
- Dark Fiber.
- Transport.
- Interconnection.
- Directional Drilling.
- Conduit Placement.
- Fiber Placement.
- Splicing.
- Electrical Construction.
- Data Center Deployment.

## Price Book Examples

Fixture vendor price books include:

- GPU Rack / Month.
- Dark Fiber / Pair Mile.
- Transport / Gbps.
- Wave / Circuit.
- Rack / Month.
- Bore / Foot.
- Crossing / Each.
- Fiber / Foot.
- Splice / Each.
- MW / Month.
- Cabinet / Each.

All price books are advisory and non-contractual.

## Service Area Examples

Fixture service areas include:

- National.
- Texas.
- DFW.
- West Texas.
- Kansas City.
- Oklahoma.

Custom polygon support exists in the contract only. No GIS implementation exists.

## Qualification Examples

- FiberLight: preferred, insurance verified.
- Regional HDD Contractor: qualified, crew capacity recorded.
- Carrier Hotel Provider: preferred, compliance verified.
- Duos Edge: registered, GPU facility capacity requires review.
- Land Owner: unverified, ownership evidence requires review.

## Marketplace Alignment

```text
Opportunity
  -> Prism
  -> Product Plan
  -> Required Assets
  -> Marketplace
  -> Vendor Discovery
  -> Price Book Discovery
```

No bid generation or procurement exists yet.

## Remaining Work Before Bid Package Generation

- Provider authentication and identity verification.
- Insurance and compliance document storage.
- Service area GIS enforcement.
- Live price book versioning.
- Bid package model.
- Bid invitation workflow.
- Vendor response workflow.
- Award governance.
- Contract and purchase order authority.
- Execution handoff to Control.

## Constitutional Boundary

Vendors, assets, capabilities, qualifications, and price books are marketplace evidence.

They are not ScopeVersion truth.

They do not mutate lifecycle state.

They do not authorize work.

