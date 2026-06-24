# Sidebar Migration Plan

Phase: 6.8J.0

## Stage 1: Group Existing Navigation

Complete in this phase.

- Introduce navigation groups.
- Preserve all existing workspace IDs.
- Move graph-oriented development tools under Advanced.
- Keep legacy analysis tools reachable.

## Stage 2: Replace Placeholders Incrementally

Future phases may replace placeholder entries with composed workspaces:

- Customers
- Scope Review
- Preliminary Quote
- Completion

Each replacement must preserve the same workspace key or include a deliberate migration note.

## Stage 3: Business Workflow Default

Future adoption may set default workspace to Customers or Opportunities after customer workspace implementation exists.

## Stage 4: Legacy Cleanup

Legacy entries may be hidden further only after replacement workspaces are proven. No legacy workspace is removed in this phase.

## Non-Goals

- No persistence changes.
- No API changes.
- No server routes.
- No authority changes.
- No lifecycle changes.
- No workspace feature changes.
