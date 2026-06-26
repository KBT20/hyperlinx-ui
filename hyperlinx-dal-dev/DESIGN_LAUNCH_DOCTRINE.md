# Design Launch Doctrine

Phase 6.9B connects Teralinx Route intake to the existing Hyperlinx Design workflow.

The Design Network action does not create routes, geometry, inventory, ScopeVersions, lifecycle transitions, or execution authority. It validates a sales-originated route opportunity and creates a read-only Design Launch Session that points to the existing Design workspace.

## Constitutional Rule

Teralinx Route is a sales entry point.

Design owns synthesis.

Inventory Graph owns proposed inventory output.

Route Engineering owns engineering validation.

ScopeVersion remains authoritative only after the existing downstream workflow creates constitutional truth.

## Forbidden Behavior

The Design Launch layer may not:

- create geometry
- call routing engines
- create stationing
- generate inventory graphs
- create ScopeVersions
- mutate inventory
- persist launch sessions
- bypass the existing Design architecture

## Allowed Behavior

The Design Launch layer may:

- validate customer, opportunity, site, intent, protection, and product inputs
- create a read-only launch session
- display placeholder design metrics
- navigate to the existing Design workspace
- preserve diagnostics for human review
