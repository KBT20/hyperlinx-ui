# Execution Authorization Model

Status: Sprint 13.4 Runtime Model

Execution Authorization is the constitutional boundary where Engineering-certified truth becomes executable ScopeVersion truth.

## Rule

ScopeVersion may be generated only from a Certified IOF Package.

ScopeVersion may not originate from:

- Proposal
- Customer approval
- Draft IOF Package
- Marketplace
- Contract
- Control
- Field

## Execution Authorization Certificate

Sprint 13.4 creates an `EXECUTION_AUTHORIZATION_CERTIFICATE` for each certified package.

The certificate records:

- Proposal ID
- Draft IOF Package ID
- Certified IOF Package ID
- ScopeVersion ID
- Engineering approver
- certification timestamp
- Engineering checklist results
- authority transfer
- Runtime Object count
- Relationship count
- Evidence count
- certification confidence
- certified assembly fingerprint

The certificate is persisted in the Runtime and registered as Runtime Evidence.

## Downstream Gate

Certification stops after ScopeVersion creation. Marketplace is the first future consumer of the executable ScopeVersion, but Marketplace is not implemented or activated in this sprint.
