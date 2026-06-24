# ScopeVersion Close Audit Model

Status: doctrine and read-only contracts only.

## Purpose

Close audit records preserve replayable execution history.

Audit is not a passive log. Audit records preserve the inputs needed to replay why a close was accepted or rejected.

## Audit Record Fields

Every close audit record must preserve:

- inputs.
- evidence.
- constraints.
- actor.
- authority.
- timestamp.
- outcome.
- previous state.
- resulting state.
- replay references.
- diagnostics.

## Replay Doctrine

Replay requires:

- immutable close event.
- evidence references.
- constraint references.
- authority registry entry.
- actor role.
- outcome.
- previous and resulting state where applicable.

## Supersession

A close may supersede a prior close only by creating a new close.

The audit record must preserve:

- superseding close id.
- superseded close id.
- reason or notes.

No deletion.

No overwrite.

## Field Closure Alignment

Field closure audit should preserve:

- station or object target.
- work item reference.
- ScopeVersion traceability.
- actor.
- evidence.
- resulting state.

This is the operational embodiment of close authority.

