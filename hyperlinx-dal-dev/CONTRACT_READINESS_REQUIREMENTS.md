# Contract Readiness Requirements

Status: doctrine and read-only requirement contract.

## Required Authority

Contract readiness requires:

- valid `scopeVersionId`.
- valid `customerId`.
- valid `opportunityId`.
- valid `corridorId`.
- lifecycle state at or beyond `CUSTOMER_ACCEPTED`.
- validated `ENGINEERING_CLOSE`.
- validated `BUDGET_CLOSE`.
- validated `VENDOR_ACCEPTANCE_CLOSE` when vendor scope is applicable.
- validated `CUSTOMER_ACCEPTANCE_CLOSE`.

## Required References

Contract readiness also requires:

- customer legal profile.
- billing profile.
- approved budget.
- approved scope.
- approved vendor selections when applicable.
- approved commercial terms.
- risk notes.
- required exhibits.
- engineering package reference.
- contract reviewer role.

## Meaning

`CONTRACT_READY` means a contract package may be prepared for review or generation.

It does not mean contract execution occurred.

It does not create `CONTRACT_CLOSE`.

It does not authorize Control work.

