# Quote Readiness Model

Supported readiness values:

- `NOT_READY`
- `READY_FOR_CUSTOMER`
- `BLOCKED`
- `CUSTOMER_ACCEPTED`
- `CUSTOMER_DECLINED`

Engineering is not part of quote readiness.

## Ready For Customer

A quote is ready for customer review when:

- Proposed Inventory exists
- customer reference exists
- opportunity reference exists
- primary product exists
- estimated metrics exist

## Customer Accepted

Customer acceptance approves the ProposedGraph for Route Engineering handoff eligibility.

It does not create:

- engineering work
- ScopeVersion authority
- inventory mutation
- lifecycle transition

## Customer Declined

Customer decline records local UI decision state only in Phase 6.9C.
