# Sprint 16 Lifecycle Persistence Audit

## Result

Sprint 16 fixes the Account Workspace Add Contact crash and audits which StellaOS objects must survive refresh, logout/login, and server restart before additional feature layers are added.

The immediate UI crash was caused by Contact input handlers reading `event.currentTarget.value` inside functional state updaters. React may clear `currentTarget` after the event handler. The form now captures values before updating state and always resets to default empty Contact values.

## Persistence Doctrine

StellaOS persists state, authority, relationships, and lifecycle.

UI-only state does not become runtime unless explicitly promoted by an operator action. Panel open state, tabs, map zoom, scroll position, unsaved form drafts, and modal visibility remain transient interface behavior.

Audit question:

If an operator logs out today and another operator logs in tomorrow, the governed object, its authority, its relationships, and its runtime history must still exist for work to continue naturally.

## Lifecycle Persistence Matrix

| Item | Persistent | Persistence Location | Owning ID | Required Parents / Relationships | Runtime History | Twin | Authority Required | Survives Refresh / Restart | Consuming Workspace |
|---|---:|---|---|---|---:|---:|---:|---:|---|
| Account | Yes | `server/data/accounts`, Runtime Object Library | `accountId` | Organization, workspace, contacts, opportunities | Yes | Yes | Account owner / commercial authority | Yes | Commercial Planning, Account Workspace, Twin |
| Contact | Yes | `server/data/contacts`, Runtime Object Library | `contactId` | `accountId`, `customerId`, recipient workflow flags | Yes | Yes | Account owner / commercial authority | Yes | Account Workspace, Proposal, Customer Review, SOF recipients |
| Opportunity | Yes | `server/data/commercial-opportunities`, Runtime Objects | `opportunityId` | `accountId`, Customer Twin, selected scope | Yes | Yes | Commercial owner / contributor / approver | Yes | Commercial Planning, Runtime Bridge |
| Product | Yes | `server/data/products`, Runtime Objects | `productId` | Product definition/version | Yes | Yes | Product definition authority | Yes | Account Workspace, Product Fulfillment, Runtime Bridge |
| Product Configuration | Yes when submitted | Fulfillment Plan and Proposal records | `productId` + `fulfillmentPlanId` | Selected Product, scope, pricing/config inputs | Through Product/Fulfillment events | Through Product/Fulfillment Plan | Commercial authority | Yes | Product Fulfillment, Proposal, Engineering |
| Inventory Resolution | Yes | Fulfillment Plan, Runtime History | `fulfillmentPlanId` | Existing/customer/partner/marketplace/new infrastructure refs | Yes | Via Fulfillment Plan | Commercial/Product fulfillment authority | Yes | Product Fulfillment, Engineering |
| Fulfillment Plan | Yes | `server/data/fulfillment-plans`, Runtime Objects | `fulfillmentPlanId` | `accountId`, `opportunityId`, `productId`, ownership classes | Yes | Yes | Product fulfillment authority | Yes | Product Fulfillment, Proposal, Twin |
| Proposal | Yes | `server/data/proposal-drafts`, Runtime Objects | `proposalId` | `accountId`, `opportunityId`, Product, Fulfillment Plan, contacts | Yes | Yes | Commercial owner / approver / reviewer | Yes | Proposal Workspace, Customer Review |
| Customer Review | Yes | Proposal status, review tasks, Runtime Objects/History | `proposalId` | Proposal, customer user IDs, contact IDs | Yes | Review task may appear as runtime object | Customer review authority | Yes | Customer Workspace, Proposal |
| Customer Approval | Yes | Proposal approvals, Runtime History | `approvalId` on `proposalId` | Proposal and customer reviewer authority | Yes | Through Proposal | Customer participant authority | Yes | Proposal, Runtime Bridge |
| Draft IOF Package | Yes | `server/data/iof-packages`, Runtime Objects | `packageId` | Approved Proposal, runtime/evidence/geometry refs | Yes | Engineering runtime object | Engineering review authority | Yes | Engineering Certification |
| Engineering Review | Yes | Draft IOF package workflow, review queue projection | `packageId` | Draft IOF Package, proposed IOF units | Yes | Through Draft IOF package | Engineering authority | Yes | Engineering Certification |
| Certified IOF Package | Yes | `server/data/certified-iof-packages`, Runtime Objects | `certifiedPackageId` | Draft IOF Package, certified units, certificate | Yes | Engineering runtime object | Engineering authority | Yes | Engineering Certification, ScopeVersion |
| ScopeVersion | Yes | `server/data/scopeversions`, Runtime Objects | `scopeVersionId` | Certified IOF Package, execution certificate | Yes | Yes | ScopeVersion authority | Yes | Twin, Execution |
| Service Order Form | Not yet implemented | Future SOF library | Future `sofId` | ScopeVersion, account, contact/SOF recipients | Required when added | Expected when added | Execution/SOF authority | Must when added | Future SOF workspace |
| Runtime Object | Yes | `server/data/runtime-objects` | `runtimeId` | Source object ID, relationships/evidence | Usually paired | Yes if included by projection | Source object authority | Yes | Twin, all workspaces |
| Runtime History | Yes | `server/data/runtime-history` | `historyId` | Object ID, account/customer/lifecycle metadata | It is history | Auditable context | Actor authority | Yes | All audit surfaces |
| Twin Projection | Derived | Built from Runtime Objects, ScopeVersions, work/closure stores | ScopeVersion or projection request | Runtime Object Library and ScopeVersion canonical truth | No new history for projection | Yes | Read authority | Recomputed after restart | Twin |
| Workspace UI state | No, unless preference | React state only, possible future user prefs | Component/session state | None | No | No | No | No | Current UI only |

