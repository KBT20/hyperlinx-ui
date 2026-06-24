# Opportunity Launch Workflow

Phase: 6.8D

Opportunity Launch determines whether an opportunity may launch Translate.

## Launch Requirements

An opportunity can launch to Translate when:

- `customerId` exists.
- `opportunityId` exists.
- Network type is selected.
- Protection schema is selected.
- At least one location exists.
- No critical intake blockers exist.
- Translate readiness is `READY_FOR_TRANSLATE`.

## Status Values

- `DRAFT`
- `READY_TO_LAUNCH`
- `LAUNCHED_TO_TRANSLATE`
- `BLOCKED`

## Engine Contract

The launch engine returns a launch result only.

It does not persist state, mutate opportunity records, execute Translate, or create authority.

Opportunity Detail is the primary business development cockpit and may display the launch result as the next action.

## Diagnostics

- `[OPPORTUNITY_LAUNCH_EVALUATED]`
- `[OPPORTUNITY_LAUNCH_BLOCKER_IDENTIFIED]`
- `[READY_TO_LAUNCH]`
- `[LAUNCHED_TO_TRANSLATE]`
- `[OPPORTUNITY_LAUNCH_BLOCKED]`
