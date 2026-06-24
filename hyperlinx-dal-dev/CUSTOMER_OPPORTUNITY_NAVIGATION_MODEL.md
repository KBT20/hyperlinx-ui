# Customer Opportunity Navigation Model

Phase: 6.8D

## Future Navigation

```text
Customers
  -> Customer Workspace
  -> Opportunity Detail
  -> Launch Translate
  -> Open Scope Review
  -> Run Prism
  -> Generate Preliminary Quote
```

This phase defines configuration only. It does not create React routes or screens.

Opportunity Detail is the deal cockpit.

## Recommended Top-Level Groups

Business:

- Customers
- Opportunities
- Portfolio
- Marketplace

Delivery:

- Translate
- Scope Review
- Prism
- Route Engineering
- Execution

Operations:

- Twin
- Operational Intelligence

Platform:

- Graph

Existing development lenses may remain visible in DAL-dev. Customer-facing use should consolidate navigation before release.
