# Field Closure Authority Doctrine

Status: doctrine, contracts, validation, closure authority alignment, and audit only.

## Purpose

Field Closure Authority aligns field closure activity to the constitutional authority model.

Field performs work.

Field records completion evidence.

Field submits closure events.

ScopeVersion Close Authority validates closure events.

Lifecycle Authority advances state in later phases.

## Core Doctrine

Field work does not directly modify truth.

Field work produces closure evidence.

Validated closure events become authoritative through ScopeVersion Close Authority.

All closure events resolve through `scopeVersionId`.

## Authority Boundary

Field closure may not:

- advance lifecycle directly.
- modify budget authority.
- modify engineering authority.
- modify contract authority.
- modify ScopeVersion truth directly.

This phase does not implement:

- completion calculations.
- operations activation.
- schedule management.
- execution logic changes.
- persistence.
- server routes.
- kernel mutation.

## Close Authority Alignment

Field closure creates `FIELD_CLOSE` against `scopeVersionId`.

`FIELD_CLOSE` is closure evidence, not completion.

Completion Authority consumes validated `FIELD_CLOSE` events, validates completion requirements, and creates
`COMPLETION_CLOSE` against the same `scopeVersionId`.

Operations Authority consumes `COMPLETION_CLOSE` in a later phase.
