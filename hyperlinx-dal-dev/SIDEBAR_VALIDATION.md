# Sidebar Validation

Phase: 6.8J.0

## Expected Sidebar Groups

- Business
- Design
- Execution
- Operations
- Advanced

## Business Path

The sidebar exposes:

- Customers
- Opportunities
- Translate
- Scope Review
- Prism Workspace
- Preliminary Quote

This supports the business workflow visually without requiring users to navigate through graph tools.

## Existing Routes

The following existing workspaces remain reachable:

- Translate
- Inventory Graphs
- Inventory Recovery
- Graph Viewer
- Graph Extensions
- Prism
- Prism Workspace
- Site Decision
- Route Engineering
- Candidate Sites
- Network Affinity
- Portfolio
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence

## Placeholder Routes

The following route keys mount placeholder content:

- Customers
- Scope Review
- Preliminary Quote
- Completion

## Validation Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```

## Boundary Validation

- No workspace functionality removed.
- No API calls added.
- No persistence added.
- No server routes added.
- No authority changed.
- No lifecycle changed.
- No Chicago/root production files modified.
