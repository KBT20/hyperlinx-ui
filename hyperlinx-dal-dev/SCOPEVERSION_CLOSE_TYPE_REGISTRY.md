# ScopeVersion Close Type Registry

Status: doctrine and contracts only.

## Close Types

The close authority contract defines:

| Close type | Purpose |
| --- | --- |
| `INTENT_CLOSE` | Customer or sales intent recorded against ScopeVersion traceability |
| `DESIGN_CLOSE` | Design review or design evidence closure |
| `ENGINEERING_CLOSE` | Engineering approval or certified engineering basis |
| `COMMERCIAL_CLOSE` | Commercial review or acceptance |
| `BUDGET_CLOSE` | Budget Lock authority closure |
| `VENDOR_RESPONSE_CLOSE` | Vendor response evidence closure |
| `VENDOR_ACCEPTANCE_CLOSE` | Vendor acceptance or award-readiness closure |
| `CUSTOMER_ACCEPTANCE_CLOSE` | Customer acceptance closure |
| `CONTRACT_CLOSE` | Contract execution closure |
| `MARKETPLACE_CLOSE` | Marketplace review closure |
| `CONTROL_CLOSE` | Control activation or work authority closure |
| `FIELD_CLOSE` | Field operational closure |
| `COMPLETION_CLOSE` | Completion closure |
| `OPERATIONS_CLOSE` | Operations handoff closure |
| `FINANCIAL_COMMITMENT_CLOSE` | Financial commitment closure |
| `PAYMENT_CLOSE` | Payment closure |

## Actor Categories

Authorized actor categories:

- `CUSTOMER`.
- `TERALINX_SALES`.
- `TERALINX_ENGINEERING`.
- `TERALINX_MARKETPLACE`.
- `TERALINX_OPERATIONS`.
- `VENDOR`.
- `LEGAL`.
- `FINANCE`.
- `FIELD_OPERATOR`.
- `SYSTEM`.
- `AI_ASSISTANT_ADVISORY`.

## AI Boundary

`AI_ASSISTANT_ADVISORY` may never validate a close.

AI may generate:

- evidence.
- draft explanations.
- recommendations.
- review notes.

AI may not create authority.

## Existing Workflow Mapping

| Workflow | Close authority mapping |
| --- | --- |
| Prism Recommendation | Advisory only unless human review creates `DESIGN_CLOSE` or `COMMERCIAL_CLOSE` |
| Preliminary Quote | Advisory only unless commercial review creates `COMMERCIAL_CLOSE` |
| Engineering Approval | `ENGINEERING_CLOSE` against `scopeVersionId` |
| Marketplace Budget Lock | `BUDGET_CLOSE` against `scopeVersionId` |
| Vendor Acceptance | `VENDOR_ACCEPTANCE_CLOSE` against `scopeVersionId` |
| Customer Acceptance | `CUSTOMER_ACCEPTANCE_CLOSE` against `scopeVersionId` |
| Contract Execution | `CONTRACT_CLOSE` against `scopeVersionId` |
| Control Activation | `CONTROL_CLOSE` against `scopeVersionId` |
| Field Closure | `FIELD_CLOSE` against `scopeVersionId` |
| Completion | `COMPLETION_CLOSE` against `scopeVersionId` |

