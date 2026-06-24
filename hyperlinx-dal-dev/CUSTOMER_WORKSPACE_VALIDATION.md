# Customer Workspace Validation

Phase: 6.8D

## Customer Workspace Example

Google Customer Workspace includes:

- Google Texas AI Opportunity
- Google Oklahoma AI Opportunity
- Blocked Opportunity Missing Protection
- Blocked Opportunity Missing Location

## Opportunity List Example

Each opportunity summary exposes network type, protection schema, requested products, locations, attachments, readiness, next action, and last updated.

## Blocked Launch Example

Blocked Opportunity Missing Protection produces:

- `status = BLOCKED`
- blocker: `protectionSchema`
- next action: `SELECT_PROTECTION_SCHEMA`

Blocked Opportunity Missing Location produces:

- `status = BLOCKED`
- blocker: `locations`
- next action: `ADD_LOCATION`

## Ready Launch Example

Google Texas AI Opportunity with:

- `networkType = AI_CORRIDOR`
- `protectionSchema = DIVERSE`
- at least one location
- Translate readiness = `READY_FOR_TRANSLATE`

produces `READY_TO_LAUNCH`.

## Launched-To-Translate Example

Google Oklahoma AI Opportunity produces a launch result with:

- `status = LAUNCHED_TO_TRANSLATE`
- `nextWorkspace = Translate`
- no persistence
- no state mutation

## Ryan / CRO Workflow

```text
Ryan
  -> Customer Workspace
  -> Google
  -> Google Texas AI Opportunity
  -> Launch Translate
  -> Translate Workspace
```

## Google Workflow

```text
Google
  -> Opportunity
  -> Intent Selection
  -> Protection Selection
  -> Launch Translate
  -> Scope Review
  -> Prism
```

## Validation Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```
