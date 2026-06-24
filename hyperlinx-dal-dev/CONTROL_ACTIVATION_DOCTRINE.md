# Control Activation Doctrine

Status: doctrine, contracts, validation fixtures, and read-only authority evaluation only.

## Purpose

Control Activation Authority establishes the constitutional boundary between planning and execution.

Contract execution creates legal obligation.

Control activation creates execution authority.

No work may be created, assigned, scheduled, or activated until Control Authority validates activation.

## Core Doctrine

Control is responsible for:

- execution planning.
- execution governance.
- work authorization.
- execution readiness.

Control is not Field.

Control authorizes Field.

No ScopeVersion may enter execution without Control Activation Authority.

## Authority Boundary

This phase does not implement:

- work package creation.
- station assignment.
- segment assignment.
- crew assignment.
- scheduling.
- Field activation.
- persistence.
- server routes.
- kernel mutation.

The Control Activation Engine evaluates readiness, creates a `CONTROL_CLOSE` draft, validates activation authority, and creates an audit only.

## Prohibited Activation Sources

Control activation may not be created directly from:

- Prism.
- Preliminary Quote.
- Budget Candidate.
- Budget Lock.
- Award Recommendation.
- Contract Readiness.

These artifacts may provide evidence, but they do not create execution authority.

## Work Package Generation Alignment

`CONTROL_ACTIVE` authorizes Work Package generation.

Work Packages organize execution.

Field activation requires approved Work Packages.

Work Package generation does not create schedules, crew assignments, Field activation, or execution.

## Field Activation Authority Alignment

`CONTROL_ACTIVE` authorizes Field activation only when approved Work Packages exist.

Field executes approved Work Packages.

Field activation creates Field authority.

Field closure occurs in a future phase.
