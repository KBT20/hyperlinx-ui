# Scope Review Doctrine

Phase: 6.8B

Scope Review is the collaborative review layer between Translate and Prism.

## Doctrine

ScopeVersion is truth.

Review occurs against ScopeVersion.

Comments do not create truth.

Redlines do not create truth.

Approvals do not create truth.

Only approved future workflow transitions may create new ScopeVersions.

Scope Review is collaborative. Scope Review is not authority.

## Input Flow

```text
Customer
  -> Customer Workspace
  -> Opportunity
  -> Opportunity Launch
  -> Translate Workspace
  -> Baseline Network
  -> Intent Selection
  -> Architecture Selection
  -> Baseline Network Synthesis
  -> Scope Review Workspace
  -> Prism
```

Baseline Network Candidates are review evidence only. They do not replace ScopeVersion truth and do not authorize engineering, routing, or execution.

Translate is launched from Opportunity. Scope Review is launched from Translate.

Opportunity Detail is the primary business development cockpit and may surface Scope Review as the next action after Baseline Network readiness.

Scope Review Workspace consumes the Baseline Network Candidate prepared by Translate Workspace.

Scope Review Workspace is the customer collaboration layer before Prism.

## Boundary Rules

- No UI implementation.
- No persistence.
- No workflow execution.
- No lifecycle changes.
- No authority changes.
- No geometry mutation.
- No ScopeVersion creation.

KMZs and other files may be seed artifacts, but ScopeVersion remains the review object.
