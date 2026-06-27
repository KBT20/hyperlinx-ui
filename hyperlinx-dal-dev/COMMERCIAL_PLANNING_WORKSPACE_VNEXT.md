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
  -> Build Commercial Proposal
  -> Customer Collaboration
  -> Customer Acceptance
  -> Transfer Ownership to Engineering
```

The customer acceptance event ends Sales ownership.

## Engineering Boundary

Engineering receives the accepted proposal package and validates geometry, stationing, constraints, constructability, materials, and evidence.

Only Engineering may create a ScopeVersion.

Kernel orchestration begins at Engineering Review, after Sales has completed the commercial process.

```text
Accepted Proposal
  -> Engineering Review
  -> ScopeVersion
  -> Service Order Form
  -> Customer Signature
  -> Marketplace
  -> Control
  -> Field
  -> Twin
  -> Operational Intelligence
```

Commercial Planning does not generate execution paperwork. Service Order Form generation occurs only after Engineering certifies the ScopeVersion.

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
