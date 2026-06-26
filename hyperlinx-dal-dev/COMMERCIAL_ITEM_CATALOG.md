# Commercial Item Catalog

The Commercial Item Catalog inventories what Hyperlinx currently knows how to cost.

## Status Values

| Status | Meaning |
| --- | --- |
| `IMPLEMENTED` | The platform currently produces a usable source quantity. |
| `PARTIAL` | The platform produces a proxy or aggregate, but not a fully engineered quantity. |
| `FUTURE` | The item is known but the platform does not currently generate the required quantity. |

## Implemented / Partial Coverage

| Category | Items | Status |
| --- | --- | --- |
| Civil | Plow, HDD, Open Cut, Road Bore, Railroad Bore, Water Crossing, Bridge Attachment, Unknown Constraint | Implemented or partial from CorridorTakeoff and civil allocation. |
| Materials | Standard Duct Package (3 x 1.25"), Fiber, Vault, Handhole, Marker, Splice Case | Implemented from selected-scope estimator quantities. |
| Materials | FuturePath (Optional) | Future/optional; disabled by default and does not replace the standard duct package. |
| Labor | Cable Placement, Splicing, Testing, Restoration | Implemented/partial from fiber, splice, and route footage proxies. |
| Engineering | Survey, Design, Permitting, Inspection | Implemented/partial from mileage and crossing counts. |
| General Conditions | Mobilization, Traffic Control, Project Management, QA/QC, Contingency | Partial development allowances. |
| Recurring Support | Monthly O&M per route mile, Minimum monthly O&M | Partial; used only for preliminary MRC support. |

## Current Catalog Location

`src/commercial/CommercialItemCatalog.ts`