## Button / Action Runtime Effects Matrix

| Action | Governed Runtime? | Object Created / Updated | Relationship Created | Runtime History | Authority Transfer | Visible After Refresh |
|---|---:|---|---|---|---|---|
| Create Account | Yes | Account, Account runtime mirror | Account workspace root | `runtime.account.saved` | User becomes Account owner | Account selector, Account Workspace, Twin |
| Edit Account | Yes | Account, Account runtime mirror | Existing Account retained | `runtime.account.saved` | No transfer | Updated Account fields |
| Add Contact | Yes | Contact, Contact runtime mirror, Account contact index | Contact linked by `accountId` | `runtime.contact.saved` | No transfer | Contact list, Account record, Twin |
| Edit Contact | Yes via API; UI edit surface pending | Contact, Contact runtime mirror | Same `accountId` | `runtime.contact.saved` | No transfer | Updated Contact and recipient flags |
| Select Active Account | No | UI selection only | None | None | None | Not persisted as runtime |
| Create Opportunity | Yes | Commercial Opportunity, runtime mirror | Customer Twin enables Opportunity | `COMMERCIAL_OPPORTUNITY_CREATED` / opportunity saved | Commercial owner assigned | Opportunity Library, Runtime Bridge |
| Select Product | Yes when lifecycle advances | Product runtime mirror reused | Fulfillment Plan fulfills Product | `PRODUCT_SELECTED` | Product definition authority retained | Lifecycle progress, Twin |
| Configure Product | Yes when saved in Fulfillment Plan/Proposal | Product configuration inside Fulfillment Plan/Proposal | Product to Plan | Product/Fulfillment history | Commercial/Product fulfillment authority | Proposal and engineering package lineage |
| Resolve Inventory | Yes | Fulfillment Plan | Ownership-class references recorded | `INVENTORY_RESOLVED` | No ownership transfer | Fulfillment Plan and audit history |
| Generate Fulfillment Plan | Yes | Fulfillment Plan, runtime mirror | `FULFILLS_PRODUCT` | `FULFILLMENT_PLAN_CREATED` | Product fulfillment authority | Product Fulfillment and Twin |
| Generate Proposal | Yes | Proposal, runtime mirror | Commercial Draft generates Proposal | `PROPOSAL_CREATED` | Commercial review authority | Proposal Library, Runtime Bridge |
| Submit Proposal | Yes | Proposal status/authority/review tasks | Proposal assigned for customer review | `runtime.proposal.submitted.customer` / `PROPOSAL_SUBMITTED` | Commercial to Customer Review | Customer review state and notifications |
| Customer Approves Proposal | Yes | Proposal approval/status, Draft IOF if ready | Proposal enables Draft IOF package | `runtime.proposal.customer.approved`, `CUSTOMER_APPROVED` | Customer Review to Engineering Review | Approved proposal, Draft IOF package |
| Customer Requests Changes | Yes | Proposal status/comments | Proposal remains in review | `runtime.proposal.customer.requested_changes` | Customer Review remains active | Requested changes visible |
| Assemble Draft IOF Package | Yes | Draft IOF Package, proposed IOF units | Approved Proposal to Engineering package | `runtime.iof_package.assembled_from_proposal`, `DRAFT_IOF_PACKAGE_CREATED` | Commercial to Engineering Review | Engineering queue/package |
| Send to Engineering | Yes | Engineering queue projection from Draft IOF | Package assigned to engineer | `ENGINEERING_REVIEW_QUEUED` | Engineering Review owner assigned | Engineering Certification workspace |
| Complete Engineering Certification | Yes | Certified IOF Package, certificate, ScopeVersion | Certified package authorizes ScopeVersion | `runtime.iof_package.certified`, engineering checklist events | Engineering to Execution | Certified package and ScopeVersion |
| Generate Certified IOF Package | Yes | Certified IOF Package | Draft IOF package source retained | Certification history | Engineering authority | Certified IOF package library |
| Generate ScopeVersion | Yes | ScopeVersion, runtime mirror | ScopeVersion from Certified IOF package | `runtime.authority_transfer.engineering_to_execution` | Engineering to Execution | Twin projection |
| Generate Service Order Form | Not implemented yet | Future SOF object | ScopeVersion to SOF | Required when added | Execution to SOF/Operations | Future SOF workspace |
| Surface object in Twin | Derived | No mutation | Runtime projection only | None | Read-only | Twin commercial runtime objects |

## Add Contact Fix

- Contact form initializes with `contactEditorDefaults()`.
- Account edit/create actions reset the Contact draft to safe defaults.
- Contact input handlers now pass captured values into `setContactDraft`, avoiding nullable synthetic event access.
- Contact save sends `accountId`, recipient workflow flags, organization/workspace IDs, and owner ID.
- Contact persistence writes:
  - Contact JSON record
  - Contact Runtime Object mirror
  - Account `contactIds` and `contacts` index
  - Runtime History event

## Validation

Sprint 16 validation command:

```bash
node sprint16-lifecycle-persistence-validation.mjs
```

The validation proves:

- The unsafe Contact input pattern is absent.
- A governed Contact can be created under an Account.
- Another operator session can reload the Contact.
- The Account record reload includes the Contact ID/name.
- Runtime History and Runtime Object records exist for the Contact.
- Contact recipient IDs flow through Proposal, Draft IOF Package, Certified IOF Package, certificate, and ScopeVersion canonical truth.
- Twin surfaces Contact, Product, and Fulfillment Plan runtime objects.

Proof file:

```text
.tmp/sprint16-lifecycle-persistence-report.json
```
