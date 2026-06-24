# Production Cutover Strategy

Status: staged plan only. No implementation.

## Stage 1: Audit Complete

Complete constitutional runtime and production integration audits.

Output:

- integration surface map.
- dependency audit.
- risk register.
- validation report.

## Stage 2: Read-Only Adapters

Create read-only adapters from production DAL data into constitutional runtime snapshots.

No writes.

No lifecycle mutation.

No authority changes.

## Stage 3: Shadow Runtime

Run constitutional runtime in parallel against production data snapshots.

Compare:

- ScopeVersion state.
- close ledger.
- work packages.
- field closures.
- completion readiness.
- operations readiness.

## Stage 4: Parallel Validation

Validate constitutional outputs beside existing DAL behavior.

No replacement.

No direct production cutover.

Any mismatch becomes an integration finding.

## Stage 5: Production Adoption

Promote bounded write paths only after:

- read-only adapters pass.
- shadow runtime passes.
- parallel validation passes.
- rollback plan exists.
- production owners approve.

## Reversibility Rule

Every stage must be reversible before the next stage begins.

