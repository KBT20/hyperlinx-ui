# Vendor Qualification Model

Status: doctrine and contracts only.

## Purpose

Vendor qualification captures trust and readiness evidence.

Qualification is not an approval workflow in this phase. It records qualification status and review dimensions for future marketplace governance.

## Qualification Status

Supported statuses:

| Status | Meaning |
| --- | --- |
| `UNVERIFIED` | Identity or capability is not reviewed |
| `REGISTERED` | Vendor identity exists in the registry |
| `QUALIFIED` | Vendor has passed basic qualification review |
| `PREFERRED` | Vendor is preferred for one or more categories or regions |
| `STRATEGIC` | Vendor is strategically important or has enterprise-level relevance |

## Review Dimensions

Qualification records may track:

- insurance.
- references.
- markets served.
- crew capacity.
- facility capacity.
- financial review.
- safety review.
- compliance review.

## Review Status

Review dimensions may use:

- `NOT_REVIEWED`.
- `PENDING`.
- `VERIFIED`.
- `EXPIRED`.
- `REJECTED`.

## Qualification Boundary

Qualification status does not create:

- procurement authority.
- contract authority.
- work authorization.
- ScopeVersion truth.
- execution authority.

Future workflows may use qualification to gate bid package invitations or provider eligibility.

## Examples

- A regional HDD contractor may be `QUALIFIED` with verified insurance and crew capacity.
- A carrier hotel provider may be `PREFERRED` with verified compliance review.
- A land owner may remain `UNVERIFIED` until ownership evidence is validated.
- A GPU provider may be `REGISTERED` while facility capacity remains under review.

