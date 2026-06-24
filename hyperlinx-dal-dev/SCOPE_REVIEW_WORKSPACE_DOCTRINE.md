# Scope Review Workspace Doctrine

Phase: 6.8G

Scope Review Workspace is the customer collaboration layer between Translate Workspace and Prism.

Customers should review designs inside Teralinx instead of exchanging KMZ files.

## Doctrine

ScopeVersion remains truth.

Comments do not create truth.

Redlines do not create truth.

Approvals do not create truth.

Scope Review is collaborative.

Engineering remains authoritative.

## Constitutional Flow

```text
Opportunity
  -> Translate Workspace
  -> Scope Review Workspace
  -> Prism
```

## Boundary Rules

- No persistence.
- No server routes.
- No React implementation.
- No geometry mutation.
- No ScopeVersion mutation.
- No Chicago/root production changes.
