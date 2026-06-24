# Customer Workspace Doctrine

Phase: 6.8D

Customer Workspace is the business entry point for Teralinx.

Ryan, CROs, account owners, engineers, and authorized stakeholders should start with Customer or Opportunity, not Translate.

## Doctrine

Customers own opportunities.

Opportunities launch workflows.

Translate is launched from Opportunity.

Scope Review is launched from Translate.

Prism is launched from Scope Review.

Marketplace follows approved commercial readiness.

## Constitutional Flow

```text
Customer
  -> Opportunity
  -> Translate
  -> Scope Review
  -> Prism
  -> Marketplace
  -> Execution
```

## Boundary Rules

- No persistence.
- No server routes.
- No production UI wiring.
- No workflow execution.
- No state mutation.
- No ScopeVersion creation.

Customer Workspace is a model and launch surface only.

Opportunity Detail is the primary business development cockpit.

Customer Workspace organizes accounts. Opportunity Detail drives opportunity progression.

Translate, Scope Review, Prism, and Preliminary Quote are launched from Opportunity Detail.
