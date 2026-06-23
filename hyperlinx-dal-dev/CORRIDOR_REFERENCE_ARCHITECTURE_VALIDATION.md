# Corridor Reference Architecture Validation

This validation confirms that customer asks can be mapped to reusable reference architectures without creating execution truth.

Fixtures live in:

`src/corridor/fixtures/corridorReferenceArchitectureFixtures.ts`

## Matched Architecture Examples

## Dallas To Kansas City Hyperscaler Long Haul

Ask:

400G/800G ready, route diversity, future AI expansion.

Expected architecture:

HYPERSCALER_LONG_HAUL

Required tools include:

- DOT GIS
- KML/KMZ Translate
- Substation Provider
- Transmission Provider
- Data Center Provider
- Optical Reach Review
- Regen Spacing Review
- Route Diversity Review

Required standards include:

- STANDARD-CONDUIT-001
- STANDARD-FIBER-001
- STANDARD-REGEN-SITE-001
- LENS-STANDARD-HYPERSCALER-001

## Data Center To Carrier Hotel In Same MSA

Expected architecture:

HYPERSCALER_METRO

Review focus:

- facility handoff
- jurisdiction review
- crossing plan
- maintenance access

## GPU Array To Cloud On-Ramp

Expected architecture:

NEOCLOUD_INTERCONNECT

Review focus:

- GPU support
- cloud access
- interconnection density
- power dependency

## Spare Duct Sale And Maintenance

Expected architecture:

DUCT_SALE_AND_MAINTENANCE

Review focus:

- spare duct accounting
- sale eligibility
- maintenance rights
- jurisdiction

## Fiber Pair IRU With Diverse Routing

Expected architecture:

DARK_FIBER_IRU

Review focus:

- strand reservation
- IRU boundary
- handoff
- route diversity

## Protected Wavelength Service

Expected architecture:

TRANSPORT_WAVE

Review focus:

- optical reach
- ADM placement
- regen placement
- SLA restoration

## Enterprise Building Lateral

Expected architecture:

ENTERPRISE_METRO_ACCESS

Review focus:

- building entry
- lateral constructability
- service availability
- maintenance

## West Texas Data Center Footprint To Dallas

Expected architecture:

AI_POWER_EXPANSION

Review focus:

- power capacity evidence
- parcel suitability
- fiber route context
- future campus expansion

## Missing Tool Evidence Example

If HYPERSCALER_LONG_HAUL lacks Substation Provider or Transmission Provider evidence, the fit engine reports missing tool evidence.

That does not reject the corridor.

It tells Route Engineering and Prism that power context is incomplete.

## Route Engineering Review Boundary

Reference Architecture may identify what should be considered.

Route Engineering decides whether the architecture is accepted, redlined, expanded, or rejected.

## Remaining Risks Before Prism Recommendation Engine

- Architecture fit is read-only and does not score.
- Missing evidence is diagnostic only.
- Standards exceptions are not persisted.
- Route Engineering workflow is not implemented.
- Recommendations are future work.
