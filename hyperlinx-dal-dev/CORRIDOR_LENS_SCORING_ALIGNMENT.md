# Corridor Lens Scoring Alignment

Status: scoring alignment doctrine. No scoring implementation.

## Selection Order

Future Prism scoring profile selection should consider:

1. Lens.
2. Network role.
3. Customer requirement.
4. Commercial product.

## Examples

### Hyperscaler

- `POWER`: high
- `INTERCONNECTION`: high
- `AI`: high
- `STRATEGIC`: high
- `COMMERCIAL`: medium
- `ENGINEERING`: medium

### Duct Monetization

- `COMMERCIAL`: high
- `INFRASTRUCTURE`: high
- `ENGINEERING`: medium
- `STRATEGIC`: medium
- `POWER`: low

### Enterprise

- `COMMERCIAL`: high
- `INTERCONNECTION`: medium
- `INFRASTRUCTURE`: medium
- `ENGINEERING`: medium

### Transport

- `OPTIMIZATION`: high
- `STRATEGIC`: high
- `INTERCONNECTION`: high
- `ENGINEERING`: medium
- `COMMERCIAL`: medium

## Doctrine

A scoring category can be valid but low priority under a given lens.

The lens changes emphasis. It does not change evidence truth.
## Reference Architecture Context

Scoring profile selection should consider the applicable Reference Architecture after lens and customer intent are known.

Lens determines what matters.

Reference Architecture determines what must be considered.

Design Standards determine how objects must be treated.

Prism scoring remains advisory and should not run as a final recommendation context until lens, architecture, object, and design-standard context exists.

Route Engineering remains authority.

