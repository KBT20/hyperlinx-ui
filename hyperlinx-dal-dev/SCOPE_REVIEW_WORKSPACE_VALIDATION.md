# Scope Review Workspace Validation

Phase: 6.8G

## Review In Progress

Review with comments, redlines, or approvals but no approval-for-Prism remains `UNDER_REVIEW`.

## Comment Example

Customer adds a general, technical, commercial, route, facility, risk, question, or action-item comment.

Comments are non-authoritative and do not create truth.

## Redline Example

Engineer or customer proposes annotate, relocate, move, add, remove, or modify redline.

Redlines are proposals only. They do not mutate geometry or ScopeVersion truth.

## Approval Example

Customer or CRO may approve, approve with comments, reject, or request revision.

Approvals do not mutate lifecycle or authority.

## Revision Requested

Latest approval decision `REQUEST_REVISION` results in `REVISION_REQUESTED` and next action `ADD_REDLINE`.

## Blocked Review

Missing baseline, ScopeVersion ID, customer ID, opportunity ID, approver, or rejected approval blocks Prism readiness.

## Ready For Prism

Ready for Prism requires:

- Baseline Network Candidate.
- Review complete.
- Required approval exists.
- No critical blockers.

## Google Workflow

```text
Google Texas AI Expansion
  -> Baseline Network Candidate
  -> Scope Review Workspace
  -> Customer Comments
  -> CRO Approval
  -> Open Prism
```

## Ryan Workflow

```text
Ryan
  -> Opportunity Detail
  -> Translate Workspace
  -> Scope Review Workspace
  -> Open Prism
```

## Validation Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```
