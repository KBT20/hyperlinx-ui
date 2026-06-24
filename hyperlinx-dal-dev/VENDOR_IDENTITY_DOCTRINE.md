# Vendor Identity Doctrine

Status: doctrine and contracts only.

## Purpose

Vendor identity establishes the supplier ecosystem for marketplace evaluation.

Marketplace assets and capabilities describe what exists and what can be delivered. Vendor identity describes who owns assets, who provides capabilities, where they operate, and what indicative price books they publish.

## Core Doctrine

Vendors do not enter the system through bids.

Vendors enter the system through identity.

Identity establishes trust.

Capabilities establish what they can do.

Assets establish what they own.

Price books establish indicative pricing.

Bids remain optional future behavior.

## Authority Boundary

Vendor identity is not procurement authority.

Vendor identity does not:

- create transactions.
- create bids.
- award work.
- create contracts.
- create ScopeVersions.
- create IOF Packages.
- create Close Events.
- mutate lifecycle state.
- authorize field execution.

Vendor identity supports marketplace discovery, product planning, Prism evaluation, and future commercial review.

## Supplier Ecosystem

The supplier ecosystem includes:

- construction providers.
- engineering providers.
- power and utility providers.
- data center operators.
- GPU providers.
- carriers.
- fiber providers.
- land owners.
- material suppliers.
- equipment suppliers.
- interconnection providers.
- transport providers.
- cloud providers.
- permitting providers.

## Identity Before Bids

Bids are a future workflow. The first marketplace requirement is to know:

- who the vendor is.
- what category they belong to.
- where they operate.
- what capabilities they expose.
- what assets they own or operate.
- what price books they publish.
- what qualification status they hold.

## Diagnostics

Vendor registry diagnostics are evidence records only.

Supported diagnostic codes:

- `VENDOR_PROFILE_REGISTERED`.
- `VENDOR_CAPABILITY_LINKED`.
- `VENDOR_ASSET_LINKED`.
- `VENDOR_PRICEBOOK_REGISTERED`.
- `VENDOR_REGION_LINKED`.
- `VENDOR_QUALIFICATION_RECORDED`.

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

No bid generation or procurement occurs in this phase.

