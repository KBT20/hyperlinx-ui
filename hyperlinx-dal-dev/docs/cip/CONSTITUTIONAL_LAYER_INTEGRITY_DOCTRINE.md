# CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE

Date: 2026-07-04
Program: Constitutional Infrastructure Platform
Status: Permanent constitutional doctrine

## Purpose

IOF is a constitutional lifecycle system. Each layer must complete its authority before the next layer may advance.

The platform shall never skip a constitutional layer to make the UI appear complete.

## Principle

A fulfillment request may advance only through lawful constitutional transitions.

Every layer has:

- a defined authority
- required inputs
- required artifacts
- validation rules
- allowed outputs
- downstream consumers

If a required layer is incomplete, missing, invalid, or not yet implemented, the runtime must block advancement and explain why.

## Core Rule

NO LAYER SKIP.

A higher layer shall not fabricate, infer, or substitute missing lower-layer truth.

## Layer Chain

```text
Customer Ask
  -> Fulfillment Request
  -> Commercial Planning
  -> Product Doctrine
  -> Commercial Audit
  -> Audit Object Manifest
  -> Object Addressing
  -> Spine Object Catalog
  -> Production Doctrine
  -> Spine Object Instantiation
  -> Kernel Execution Graph
  -> Constitutional Assembly
  -> Engineering Certification
  -> Draft IOF Approval
  -> Proposal
  -> Customer Acceptance
  -> Service Order
  -> ScopeVersion
  -> Marketplace
  -> Control
  -> Field
  -> Closure
  -> Operational Twin
  -> Operational Intelligence
  -> Prism / Next Fulfillment Request
```

## Layer Responsibilities

Commercial answers:

- What are we selling?
- What are we building?
- Is it financially sound?

Engineering answers:

- Is it present?
- Is it addressed?
- Is it placed correctly?
- Is it certifiable?

Service Order answers:

- Has the customer authorized this exact fulfillment?

ScopeVersion answers:

- What is the immutable execution truth?

Control answers:

- What work is authorized?

Field answers:

- What work was actually completed?

Closure answers:

- What evidence validates completion?

Twin answers:

- What is operational?

Prism answers:

- What should be fulfilled next?

## Runtime Behavior

If a required artifact is missing, the runtime shall:

- block the transition
- preserve current state
- identify the missing layer
- identify missing artifacts
- identify required authority
- identify next legal action

The runtime shall not:

- create fake readiness
- bypass Engineering
- create Service Order without acceptance
- create ScopeVersion without Service Order
- allow Customer Acceptance to create execution truth directly
- allow Field to close objects not in ScopeVersion
- allow payment without validation

## Enforcement

Runtime validation must enforce these gates:

- lifecycle stages cannot be skipped
- missing authority blocks advancement
- blocked state explains required next legal action
- ScopeVersion cannot be created before Service Order
- Service Order cannot be created before Customer Acceptance
- Customer Acceptance cannot create execution truth directly
- Field cannot close objects outside ScopeVersion
- payment cannot become eligible without validated Close

The runtime implementation records this doctrine as:

- Doctrine ID: `CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE`
- Doctrine path: `docs/cip/CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE.md`
- Validator: `src/scopeversion/ConstitutionalLayerIntegrity.ts`

## Doctrine Statement

The OSI model is unforgiving because each layer depends on the integrity of the layer beneath it.

IOF follows the same principle.

If Product Doctrine is wrong, the audit is wrong.
If addressing is missing, objects are ungoverned.
If instantiation is missing, Engineering has nothing to certify.
If Engineering is skipped, ScopeVersion is invalid.
If Service Order is missing, execution has no commercial authority.
If ScopeVersion is missing, Field has no truth to execute.
If Closure is missing, payment is not earned.

## Constitutional Rule

No Close.
No Validation.
No Payment.

No Engineering Certification.
No Service Order.

No Service Order.
No ScopeVersion.

No ScopeVersion.
No Execution.

## Future CIP References

Future CIPs must cite this doctrine when defining or modifying any of these layers:

- Engineering Certification
- Proposal Artifact
- Customer Acceptance
- Service Order
- ScopeVersion
- Control
- Field
- Closure

