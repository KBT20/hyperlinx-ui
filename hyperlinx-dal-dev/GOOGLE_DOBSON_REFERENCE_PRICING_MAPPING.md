# Google Dobson Reference Pricing Mapping

Phase: 7.4D

## Purpose

This document maps the first Google/Dobson hyperscaler opportunity into reusable, customer-neutral pricing structures.

## Reference Artifacts

- `Google Fiber Project - 20251121.xlsx`
- `Dobson ILA Cost Summary 27 vs 36 Racks.xlsx`
- Google Helium RFP package / RFP response sheet

## Mapped Patterns

| Reference Pattern | Customer-Neutral Model |
| --- | --- |
| Route segment workbook rows | `OspSegmentPricing` |
| Master OSP build metrics | OSP unit-cost and route summary fields |
| Fiber summary | `FiberRoutePricingSummary` |
| ILA locations | ILA / regen site count and profile selection |
| 18-rack cost sheet | `ILA_18_RACK_SINGLE_WIDE` |
| 36-rack cost sheet | `ILA_36_RACK_DOUBLE_WIDE` |
| 20% markup examples | `MarkupPoints` |
| IRU price summary | `CostPlusPricingModel.sellPrice` |
| KMZ/RFP package | route evidence and customer fixture context |

## Boundary

The mapping does not import production rates. It only seeds a reference-derived development profile.

Google is a fixture. The engine remains customer-neutral for future Google, Microsoft, Meta, AWS, Oracle, CoreWeave, carrier, utility, and enterprise opportunities.

