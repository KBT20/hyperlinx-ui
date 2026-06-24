# ScopeVersion Close Authority Doctrine

Status: doctrine and read-only contracts only.

## Purpose

ScopeVersion Close Authority defines how evidence becomes authoritative against a ScopeVersion.

All authoritative closes must occur against a `scopeVersionId`.

No close may exist independently of ScopeVersion authority.

## Core Doctrine

ScopeVersion is the constitutional authority object.

A Close is not authority by itself.

A Close is authoritative only when validated against a ScopeVersion.

Engineering, Marketplace, Budget, Vendor, Customer, Contract, Control, and Field all produce evidence or closure events against a ScopeVersion.

No orphan closes.

No orphan execution.

No state mutation without validated close authority.

## Authority Boundary

This phase does not implement:

- persistence.
- UI.
- Control execution.
- Field execution.
- contract execution.
- Marketplace transaction execution.
- server routes.
- kernel mutation.

The close authority engine validates, evaluates, and audits close objects only.

## Close Authority Rules

A close must:

- have a valid `scopeVersionId`.
- trace to `customerId`, `opportunityId`, and `corridorId`.
- have evidence.
- have an authorized actor role.
- have a close type.
- be immutable once validated.

A close may not:

- directly mutate unrelated entities.
- overwrite another close.
- delete another close.
- validate without evidence.
- validate through `AI_ASSISTANT_ADVISORY`.

A close may supersede prior closes only by creating a new close.

## Marketplace Alignment

Marketplace does not create authority by itself.

Budget Lock becomes authoritative only through `BUDGET_CLOSE` against ScopeVersion.

Vendor award or acceptance becomes authoritative only through `VENDOR_ACCEPTANCE_CLOSE` against ScopeVersion.

Vendor responses remain non-authoritative until closed.

## Contract Alignment

SOF and Contract may be generated after required closes exist.

Contract execution must produce `CONTRACT_CLOSE` against `scopeVersionId`.

Contract does not directly mutate execution state.

SOF and contract readiness depends on validated close authority and lifecycle authority.

Readiness does not create `CONTRACT_CLOSE`.

`CONTRACT_CLOSE` is created only after contract execution.

Control activation follows contract execution and downstream Control authority.

## Control Activation Authority Alignment

Contract execution creates legal obligation through `CONTRACT_CLOSE`.

Control activation creates execution authority through `CONTROL_CLOSE`.

Field activation requires Control authority.

No work package, schedule, crew assignment, or Field execution may be authorized without Control activation against `scopeVersionId`.

## Work Package Generation Alignment

Validated Control authority permits Work Package generation after `CONTROL_ACTIVE`.

Work Packages organize execution and must preserve ScopeVersion traceability.

Field activation requires approved Work Packages.

Work Package generation does not create Field close authority.

## Field Activation Authority Alignment

`CONTROL_ACTIVE` authorizes Field activation when approved Work Packages exist.

Field activation creates Field authority through `FIELD_CLOSE`.

Field executes approved Work Packages.

Field closure occurs through Field Closure Authority and remains separate from Field activation authority.

## Field Closure Authority Alignment

Field activation authorizes work.

Field closure records completed work.

Field closure creates `FIELD_CLOSE` against `scopeVersionId`.

ScopeVersion Close Authority validates closures.

Completion Authority consumes validated `FIELD_CLOSE` events, evaluates completion requirements, and creates
`COMPLETION_CLOSE` against `scopeVersionId`.

Operations Authority consumes `COMPLETION_CLOSE` and creates `OPERATIONS_CLOSE` against `scopeVersionId`.

Operational assets remain governed through ScopeVersion authority.

## Field Alignment

Field closures align with this doctrine when they close against `scopeVersionId`.

Field closure is the operational embodiment of close authority.

## Completion Authority Alignment

`FIELD_CLOSE` provides completion evidence.

`COMPLETION_CLOSE` establishes delivery completion authority.

Completion Authority validates required Work Packages, Objects, Stations, Segments, Deliverables, acceptance criteria, and blocker status before creating `COMPLETION_CLOSE`.

Completion Authority does not activate operations, billing, revenue, or monitoring.

## Operations Authority Alignment

`COMPLETION_CLOSE` provides operational readiness evidence.

`OPERATIONS_CLOSE` establishes operations authority.

Operations Authority validates ownership, support, maintenance, asset inventory, service inventory, documentation, turnover package, acceptance criteria, and blocker status before creating `OPERATIONS_CLOSE`.

Operations Authority does not activate billing, revenue, telemetry, monitoring, ticketing, OSS/BSS, or production service.

## ScopeVersion Lifecycle Authority Alignment

Close Authority validates close evidence.

Lifecycle Authority evaluates whether validated close evidence is sufficient to advance ScopeVersion lifecycle state.

A validated close may satisfy a lifecycle requirement, but it does not independently mutate lifecycle truth.

No lifecycle transition may be inferred from a close unless the transition is allowed by the ScopeVersion lifecycle model and approved by transition authority.
