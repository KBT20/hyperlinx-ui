# Adapter Gap Registry

Phase: 6.7C

The Adapter Gap Registry classifies integration gaps between DAL runtime state and Constitutional Runtime expectations.

## Gap Types

- `TRACEABILITY_GAP`
- `LIFECYCLE_GAP`
- `CLOSE_GAP`
- `MARKETPLACE_GAP`
- `AUTHORITY_GAP`
- `REFERENCE_GAP`

## Supported Gaps

- Missing customer mapping
- Missing opportunity mapping
- Missing corridor mapping
- Missing scopeVersion mapping
- Missing close mapping
- Missing lifecycle mapping
- Missing marketplace mapping
- Missing authority mapping
- Legacy object mapping
- Unknown object mapping

## Severity

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

## Planning Fields

Each gap carries:

- Recommended adapter
- Required mapping
- Owner
- Risk
- Priority

The registry is advisory and read-only.
