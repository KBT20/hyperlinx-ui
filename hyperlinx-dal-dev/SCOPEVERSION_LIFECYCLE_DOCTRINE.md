# ScopeVersion Lifecycle Doctrine

Status: doctrine, contracts, and read-only evaluation only.

## Purpose

ScopeVersion Lifecycle Authority defines when a ScopeVersion may move from one lifecycle state to another.

ScopeVersion remains the constitutional state object.

Close events provide validated evidence.

Transition authority evaluates whether that evidence is sufficient to advance lifecycle state.

## Core Doctrine

ScopeVersion lifecycle advancement requires:

- an existing `scopeVersionId`.
- a valid current lifecycle state.
- an allowed target lifecycle state.
- an authorized actor role.
- required validated closes for the target state.
- an audit record describing the decision.

AI reasoning, recommendations, scoring, and advisory outputs may provide evidence.

They may not advance lifecycle state.

## Authority Separation

Close Authority answers:

Is this close valid?

Lifecycle Authority answers:

May this ScopeVersion transition now?

A valid close is necessary for governed transitions, but it is not always sufficient. The transition must also be allowed by the lifecycle state model and actor authority.

## Non-Mutation Boundary

This phase does not persist state, update ScopeVersions, create server routes, or modify execution workspaces.

The lifecycle engine evaluates transitions and creates audits only.

Future execution phases may consume these contracts to perform governed persistence.

## Constitutional Rules

- ScopeVersion is truth.
- Certified objects are evidence.
- Close events are authorized evidence.
- Lifecycle transitions are governed decisions.
- No workspace may independently derive lifecycle truth.
- No transition may be inferred from UI display state.
- No transition may be inferred from reasoning output alone.
- No transition may bypass close authority where closes are required.

## Contract and SOF Readiness Alignment

SOF and contract readiness depends on ScopeVersion Close Authority and Lifecycle Authority.

Readiness requires lifecycle progression at or beyond `CUSTOMER_ACCEPTED`.

Readiness is not execution and does not advance lifecycle state.

Contract execution creates `CONTRACT_CLOSE`.

Control activation follows `CONTRACT_CLOSE` and Control authority.

## Control Activation Authority Alignment

Contract execution creates legal obligation.

Control activation creates execution authority.

Lifecycle progression must preserve:

```text
CONTRACT_EXECUTED
  -> CONTROL_READY
  -> CONTROL_ACTIVE
```

Field activation requires Control authority and may not bypass `CONTROL_ACTIVE`.

## Work Package Generation Alignment

`CONTROL_ACTIVE` authorizes Work Package generation.

Work Packages organize execution under ScopeVersion authority.

Work Packages do not mutate ScopeVersion truth.

Field activation requires approved Work Packages and may not bypass Control authority.

## Field Activation Authority Alignment

`CONTROL_ACTIVE` authorizes Field activation when approved Work Packages exist.

Lifecycle progression must preserve:

```text
CONTROL_ACTIVE
  -> FIELD_READY
  -> FIELD_ACTIVE
```

Field executes approved Work Packages.

Field closure occurs through Field Closure Authority and may not be inferred from Field activation.

## Field Closure Authority Alignment

Field activation authorizes work.

Field closure records completed work as closure evidence.

Validated Field closures do not directly create `COMPLETE`.

Completion Authority consumes validated `FIELD_CLOSE` events.

Completion Authority validates completion requirements and creates `COMPLETION_CLOSE`.

Lifecycle progression must preserve:

```text
FIELD_ACTIVE
  -> COMPLETION_REVIEW
  -> COMPLETE
```

Operations Authority consumes `COMPLETION_CLOSE`.

## Operations Authority Alignment

Completion Authority creates `COMPLETION_CLOSE`.

Operations Authority consumes `COMPLETION_CLOSE`.

Operations Authority validates operational readiness and creates `OPERATIONS_CLOSE`.

Lifecycle progression must preserve:

```text
COMPLETE
  -> OPERATIONS
```

Operational assets remain governed through ScopeVersion authority.
