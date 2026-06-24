# Marketplace Asset Validation

Status: doctrine, fixtures, and contract validation only.

## Validation Purpose

This document validates the Phase 6.4B marketplace asset and capability model at the contract level.

No transactions, bids, vendor onboarding, persistence, contracts, or execution are implemented.

## Created Contracts

The marketplace contract layer defines:

- `MarketplaceAsset`.
- `MarketplaceCapability`.
- `MarketplaceProduct`.
- `MarketplacePriceBook`.
- `MarketplaceAssetType`.
- `MarketplaceCapabilityType`.
- `MarketplacePricingModel`.
- `MarketplaceUnitType`.

## Discovery Helpers

Read-only helper functions are defined for:

- `findAssetsByType()`.
- `findCapabilitiesByType()`.
- `findPriceBooks()`.
- `findAssetsForProduct()`.

These helpers do not call providers, mutate state, persist data, create quotes, or create execution objects.

## Fixture Coverage

Fixture examples include:

| Fixture | Asset type |
| --- | --- |
| Edge GPU Facility | `GPU_FACILITY` |
| DFW Data Center | `DATA_CENTER` |
| Texas Power Provider | `POWER_FEED` |
| Regional Construction Contractor | `CONSTRUCTION_CAPABILITY` |
| Fiber Construction Contractor | `LABOR_CAPABILITY` |
| Regional Transport Provider | `TRANSPORT_CAPABILITY` |
| West Texas Land Owner | `PARCEL` |
| DFW Carrier Hotel | `CARRIER_HOTEL` |

Capability examples include:

- Directional Drilling.
- Fiber Placement.
- Splicing.
- Optical Deployment.
- Permitting.
- Electrical Construction.
- Data Center Deployment.
- GPU Hosting.
- Dark Fiber.
- Transport.
- Interconnection.

Product examples include:

- AI Interconnect.
- Dark Fiber IRU.
- Duct Sale.

Price book examples include:

- civil unit costs.
- fiber unit costs.
- power advisory costs.
- transport costs.
- interconnection costs.
- GPU hosting costs.

## Opportunity Alignment

Marketplace aligns opportunities through this model:

```text
Opportunity
  -> Prism
  -> Product Plan
  -> Required Assets
  -> Marketplace
  -> Available Assets
  -> Available Capabilities
  -> Available Pricing
  -> Available Providers
```

Marketplace does not promote an opportunity. Promotion remains a governed future workflow.

## Validation Scenarios

### AI Interconnect

Required assets:

- fiber route.
- transport capability.
- cloud on-ramp.
- data center.
- GPU facility.
- power feed.

Required capabilities:

- transport.
- interconnection.
- GPU hosting.
- electrical construction.

Expected result:

- matching marketplace assets can be discovered.
- price books can be filtered by product.
- review remains required.

### Dark Fiber IRU

Required assets:

- conduit system.
- fiber route.
- carrier hotel.

Required capabilities:

- dark fiber.
- splicing.
- interconnection.
- route operations.

Expected result:

- asset gaps are visible.
- dark fiber remains advisory until availability and commercial authority are reviewed.

### Duct Sale

Required assets:

- conduit system.
- duct route.

Required capabilities:

- duct installation.
- route operations.

Expected result:

- civil and route operations capability can be modeled.
- ownership and maintenance remain review gates.

## Constitutional Boundary

Marketplace assets and price books are evidence.

They are not truth.

They do not create ScopeVersions, IOF Packages, Close Events, work packages, vendor awards, or contracts.

## Remaining Risks Before Implementation

- Provider identity and authority are not modeled.
- Asset availability is not verified.
- Service area geometry is not enforced.
- Price book values are advisory only.
- Product assembly does not calculate completeness scores.
- No marketplace persistence exists in this phase.
- No commercial review workflow exists in this phase.

