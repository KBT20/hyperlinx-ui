# Corridor Design Standards Validation

This validation document proves that design standards can be attached to corridor objects and lenses without changing corridor truth.

## Object Standards

The initial object standards cover:

- REGEN_SITE
- ADM_SITE
- CONDUIT
- FIBER
- DATA_CENTER
- GPU_ARRAY
- SUBSTATION
- TRANSMISSION_LINE
- CARRIER_HOTEL
- CLOUD_ONRAMP
- IX
- PARCEL
- JURISDICTION
- CROSSING
- CONSTRAINT

## Lens Standards

The initial lens standards cover:

- HYPERSCALER
- NEOCLOUD
- DUCT_MONETIZATION
- DARK_FIBER_IRU
- TRANSPORT
- ENTERPRISE
- POWER_AI_EXPANSION

## Fixture Scenarios

Fixtures are defined in:

`src/corridor/fixtures/corridorDesignStandardsFixtures.ts`

Included scenarios:

1. Hyperscaler corridor requiring regen review.
2. Duct monetization corridor requiring spare duct accounting.
3. Dark fiber IRU corridor requiring strand reservation.
4. Transport corridor requiring ADM, regen, and topology review.
5. Enterprise corridor requiring building entry and lateral review.
6. AI expansion corridor requiring power and parcel review.

## Example: Hyperscaler Regen Review

Relevant standards:

- STANDARD-REGEN-SITE-001
- STANDARD-DATA-CENTER-001
- STANDARD-SUBSTATION-001
- STANDARD-CONDUIT-001
- STANDARD-FIBER-001
- LENS-STANDARD-HYPERSCALER-001

Expected Route Engineering focus:

- optical reach
- regen placement
- power availability
- route diversity
- restoration

## Example: Duct Monetization Spare Accounting

Relevant standards:

- STANDARD-CONDUIT-001
- STANDARD-JURISDICTION-001
- LENS-STANDARD-DUCT-MONETIZATION-001

Expected Route Engineering focus:

- duct count
- spare duct
- sale eligibility
- maintenance rights
- ROW evidence

## Example: Dark Fiber IRU

Relevant standards:

- STANDARD-FIBER-001
- STANDARD-DATA-CENTER-001
- STANDARD-CARRIER-HOTEL-001
- LENS-STANDARD-DARK-FIBER-IRU-001

Expected Route Engineering focus:

- strand reservation
- IRU boundary
- handoff design
- splice points
- diversity evidence

## Sales vs Route Engineering Boundary

Sales may express product intent and commercial goals.

Sales may not set engineering truth.

Route Engineering approves or rejects design feasibility, standards exceptions, and ScopeVersion handoff readiness.

## Influence On Prism And Recommendations

Prism may score only with standards context.

Future recommendations must explain which standards apply and which standards remain unreviewed.

Recommendations remain advisory.

## Remaining Risks Before Recommendation Engine

- Standards are not yet enforced.
- Exceptions are not persisted.
- Route Engineering review workflow is not implemented.
- Provider evidence is not yet bound to each evidence requirement.
- Prism scoring does not yet consume standards directly.

These are intentional non-goals for this doctrine phase.
