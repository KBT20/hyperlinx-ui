# Vendor Capability Registry

Status: doctrine and contracts only.

## Purpose

The vendor capability registry links vendors to the marketplace capabilities they can provide.

It answers:

- Which vendors can perform a capability?
- Which vendors can support a product plan?
- Which vendors operate in the required service area?
- Which vendors have advisory price books?

## Supported Capabilities

Vendor profiles may link to marketplace capability types including:

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
- Material Supply.
- Duct Installation.
- Conduit Placement.
- Route Operations.

## Registry Rules

Capability links are not bids.

Capability links are not work authorization.

Capability links are not proof of current capacity.

Capability links establish discoverability for marketplace evaluation.

## Discovery

Read-only discovery helpers support:

- finding vendors by capability.
- finding vendors by category.
- finding vendors by region.
- finding qualified vendors.

These helpers do not call external providers and do not persist data.

## Qualification Interaction

Capability presence and vendor qualification are separate.

A vendor may have a capability but still be:

- unverified.
- registered only.
- pending insurance review.
- pending safety review.
- pending compliance review.

Future workflows may require a minimum qualification level before marketplace actions.

