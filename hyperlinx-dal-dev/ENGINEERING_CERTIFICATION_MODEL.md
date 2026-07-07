# Engineering Certification Model

Status: Sprint 13.4 Runtime Model

Engineering Certification certifies the Draft IOF Package.

It does not create ScopeVersion.

Engineering Certification means:

"The Draft IOF Package is complete, constructable, constitutionally valid, and ready for customer commitment."

## Authority

- Commercial owns Proposal creation and revision.
- Customer owns Proposal approval.
- Runtime assembles the Draft IOF Package from Commercial Planning inputs before Engineering Certification.
- Engineering owns technical review and certifies the Draft IOF Package only.
- Proposal is a commercial projection of the currently certified Draft IOF Package.
- Customer change requests return to Draft IOF Package revision, Engineering re-certification, and a new Proposal.
- Service Order owns commercial authorization.
- Service Order references the Certified Draft IOF Package, Proposal, Customer Acceptance, and commercial terms.
- A signed Service Order triggers Runtime ScopeVersion creation.

## Review Queue

The Engineering Review Queue is exposed through:

- `GET /api/engineering/certification/queue`

Queue records include Draft IOF Package readiness, proposal summary, commercial confidence, engineering readiness, assembly report, package status, assigned engineer, priority, submission date, customer, opportunity, and proposed unit counts.

## Unit Certification

Each Proposed IOF Unit supports:

- certify
- modify
- reject
- split
- merge

Certified units become immutable. Later changes require a new proposal revision and a new certification cycle.

## Package Certification

Package certification requires:

- all Proposed IOF Units certified
- completed Engineering Certification checklist
- certification confidence greater than zero

Successful package certification marks the Draft IOF Package as the Certified Draft IOF Package and persists certification evidence.

Compatibility records may carry `Certified IOF Package` identifiers, but they are references to the same Certified Draft IOF Package, not separate engineering truth.

It does not create an Execution Authorization Certificate or executable ScopeVersion.

ScopeVersion creation is reserved for the signed Service Order runtime gate.

## Commercial Projections

Proposal and Service Order shall not recreate engineering.

They reference the Certified Draft IOF Package and may project its technical content for customer review and commercial authorization.

Commercial Release 2 legal sections are placeholders only until the legal and business content model is explicitly implemented.
