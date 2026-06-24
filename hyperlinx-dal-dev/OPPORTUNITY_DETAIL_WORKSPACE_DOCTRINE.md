# Opportunity Detail Workspace Doctrine

Phase: 6.8E

Opportunity Detail is the primary business development cockpit.

Customer Workspace shows the account.

Opportunity Detail drives the deal.

Ryan should not need to start in Translate or understand internal engines to move a customer ask forward.

## Constitutional Flow

```text
Customer
  -> Opportunity
  -> Translate Workspace
  -> Baseline Network
  -> Scope Review Workspace
```

## Translate Handoff

```text
Opportunity Detail
  -> Translate Workspace
  -> Baseline Network
  -> Scope Review Workspace
  -> Prism
  -> Preliminary Quote
```

## Doctrine

Opportunity Detail answers:

- What is the customer asking for?
- What network type is this?
- What protection model is selected?
- What information do we have?
- What is the current status?
- What is the next action?

Translate, Scope Review, Prism, and Preliminary Quote are launched from Opportunity Detail.

Opportunity Detail launches Translate Workspace. Translate Workspace generates the Baseline Network Candidate and opens Scope Review Workspace.

Scope Review Workspace is the customer collaboration layer before Prism.

## Boundary Rules

- No persistence.
- No server routes.
- No production UI wiring.
- No React implementation.
- No workflow execution.
- No ScopeVersion creation.
