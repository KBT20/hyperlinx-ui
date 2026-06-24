# Marketplace Product Assembly Model

Status: doctrine and contracts only.

## Purpose

Products are assembled from marketplace assets and capabilities.

Marketplace does not sell projects. Marketplace identifies which assets and capabilities could assemble a product for an opportunity.

## Product Assembly Doctrine

Opportunity flows into Prism.

Prism creates a product plan.

The product plan identifies required assets.

Marketplace evaluates available assets, capabilities, pricing, and provider coverage.

Route Engineering and governed commercial review remain downstream authority.

```text
Opportunity
  -> Prism
  -> Product Plan
  -> Required Assets
  -> Marketplace
```

## Product Contract

A marketplace product should define:

- product id.
- product name.
- product type.
- required asset types.
- required capability types.
- optional asset types.
- review requirement.
- notes.

## Example: AI Interconnect

AI Interconnect requires:

- fiber route.
- transport capability.
- cloud on-ramp.
- data center.
- GPU facility.
- power feed.

Optional supporting assets may include:

- substation.
- transmission line.
- carrier hotel.
- IX.

Relevant capabilities may include:

- transport.
- interconnection.
- GPU hosting.
- electrical construction.
- optical deployment.

## Example: Dark Fiber IRU

Dark Fiber IRU requires:

- conduit system.
- fiber route.
- splicing.
- interconnection.
- route operations.
- maintenance context.

Optional supporting assets may include:

- duct route.
- transport capability.
- permitting capability.

## Example: Duct Sale

Duct Sale requires:

- conduit system.
- duct route.
- duct count and size evidence.
- ownership or commercial authority evidence.
- maintenance model.

Optional supporting assets may include:

- parcel.
- permitting capability.
- route operations capability.

## Product Readiness

A product is not ready for commercial action until it has:

- opportunity reference.
- required asset coverage.
- capability coverage.
- service area alignment.
- price book evidence.
- provider review.
- human commercial review.

No product is automatically actionable in this phase.

## Boundary

Product assembly does not create:

- bids.
- quotes.
- awards.
- contracts.
- ScopeVersions.
- IOF Packages.
- execution tasks.

