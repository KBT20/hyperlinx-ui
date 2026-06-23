# Corridor Promotion Evidence Requirements

Status: doctrine only.

## Endpoint Evidence

Required:

- A endpoint.
- Z endpoint.
- endpoint coordinates.
- endpoint role.
- endpoint confidence.

Failure examples:

- missing A endpoint.
- missing Z endpoint.
- endpoint has no valid latitude/longitude.
- endpoint has no confidence-bearing evidence.

## Route Evidence

Required:

- route geometry.
- distance.
- source.
- route class.
- route confidence.
- geometry validity.

Failure examples:

- no route candidate selected.
- geometry has fewer than two valid coordinates.
- distance is zero or negative.
- source evidence confidence is below threshold.

## Requirement Evidence

Required:

- bandwidth or service intent.
- topology intent.
- availability target.
- diversity requirement.
- commercial product intent.

Failure examples:

- no requirement record.
- missing service intent.
- missing availability target.
- missing product/commercial intent.

## Buildability Evidence

Required:

- jurisdiction summary.
- crossing summary.
- constraint summary.
- constructability risk.
- permit risk.

Failure examples:

- no jurisdiction summary.
- no constructability score.
- no risk/permit score.
- unresolved high or critical constraint.

## Infrastructure Assumption Evidence

Required:

- conduit count assumption.
- fiber count assumption.
- optical/transport assumption if applicable.
- regen assumption if applicable.

Failure examples:

- missing duct count.
- missing fiber count.
- transport service requested without optical system assumption.

## Human Approval Evidence

Required:

- engineering reviewer.
- approval timestamp.
- promotion note or approval evidence record.

Failure examples:

- no reviewer.
- no reviewed timestamp.
- no human engineering evidence.

## Evidence Preservation

Evidence IDs are preserved in the draft output. Conflicting evidence must not be discarded. Promotion readiness is a recommendation, not authority.

