# Sprint 17 Runtime Rehydration Report

## Result

Sprint 17 establishes Runtime as the operating system for lifecycle continuity.

Workspaces may cache interface state for rendering, but Runtime owns governed lifecycle state. Commercial, Engineering, Twin, Field, Marketplace, Control, and Operational Intelligence are projections over Runtime objects.

## Constitutional Principle

No workspace owns lifecycle state.

Governed lifecycle objects exist exactly once, inside Runtime:

- Account
- Contact
- Opportunity
- Product
- Fulfillment Plan
- Customer Twin
- Graph and route references
- Proposal
- Draft IOF Package
- Certified IOF Package
- Engineering Review
- ScopeVersion
- Runtime Authority
- Runtime History

## WorkspaceSession

Sprint 17 introduces `WorkspaceSession` as a governed Runtime object.

The session stores resume pointers, not duplicate domain state:

- `sessionId`
- `userId`
- `workspaceId`
- `accountId`
- `opportunityId`
- `productId`
- `fulfillmentPlanId`
- `proposalId`
- `packageId`
- `certifiedPackageId`
- `scopeVersionId`
- `currentRuntimeObject`
- `currentAuthority`
- `currentLifecycleStage`
- selected graph, route, customer design, inventory, package, proposal revision, and engineering revision
- map view, expanded panels, filters, selected records, and resume token
- authority transaction trail

The session itself is mirrored into the Runtime Object Library as `WORKSPACE_SESSION`.

## Runtime Rehydration

Commercial startup now calls Runtime rehydration instead of guessing state.

Runtime returns:

- WorkspaceSession
- Account and Contacts
- Opportunity
- Product
- Fulfillment Plan
- Proposal
- Draft IOF Package
- Certified IOF Package
- ScopeVersion
- Route and graph references
- Runtime Objects
- Runtime History
- Twin restore metadata

Commercial applies only returned governed IDs/objects. It does not create a default proposal, reset the customer, or reconstruct lifecycle state.

## Authority Transactions

Authority transfer is now persisted by Runtime session transactions:

| Transaction | Runtime Event | Session Authority |
|---|---|---|
| Lifecycle advanced to customer review | `RUNTIME_LIFECYCLE_ADVANCED` | `CUSTOMER_REVIEW` |
| Customer approval creates/queues Draft IOF | `AUTHORITY_TRANSFER_CUSTOMER_TO_ENGINEERING` | `ENGINEERING_REVIEW` |
| Engineering certification authorizes ScopeVersion | `AUTHORITY_TRANSFER_ENGINEERING_TO_EXECUTION` | `EXECUTION` |

The actor who performs the transaction is recorded in Runtime History, while the commercial workspace owner's `WorkspaceSession` receives the resume state required to return to work.

## Startup Doctrine

When Commercial loads:

- Do not create defaults.
- Do not create an empty proposal.
- Do not reset the customer.
- Do not guess state.
- Ask Runtime for `/api/runtime/rehydrate`.
- Render the governed state Runtime returns.

## Validation

Validation command:

```bash
node runtime-rehydration-validation.mjs
```

The validation proves:

1. Runtime advertises WorkspaceSession and rehydration libraries.
2. Account and Contact persist.
3. Opportunity, Product, Fulfillment Plan, Proposal, Draft IOF, Certified IOF, and ScopeVersion complete.
4. Runtime writes a WorkspaceSession during lifecycle advance.
5. Customer approval updates the commercial workspace session to Engineering authority.
6. Engineering certification updates the same commercial workspace session to Execution authority.
7. A fresh login/cold reload rehydrates Account, Opportunity, Proposal, route, graph, pricing, authority, revision, Draft IOF, Certified IOF, ScopeVersion, session, Twin projection, and Runtime History.
8. Rehydration does not recreate Proposal, package, or ScopeVersion records.

Proof file:

```text
.tmp/sprint17-runtime-rehydration-report.json
```

## Architectural Outcome

The governed Runtime Graph is now the center of the platform.

Accounts, opportunities, products, proposals, engineering, execution, inventory, and operations are projections of Runtime authority at different lifecycle stages. This gives StellaOS deterministic continuity across refreshes, logouts, workspace switches, and server restarts.
