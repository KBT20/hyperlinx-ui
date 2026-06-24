# ScopeVersion Close Event Model

Status: doctrine and read-only contracts only.

## Required Event Fields

Every ScopeVersion close event must include:

- `closeId`.
- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- `closeType`.
- `authority`.
- `actorId`.
- `actorRole`.
- `evidenceIds`.
- `inputReferences`.
- `constraintReferences`.
- `outcome`.
- `createdAt`.
- `validatedAt`.
- `immutable`.

## Close Event Meaning

A close event records an authorized transition, acceptance, commitment, completion, or financial milestone against a ScopeVersion.

The event itself is not authority until validation confirms:

- traceability.
- actor authority.
- evidence.
- close type.
- immutability.

## Outcome Model

Close outcome may include:

- accepted.
- rejected.
- superseded.
- no state change.

Outcome should preserve:

- previous state.
- resulting state.
- superseded close id when applicable.
- notes.

## Reference Model

Close events preserve:

- input references.
- constraint references.
- evidence ids.

References allow replay and audit without relying on passive logs.

## Immutability

Validated closes are immutable.

Corrections must create a superseding close.

No deletion.

No overwrite.

## ScopeVersion Lifecycle Authority Alignment

Close events are lifecycle evidence.

They are not lifecycle mutation records by themselves.

Lifecycle advancement requires a separate transition evaluation that checks:

- current ScopeVersion state.
- requested target state.
- actor authority.
- required validated closes.
- transition audit creation.

This keeps close validation, lifecycle transition authority, and ScopeVersion truth separate but traceable.
