# Contract and SOF Readiness Doctrine

Status: doctrine, contracts, and read-only evaluation only.

## Purpose

Contract and SOF readiness verifies whether a ScopeVersion has enough validated commercial, engineering, customer, and vendor evidence to prepare legal and service-order artifacts.

Readiness does not generate a Service Order Form.

Readiness does not generate a contract.

Readiness does not execute a contract.

Readiness does not create Control or Field work.

## Core Doctrine

SOF and contract generation require readiness.

Readiness requires:

- ScopeVersion traceability.
- lifecycle state at or beyond `CUSTOMER_ACCEPTED`.
- validated ScopeVersion close evidence.
- locked budget reference.
- approved product and object package references.
- no unresolved high-severity blockers.
- no rejected lifecycle transition.

## Authority Boundary

Readiness is a gate.

It is not obligation and not execution.

Contract execution creates legal obligation through `CONTRACT_CLOSE`.

Control activation creates execution authority after contract execution and Control authority.

## Control Activation Authority Alignment

Contract/SOF readiness does not create execution authority.

Contract execution creates legal obligation.

Control activation creates execution authority.

Field activation requires Control authority.

## Close and Lifecycle Alignment

`ENGINEERING_CLOSE` permits engineering package use.

`BUDGET_CLOSE` permits budget use.

`VENDOR_ACCEPTANCE_CLOSE` permits vendor scope use when vendor scope is applicable.

`CUSTOMER_ACCEPTANCE_CLOSE` permits SOF and contract readiness.

`CONTRACT_CLOSE` is created only after contract execution.

`CONTRACT_CLOSE` is not created by readiness.
