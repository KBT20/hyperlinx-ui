# Proposed Network Summary Model

The summary model exposes customer-review facts from the canonical `ProposedGraph`:

- customer
- opportunity
- network type
- protection
- primary product
- estimated mileage
- estimated stations
- estimated crossings
- estimated vaults
- estimated fiber feet
- estimated duct feet
- status
- ready for proposal

## Readiness

Supported readiness values:

- `READY_FOR_PROPOSAL`
- `BLOCKED`
- `CUSTOMER_REVIEW_COMPLETE`

Readiness is advisory workflow state for the canonical `ProposedGraph`. It is not lifecycle authority.
