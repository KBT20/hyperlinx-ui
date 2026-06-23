# Corridor Object Design Standards

Object-level standards describe what each corridor object requires before it may influence engineering decisions.

These standards are doctrine and contract data only. They do not perform scoring, routing, recommendations, persistence, provider calls, or ScopeVersion creation.

Reference Architecture determines which object standards must be considered for a customer ask.

Lens determines which object standards are most relevant for a commercial or strategic view.

Route Engineering remains authority.

## REGEN_SITE

Regen spacing depends on optical design, fiber type, wavelength platform, latency objective, and SLA.

Regen placement must consider:

- power
- access
- security
- route diversity
- shelter
- generator backup
- maintenance access

Sales may not set regen spacing.

Route Engineering must review.

## ADM_SITE

ADM placement depends on aggregation, add/drop requirements, topology, and service model.

ADM sites must be reviewed for:

- power
- space
- access
- protection
- service topology

## CONDUIT

Conduit standards must track:

- duct count
- duct size
- spare duct
- occupied duct
- sale-eligible duct
- maintenance requirements

Residual capacity must be tracked separately from committed capacity.

## FIBER

Fiber standards must track:

- fiber count
- strand reservation
- IRU eligibility
- transport eligibility
- future growth

Sales may sell only approved capacity.

## DATA_CENTER

Data center standards must evaluate:

- entry diversity
- meet-me access
- handoff point
- cross-connect feasibility
- latency target

## GPU_ARRAY

GPU array standards must evaluate:

- power dependency
- low-latency transport
- data center proximity
- expansion land
- high-capacity fiber

## SUBSTATION

Substation proximity matters, but available capacity must be evidence-backed.

Power availability is not assumed from location alone.

## TRANSMISSION_LINE

Transmission lines are evidence only.

Transmission geometry does not imply serviceability or capacity.

## CARRIER_HOTEL

Carrier hotel standards must evaluate:

- interconnection value
- cross-connect availability
- cloud on-ramp proximity
- handoff feasibility

## CLOUD_ONRAMP

Cloud on-ramps influence:

- hyperscaler relevance
- interconnection value
- transport design impact

Cloud access capacity must be verified by provider or facility evidence.

## IX

IX objects contribute peering and interconnection value.

They require facility, handoff, and participant relevance evidence before supporting engineering decisions.

## PARCEL And DEVELOPMENT_SITE

Parcel and development-site standards must evaluate:

- usable land
- zoning
- power proximity
- road access
- fiber proximity
- ownership confidence

## JURISDICTION

Jurisdiction standards must identify:

- permit owner
- lead time
- complexity
- risk
- authority

## CROSSING

Crossing standards must capture:

- crossing type
- owner
- method
- cost
- permit
- schedule risk

## CONSTRAINT

Constraint standards must capture:

- severity
- mitigation
- affected segments
- review requirement

## Contract Location

The object standard contract and initial standard set live in:

`src/corridor/CorridorDesignStandards.ts`
