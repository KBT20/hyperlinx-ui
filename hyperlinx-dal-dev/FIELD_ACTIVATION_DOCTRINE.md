# Field Activation Doctrine

Status: doctrine, contracts, readiness validation, activation authority, and audit only.

## Purpose

Field Activation Authority establishes the constitutional boundary between execution planning and field execution.

Control authorizes execution.

Field performs execution.

Field may execute approved work.

Field may not alter ScopeVersion truth.

Field may only close work against approved ScopeVersion authority in a future closure phase.

## Core Doctrine

Field activation requires:

- `CONTROL_ACTIVE`.
- approved Work Packages.
- ScopeVersion traceability.
- allocation authority.
- dependency readiness.

Field activation occurs only through Field Activation Authority against `scopeVersionId`.

## Prohibited Activation Sources

Field may not activate directly from:

- Contract.
- Marketplace.
- Budget.
- Prism.
- Engineering.

These sources may provide evidence upstream, but they do not activate Field.

## Boundary

This phase does not implement:

- crew scheduling.
- route optimization.
- Field closure.
- completion logic.
- operational activation.
- persistence.
- server routes.
- kernel mutation.

## Field Closure Authority Alignment

Field activation authorizes work.

Field closure records completed work.

ScopeVersion Close Authority validates closures through `FIELD_CLOSE`.

Completion Authority consumes validated closures in a future phase.
