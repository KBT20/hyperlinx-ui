# Commercial Planning Workspace vNext

Audit date: June 27, 2026

Scope: Hyperlinx DAL sales-facing workspace consolidation.

Status: DAL workspace doctrine and UI consolidation. No Kernel orchestration, no ScopeVersion creation, no inventory graph authority, no lifecycle mutation, no Marketplace execution, no Control, no Field, no Twin, and no Operational Intelligence authority.

## Mission

Commercial Planning is the Account-first front door to Hyperlinx and IOF.

It consolidates the existing sales-facing workspaces into one Sales environment:

- Translate;
- Teralinx Route;
- Bid Workspace;
- Proposed Network;
- Preliminary Proposal;
- Site Decision;
- Candidate Sites;
- Portfolio.

The underlying logic remains valuable and should be reused. The UI should hide implementation boundaries and expose the commercial workflow.

## Primary Object

Everything begins with an Account.

Every commercial object belongs to exactly one Account:

- CRM contacts;
- opportunities;
- existing networks;
- imported customer networks;
- proposed networks;
- commercial engagements;
- proposal revisions;
- customer review history;
- engineering handoff history.

Switching accounts must isolate customer data. Google data must not appear in FiberLight, Verizon, Crown Castle, municipal, or enterprise account contexts.

## Commercial Engagement

Every opportunity creates one Commercial Engagement.

The engagement is the Sales-owned commercial record until customer acceptance. It contains documents, existing networks, proposed networks, commercial plans, customer comments, attachments, proposal revisions, review state, and engineering handoff status.

The engagement remains non-authoritative for infrastructure truth.

## Network Authority

Networks are first-class account-owned objects.

Authority states include:

- Existing;
- Imported;
- Customer Draft;
- Commercial Draft;
- Engineering Draft;
- Certified;
- Operational.

Imported customer networks are customer assets, not proposals. Identity remains stable as authority changes.

## Workflow

Commercial Planning guides Sales through:

```text
Select Account
  -> Create or Open Commercial Engagement
  -> Import Existing Networks
  -> Import or Design Proposed Network
  -> Review Suggested Design Template
  -> Commercial Planning
  -> Draft IOF Package
  -> Engineering Certification
  -> Proposal
  -> Customer Collaboration
  -> Customer Acceptance
  -> Service Order
  -> Signature-ready Service Order
```

Signed Service Order readiness is the commercial authorization boundary for CIP-013.

## Engineering Boundary

Engineering certifies the Draft IOF Package: geometry, stationing, constraints, constructability, materials, dependencies, sequence, and evidence.

The Draft IOF Package is the single engineering truth through the commercial lifecycle.

Engineering Certification does not create ScopeVersion.

Engineering Certification means the Draft IOF Package is complete, constructable, constitutionally valid, and ready for customer commitment.

Proposal and Service Order reference the Certified Draft IOF Package. They do not recreate engineering truth.

Runtime ScopeVersion creation begins only after a signed Service Order.

```text
Draft IOF Package
  -> Engineering Certification
  -> Proposal
  -> Customer Acceptance
  -> Service Order
  -> Signature-ready Service Order
  -> Customer Signature
  -> ScopeVersion Created
  -> Marketplace
  -> Control
  -> Field
  -> Twin
  -> Operational Intelligence
```

Commercial Planning does not create ScopeVersion, Marketplace, Control, Field, Twin, or Operational Intelligence authority. Service Order readiness is commercial authorization only; the signed Service Order is the Runtime trigger for ScopeVersion creation.

ScopeVersion is the Order for Execution. Proposal is not executed. Service Order is not executed. Draft IOF Package is not executed. ScopeVersion is executed.

If the customer requests changes during review, Commercial returns to Draft IOF Package revision, Engineering re-certification, and a new Proposal.

## Current DAL Implementation Slice

The current DAL slice adds an Account-first Commercial Planning shell around the existing Google Helium bid workflow.

It preserves existing pricing, route review, corridor revision, vendor response preview, supporting information, and commercial recalculation logic while introducing:

- Account selector;
- CRM summary;
- Commercial Engagement view;
- Network authority view;
- Design Template Assistant view;
- Opportunity Analysis view;
- Proposal Builder view;
- Customer Review view;
- Engineering Handoff view.

This is a UI consolidation step, not a production persistence layer.
