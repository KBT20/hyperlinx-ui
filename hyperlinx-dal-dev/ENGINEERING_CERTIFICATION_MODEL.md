# Engineering Certification Model

Status: Sprint 13.4 Runtime Model

Engineering Certification is the pre-execution gate between Draft IOF Package assembly and executable ScopeVersion authority.

## Authority

- Commercial owns Proposal creation and revision.
- Customer owns Proposal approval.
- Runtime assembles the Draft IOF Package from approved Proposal references.
- Engineering owns technical review and certification.
- Execution authority begins only when a Certified IOF Package generates a ScopeVersion.

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

Successful package certification creates a Certified IOF Package, an Execution Authorization Certificate, Runtime History, Runtime Evidence, and an executable ScopeVersion.
