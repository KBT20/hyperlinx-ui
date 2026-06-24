# Shadow Runtime Comparison Model

Phase: 6.7B

Shadow comparisons classify alignment between DAL-observed behavior and Constitutional Runtime expectations.

## Comparison Values

- `MATCH`
- `PARTIAL_MATCH`
- `MISMATCH`
- `UNMAPPED`
- `UNKNOWN`

## Comparison Fields

Each comparison includes:

- Component
- Expected value
- Actual value
- Findings
- Diagnostics

## Components

- Lifecycle
- Close Authority
- Traceability
- Marketplace

## Interpretation

`MATCH` means no findings were produced.

`PARTIAL_MATCH` means non-critical gaps exist.

`MISMATCH` means high or critical gaps exist.

`UNMAPPED` means the Shadow Runtime cannot map the DAL object into a constitutional concept.

`UNKNOWN` means no evaluable data was supplied.
