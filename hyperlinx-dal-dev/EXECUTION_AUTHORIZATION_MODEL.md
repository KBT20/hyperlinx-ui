# Runtime Promotion Authorization Model

Status: Active constitutional model

Runtime promotion is the constitutional boundary where a Certified Draft IOF Package and executed Service Order become executable ScopeVersion truth.

ScopeVersion is the Order for Execution.

Everything before ScopeVersion is planning and commercial authorization.

Everything after ScopeVersion is execution.

## Rule

ScopeVersion may be generated only after:

- Certified Draft IOF Package exists
- Customer has executed the Service Order

ScopeVersion may not originate from:

- Proposal
- Customer approval
- Draft IOF Package
- unsigned Service Order
- Marketplace
- Contract
- Control
- Field

## Certification Evidence

Certification evidence records the Engineering certification of the Draft IOF Package.

It may use legacy certificate-shaped storage, but it is not execution authority and does not authorize ScopeVersion creation by itself.

Runtime promotion records:

- Proposal ID
- Draft IOF Package ID
- Certified Draft IOF Package ID
- Executed Service Order ID
- Customer signature evidence
- ScopeVersion ID
- Runtime promotion actor
- certification timestamp
- Engineering checklist results
- authority transfer
- Runtime Object count
- Relationship count
- Evidence count
- certification confidence
- certified assembly fingerprint

The evidence record is persisted in the Runtime and registered as Runtime Evidence.

## Downstream Gate

Engineering Certification stops at Certified Draft IOF Package readiness.

Runtime creates ScopeVersion only after executed Service Order authority exists.

The created ScopeVersion becomes the Order for Execution.

Marketplace is a downstream consumer of the executable ScopeVersion and is not activated by certification.
