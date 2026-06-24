# Protection Schema Model

Phase: 6.8C

Protection schema describes the customer's intended resiliency posture before engineering review.

## Supported Schemas

- `LINEAR`: one path or non-protected service posture.
- `DIVERSE`: multiple path evidence or route diversity desired.
- `RING`: protected or restorable ring-like topology desired.
- `MESH`: multi-node or fabric-like resiliency desired.

Protection schema selects architecture posture only. It does not prove diversity, restoration, or SLA compliance.

## Rule

Protection claims are evidence until Route Engineering validates physical diversity, shared ROW, shared structure, crossings, and operational restoration.
