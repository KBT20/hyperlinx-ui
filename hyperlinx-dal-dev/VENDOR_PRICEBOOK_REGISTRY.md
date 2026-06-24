# Vendor Price Book Registry

Status: doctrine and contracts only.

## Purpose

The vendor price book registry links vendor identity to advisory pricing.

Price books indicate how a vendor may price assets or capabilities. They do not create contractual pricing.

## Supported Units

Vendors may publish advisory pricing for:

- Conduit / Foot.
- Fiber / Foot.
- Splice / Each.
- HDD / Foot.
- Cabinet / Each.
- Crossing / Each.
- Permit / Each.
- MW / Month.
- Rack / Month.
- Transport / Mbps.
- Transport / Gbps.
- Wave / Circuit.
- Dark Fiber / Pair Mile.

## Price Book Fields

A vendor price book should include:

- `priceBookId`.
- `vendorId`.
- `effectiveDate`.
- `pricingModel`.
- `unitType`.
- `unitPrice`.
- `marketCoverage`.
- `notes`.

## Advisory Boundary

Vendor price books are advisory.

They are not:

- bids.
- quotes.
- contracts.
- purchase orders.
- awards.
- execution authority.

## Market Coverage

Each vendor price book may define market coverage using vendor service areas.

Price books should not be applied outside their market coverage without review.

## Review Examples

- HDD per foot depends on soil, depth, ROW, crossings, and restoration.
- MW per month does not prove available power capacity.
- Rack monthly pricing does not prove cabinet availability.
- Dark fiber pair mile pricing does not prove fiber availability.
- Transport pricing depends on term, SLA, port, and network availability.

