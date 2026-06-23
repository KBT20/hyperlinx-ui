# Corridor Reference Architecture Catalog

The catalog defines reusable architecture patterns for common customer asks.

Catalog contracts live in:

`src/corridor/CorridorReferenceArchitecture.ts`

## Architecture Types

- HYPERSCALER_LONG_HAUL
- HYPERSCALER_METRO
- HYPERSCALER_MSA_INTERCONNECT
- NEOCLOUD_INTERCONNECT
- AI_POWER_EXPANSION
- DARK_FIBER_IRU
- DUCT_SALE_AND_MAINTENANCE
- TRANSPORT_WAVE
- ENTERPRISE_METRO_ACCESS
- INTERCONNECTION_FABRIC
- CARRIER_WHOLESALE
- REGIONAL_AGGREGATION
- CAMPUS_INTERCONNECT

## HYPERSCALER_LONG_HAUL

Applicable:

- HYPERSCALER lens
- AI_FABRIC role
- BACKBONE_INTERCONNECT role
- LONGHAUL class

Required components:

- Conduit System
- Fiber System
- Optical System
- Regen Plan
- Route Diversity Plan
- Interconnection Plan
- Power Proximity Plan
- Restoration Plan
- Residual Capacity Plan

Required tools include:

- DOT GIS
- Shapefile Translate
- KML/KMZ Translate
- Substation Provider
- Transmission Provider
- Data Center Provider
- Carrier Hotel Provider
- Cloud On-Ramp Provider
- Optical Reach Review
- Regen Spacing Review
- Route Diversity Review
- Dark Fiber IRU Model
- Transport Revenue Model

## HYPERSCALER_METRO

Applicable:

- HYPERSCALER lens
- METRO_AGGREGATION role
- METRO class

Required components:

- Metro Conduit System
- Fiber System
- Interconnection Plan
- Data Center Access Plan
- Cloud On-Ramp Plan
- Jurisdiction Plan
- Crossing Plan
- Maintenance Plan
- Residual Capacity Plan

## NEOCLOUD_INTERCONNECT

Applicable:

- NEOCLOUD lens
- INTERCONNECTION role
- AI_FABRIC overlay

Required components:

- Data Center Interconnect
- Carrier Hotel / IX Plan
- Cloud On-Ramp Plan
- Optical Transport Plan
- Power Dependency Review
- GPU Array Support Plan

## DARK_FIBER_IRU

Applicable:

- DARK_FIBER_IRU lens

Required components:

- Fiber System
- Strand Reservation Plan
- Splice / Handoff Plan
- Route Diversity Plan
- Maintenance Plan
- IRU Boundary Plan

## DUCT_SALE_AND_MAINTENANCE

Applicable:

- DUCT_MONETIZATION lens

Required components:

- Conduit System
- Spare Duct Accounting
- Maintenance Responsibility Plan
- Residual Capacity Plan
- Jurisdiction Plan
- Access Point Plan

## TRANSPORT_WAVE

Applicable:

- TRANSPORT lens

Required components:

- Optical System
- ADM Plan
- Regen Plan
- Protection Model
- SLA / Restoration Plan
- Interconnection Plan

## ENTERPRISE_METRO_ACCESS

Applicable:

- ENTERPRISE lens
- METRO_AGGREGATION role

Required components:

- Lateral Access Plan
- Building Entry Plan
- Fiber System
- Handoff Plan
- Commercial Serviceability Plan
- Maintenance Plan

## AI_POWER_EXPANSION

Applicable:

- POWER_AI_EXPANSION lens
- AI_FABRIC role

Required components:

- Substation Proximity Plan
- Transmission Plan
- Generation Review
- Parcel / Development Site Plan
- Fiber Route Plan
- Future Campus Expansion Plan
