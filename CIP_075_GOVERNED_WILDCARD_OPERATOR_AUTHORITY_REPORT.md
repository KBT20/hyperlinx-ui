# CIP-075 — Governed Wildcard Operator Authority

Date: 2026-08-17 America/Chicago  
Status: **IMPLEMENTED AND DEPLOYED; HUMAN-PRINCIPAL ACCEPTANCE STOPPED AT CREDENTIAL BOUNDARY**

## Accepted implementation checkpoint

- Git commit: `0a7f9e80c7afdb890884acd8d8919a5483235ada`
- Branch: `teralinx-layer1`
- Remote checkpoint pushed before deployment.
- DAL1 PM2 runtime: `hyperlinx-dal-api`, online at the exact checkpoint.
- Browser/runtime projection: `0a7f9e80c7af`.
- Public and localhost `/api/runtime` both report `CONNECTED`.

## Preservation evidence

- DAL1 pre-mutation snapshot: `/home/ubuntu/hyperlinx-snapshots/cip075-pre-0a7f9e8-20260817`
- Governed file records captured: 2,479.
- PostgreSQL custom-format dump: `hyperlinx.dump`, 35,406,598 bytes.
- PostgreSQL dump SHA-256: `9439f67773e98f3174a322bbdf35c17a3bd1a5c31d9eb9b084040a45f47ac0e0`.
- DAL1 governed `server/data` checksum before deployment: `31a382aece2ecea35f4e3639f985a48fbf37a89e24c28d46679584f0995cf6c0`.
- DAL1 governed `server/data` checksum after build, migration, and PM2 restart: identical.
- No Production governed record was mutated.
- Cheyenne/Northstar was not opened or mutated.
- Demo was not reset or mutated.
- Chicago was not accessed.

## Implemented authority contract

- Added a PostgreSQL allowlist keyed by principal, membership, organization, and assumed authority.
- The only grant is `teralinx-user-kyle` / `org-teralinx` / `CRO_COMMERCIAL` / `commercial.lifecycle.manage`.
- No other wildcard grant exists.
- Activation requires one of the governed reason codes:
  - `PLATFORM_DEVELOPMENT`
  - `COMMERCIAL_CONTINUITY`
  - `AUTHORIZED_TESTING`
  - `EMERGENCY_OPERATIONS`
- Activation is bound to the authenticated durable session and expires no later than that session's idle or absolute expiration.
- Logout explicitly deactivates the assumption. A new login receives a new auth session and no active assumption.
- The browser can request activation, but cannot grant it: the server resolves the allowlist and effective permission on every request.
- Platform administration alone still does not satisfy an exact Commercial lifecycle duty.
- The assumption supplies only `commercial.lifecycle.manage`; it does not supply Engineering, customer signature, executive countersignature, or ScopeVersion authority.
- Existing deterministic lifecycle gates and the direct-human ScopeVersion prohibition are unchanged.
- Opportunity, Commercial Route, Proposal, and Activity writes now persist actual actor identity plus constitutional role, assumed authority, mode, reason, activation time, effective permission, and wildcard-session identity when applicable.
- A persistent application banner identifies the actual actor, constitutional role, effective assumed authority, and reason, with an explicit Exit action.

## Validation completed

- JavaScript syntax checks: PASS.
- TypeScript project check: PASS.
- Production build: PASS.
- Resolver regression: PASS.
  - Kyle with `platform.admin` only cannot satisfy `commercial.lifecycle.manage`.
  - Kyle with a valid server-resolved `CRO_COMMERCIAL` assumption can satisfy only `commercial.lifecycle.manage`.
  - The assumption does not grant Engineering authority.
  - A Demo-classified principal cannot use the Production wildcard projection.
- Anonymous activation request: rejected `401`.
- Migration: PASS; one Kyle grant inserted and zero active assumptions remained after restart.
- PM2 restart: PASS; runtime returned online and the durable grant remained present.
- Deployed bundle contains the persistent `ASSUMED AUTHORITY ACTIVE` surface.

## Required stop

The bounded live acceptance could not authenticate the required human principals because both expected secure credential files are absent:

- `/home/ubuntu/.hyperlinx-kyle-credential`: absent
- `/home/ubuntu/.hyperlinx-ryan-credential`: absent

The only staged credential is the existing Demo credential, which was not used to substitute for Kyle or Ryan. No credential was read, printed, rotated, created, or changed.

Accordingly, the following tests remain unexecuted rather than fabricated:

- Kyle rejection before activation through the live API.
- Kyle activation, Repository Restore, bounded working Opportunity mutation, Proposal mutation, attribution evidence, Exit, and post-Exit rejection.
- PM2 restart while Kyle's authenticated session is active.
- Logout/relogin proof that the assumption does not survive.
- Ryan direct Commercial regression without wildcard activation.
- Authenticated Demo and non-allowlisted-principal activation rejections.

Acceptance may resume from this deployed checkpoint when Kyle's and Ryan's existing credentials are securely staged. No code rebuild, schema reapplication, Demo reset, or Production data normalization is required.
