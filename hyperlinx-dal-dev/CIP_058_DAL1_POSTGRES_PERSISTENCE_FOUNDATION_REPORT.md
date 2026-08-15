# CIP-058 — DAL1 PostgreSQL/PostGIS Persistence Foundation Report

Date: 2026-08-15 (America/Chicago)
Execution state: **SHADOW FOUNDATION ESTABLISHED — DAL1 CUTOVER BLOCKED — CHICAGO UNCHANGED**

## Executive result

DAL1 now has a localhost-only PostgreSQL 16/PostGIS 3 foundation, a normalized constitutional schema, least-privilege roles, page checksums, a lossless shadow import of all 2,415 existing repository files, and a verified pre-migration recovery point. The existing file repositories remain the only live application write authority. The application was not deployed or switched to PostgreSQL.

The DAL1 gate is **BLOCKED** because the verified DAL1 repository snapshot contains no 3SWR records. Direct filename inspection and database lineage lookup both returned zero 3SWR artifacts. The deployed DAL1 file set also lacks several required authority repositories, and runtime authentication is still the alpha file/static implementation. Under CIP-058 section 36, Chicago replication cannot begin. Chicago was inspected read-only and was not modified.

## Infrastructure inventory

### DAL1 primary candidate — 67.213.118.179

| Surface | Evidence |
|---|---|
| Host | `f4-metal-medium-dal-1` |
| OS / kernel | Ubuntu 24.04.4 LTS; Linux 6.8.0-111-generic |
| CPU | AMD EPYC 4564P; 16 cores / 32 threads |
| RAM | 187 GiB; no swap |
| System disk | 2 × 447.1 GiB NVMe, Linux RAID `/dev/md0`, ext4 root; 407 GiB free at audit |
| Data disk | 2 × 1.7 TiB NVMe, Linux RAID `/dev/md1`, ext4 `/data`; 1.7 TiB free at audit |
| Network | Public IPv4 `67.213.118.179/31`; IPv6 present |
| Firewall | UFW active; default deny incoming; allows 22, 3001, and 5174 from anywhere |
| Open application ports | Node DAL on `*:3001`; PostgreSQL now only `127.0.0.1:5432` |
| Services | PM2-managed DAL, cloudflared, fail2ban, auditd, postfix, SSH |
| Containers | Docker and Podman absent |
| Node | v22.22.3; npm 10.9.8 |
| Live repository | `/opt/hyperlinx-ui/hyperlinx-dal-dev`, branch `teralinx-layer1`, commit `de114b7` |
| Live process | `node /opt/hyperlinx-ui/hyperlinx-dal-dev/server/index.js`, PM2, user `ubuntu` |
| File persistence | `/opt/hyperlinx-ui/hyperlinx-dal-dev/server/data` |
| File persistence size | Approximately 524 MiB; 2,415 JSON records |
| Prior governed backups | None found outside normal OS package backups |
| TLS | Application reaches cloudflared; no local TLS listener was found |
| SSH | Public-key authentication; password authentication disabled; root key login, X11, and TCP forwarding remain enabled |
| Application environment | PM2/runtime variables only; no prior database configuration |

Security findings requiring separate remediation:

- The cloudflared tunnel token is embedded directly in a systemd unit. Its value is intentionally omitted from this report. Rotate it and move it to a root-controlled credential source.
- DAL port 3001 and unused development port 5174 are allowed globally by UFW. This was not changed during persistence work.
- The current alpha auth source contains static users/passwords and unsigned base64 bearer claims. The durable identity schema is present, but live authentication has not been cut over.

### Chicago DR candidate — 64.34.93.5

| Surface | Evidence |
|---|---|
| Host | `f4-metal-small-chi-1` |
| OS / kernel | Ubuntu 24.04.3 LTS; Linux 6.8.0-94-generic |
| CPU | AMD EPYC 4484PX; 12 cores / 24 threads |
| RAM | 93 GiB; no swap |
| Disk | Mounted root: 893.8 GiB ext4 on one 894.3 GiB NVMe; second 894.3 GiB NVMe exists but is not mounted or mirrored |
| Root utilization | 22 GiB used; 813 GiB free |
| Firewall | UFW inactive |
| Open ports | 22, 3001, 4000, 5173, and public `0.0.0.0:5432` |
| Containers | Docker active; `iof-api` and `iof-postgres` |
| Existing PostgreSQL | Docker PostgreSQL 15.17, database `iofdb`; PostGIS absent |
| Existing database records | closes 10,408; closures 87; corridors 1; scope_versions 153; segments 1; stations 2,524 |
| Existing DB storage | Docker volume `api_iof_postgres_data` |
| Existing applications | `/opt/hyperlinx` (415 MiB) and `/opt/iof` |
| TLS | No local LetsEncrypt or proxy/TLS service found |
| SSH | Public-key auth; password auth disabled; keyboard-interactive, root key login, X11, and TCP forwarding enabled |
| Backups | No governed application/database backups found in `/var/backups` |

Chicago is not an empty standby. Its public PostgreSQL 15 workload and unmirrored storage must be explicitly preserved or retired under a separate approved preparation plan. No Chicago files, services, firewall rules, containers, databases, or volumes were changed.

## Existing DAL1 repository inventory and classification

The migration preserves the source bytes and classifies the populated DAL1 repositories as follows.

| Repository | Count | Classification |
|---|---:|---|
| accounts | 6 | AUTHORITY |
| contacts | 4 | AUTHORITY |
| products | 14 | AUTHORITY |
| commercial-opportunities | 34 | AUTHORITY |
| commercial-routes | 34 | IMMUTABLE_ARTIFACT |
| proposal-drafts | 20 | WORKING_STATE / immutable when record flags require it |
| customer-design-imports | 17 | EVIDENCE_REFERENCE |
| candidate-sites | 604 | WORKING_STATE |
| opportunity-seeds | 62 | FIXTURE |
| fulfillment-plans | 2 | AUTHORITY |
| iof-packages | 11 | IMMUTABLE_ARTIFACT |
| engineering-intakes | 7 | EVIDENCE_REFERENCE |
| engineering-drafts | 6 | WORKING_STATE |
| certified-iof-packages | 1 | IMMUTABLE_ARTIFACT |
| certified-routes | 25 | IMMUTABLE_ARTIFACT |
| service-orders | 1 | IMMUTABLE_ARTIFACT |
| scopeversions | 20 | IMMUTABLE_ARTIFACT |
| control-work-items | 25 | WORKING_STATE |
| marketplace-quotes | 11 | WORKING_STATE |
| runtime-workspaces | 4 | WORKING_STATE / personal state source |
| runtime-workspace-sessions | 2 | TEMPORARY |
| runtime-objects | 708 | CURRENT_PROJECTION |
| runtime-relationships | 22 | CURRENT_PROJECTION |
| runtime-inventories | 2 | CURRENT_PROJECTION |
| runtime-evidence | 338 | EVIDENCE_REFERENCE |
| runtime-history | 259 | EVENT |
| activity | 171 | EVENT |
| runtime-validation | 2 | DIAGNOSTIC |
| runtime-connectors | 1 | DIAGNOSTIC |
| translation-commits | 2 | IMMUTABLE_ARTIFACT |

Present but empty: `close-events`, `engineering-packages`, `field-closures`, and `inventory-graphs`.

Not present in the deployed DAL1 persistence tree: Commercial revision/change-set/release repositories; Engineering Baseline, Revision, Change Set, Approval, and object/station projection repositories; Certification Ledger; signatures/countersignatures; authorization certificates; Redline repositories; closure ledgers; IOF Twin projections; Marketplace package/response/allocation/award/observation repositories; transaction manifests.

Those absences are reported as missing authority surfaces. No replacement identities or inferred authority records were generated.

## Pre-migration recovery point

Path: `/data/hyperlinx-backups/cip-058/pre-migration-20260815T142927Z`

Evidence:

- source files: 2,415;
- copied files: 2,415;
- manifest entries: 2,415;
- archive file entries: 2,415;
- per-file SHA-256 verification: PASS;
- archive SHA-256 verification: PASS;
- known governed member read from archive: PASS;
- compressed archive size: 30,229,991 bytes;
- backup is on the separate mirrored `/data` filesystem and outside the working repository.

Post-migration foundation backup:

- `/data/hyperlinx-postgres/backups/cip058-foundation-20260815T151254Z/hyperlinx.dump`;
- custom-format dump size: 35,017,848 bytes;
- SHA-256 verification: PASS;
- `pg_restore --list` read verification: PASS, 1,047 catalog entries.

This is recovery evidence, not a completed automated retention/PITR policy.

## PostgreSQL/PostGIS foundation

| Component | Version / state |
|---|---|
| PostgreSQL server/client | 16.14, Ubuntu package `16.14-0ubuntu0.24.04.1` |
| PostGIS | 3.4.2 |
| GEOS / PROJ | GEOS 3.12.1; PROJ 9.4.0 |
| pgcrypto | 1.3 |
| Page checksums | enabled |
| Listener | localhost only |
| Database | `hyperlinx`, 161 MiB after import and acceptance evidence |
| Owner | `hyperlinx_owner`, NOLOGIN and non-superuser |
| Migrator | `hyperlinx_migrator`, non-superuser |
| Application | `hyperlinx_app`, non-superuser and bounded grants |
| Secret storage | `/etc/hyperlinx/secrets/postgres.env`, root:ubuntu, mode 0640 |
| Live runtime mode | file (unchanged) |

Schema migrations:

- `0001_cip058_foundation`;
- `0002_governed_commands`;
- `0003_diff_resolution`.

The schema includes organizations, principals, credential digests, memberships, roles, permissions, assignments, personal state, customers, Opportunities, Proposals and immutable Proposal Revisions, separate current pointers, immutable governed artifacts, ScopeVersions, immutable Redline revisions, evidence references, generalized PostGIS Places, temporal object/place relationships, append-only governed events, current-state projections, idempotency records, and lossless repository import records.

Server functions enforce:

- active principal/membership/organization correspondence;
- permission checks for Opportunity and Proposal mutation;
- optimistic row/pointer versions and `STALE_CONTEXT`;
- exact Proposal clone state, new revision identity, and parent lineage;
- append-only immutable artifacts;
- Redline `scope_version_id NOT NULL` plus foreign-key authority;
- event idempotency and aggregate serialization;
- preceding-event/from-state consistency;
- replay/current-projection consistency.

## Migration and reconciliation

Import run: `cip058-pre-migration-20260815T142927Z`

| Check | Result |
|---|---|
| Source file count | 2,415 |
| PostgreSQL repository record count | 2,415 |
| Missing records | 0 |
| Unexpected records | 0 |
| Byte-size mismatches | 0 |
| SHA-256 mismatches | 0 |
| Import errors | 0 |

Every source file is retained losslessly in `repository_records.payload` with repository, source path, byte size, source SHA-256, classification, and available scope metadata. Normalized records are created only when source authority fields are sufficient. Records without adequate lineage remain lossless generic records; the migration does not invent absent relationships.

## Acceptance results

Acceptance evidence run: `cip058-1786806621489`

PASS:

- PostgreSQL, PostGIS, checksum, and localhost binding health;
- least-privilege role flags;
- three distinct principals/memberships/permission sets;
- exact Opportunity commercial-state save/reload, including civil mix 82/12/0/6, geometry hash/revision, Engineering reference, and structural IOF fixture;
- Opportunity idempotent retry;
- stale Opportunity rejection (`40001`);
- wrong organization/membership rejection (`42501`);
- wrong permission rejection (`42501`);
- exact Proposal clone, older-revision branching, deterministic diff, and idempotency;
- unauthorized Proposal clone rejection;
- immutable Proposal, Redline, and governed-artifact mutation rejection (`55000`);
- Redline without ScopeVersion rejection;
- append-only events, idempotent event retry, stale event rejection, wrong-actor rejection;
- concurrent same-version commands: exactly one succeeds and one returns `STALE_CONTEXT`;
- current-state projection equals replay at version 3;
- generalized Route and Site Place insertion and bounded PostGIS viewport query;
- local build, TypeScript typecheck, Node syntax checks, and server shared-module import.

Measured DAL1 database p95 latency:

| Operation | p95 |
|---|---:|
| Opportunity lookup | 0.508 ms |
| Opportunity rehydration | 0.143 ms |
| ScopeVersion lookup | 0.107 ms |
| Object current-state lookup | 0.093 ms |
| Viewport spatial query | 0.119 ms |
| Station/range property query | 0.213 ms |
| Replay integrity | 0.167 ms |
| User authorization projection | 0.294 ms |

These are local database measurements on a small acceptance fixture, not full HTTP/browser or production-load benchmarks. The existing CIP-054/055 SpineSpatialIndex and MapKernel projection path were not replaced.

## DAL1 gate and Chicago decision

DAL1 gate: **BLOCKED**.

Blocking evidence:

1. The verified DAL1 snapshot has no filename containing `3SWR`.
2. Structured lookup across Opportunity, Proposal, Package, ScopeVersion, and repository metadata returns no 3SWR lineage.
3. Required 3SWR authority chain therefore cannot be reconciled.
4. Several deployed authority repositories are absent or empty, including Engineering Package/Approval and Certification Ledger.
5. Live auth is still the static alpha implementation; database-backed login/token resolution has not been integrated or regression-tested.
6. The live DAL application has not undergone shadow dual-write/read comparison, failure-injection testing, or controlled write cutover.
7. Automated PostgreSQL base backup, WAL archive retention, artifact replication, and monitoring are not established.
8. Dependency audit reports five existing issues (three high, one moderate, one low) in front-end transitive/runtime packages; `pg` itself introduced no reported isolated-stage vulnerabilities.

Because the gate is blocked:

- no live application cutover occurred;
- no file repository was cleared, deleted, renamed, or made read-only;
- no Chicago replication identity/configuration was created;
- no Chicago database/container/storage/firewall change occurred;
- no DR promotion test was attempted.

## Required next controlled phase

Before cutover or Chicago work:

1. Identify the authoritative 3SWR source and place it under a governed DAL1 migration input without regenerating identities.
2. Re-run lossless import and exact 3SWR lineage reconciliation.
3. Integrate durable authentication so every write receives actor, membership, organization, and permission from verified server context.
4. Run live file→PostgreSQL shadow writes and response/read comparisons with the current application performance fixtures.
5. Complete HTTP/browser regression and failure tests, including database/artifact interruption.
6. Establish monitored PostgreSQL backups, WAL/archive retention, and artifact backup/replication.
7. Resolve Chicago's existing public PostgreSQL workload and storage topology without overwriting it.
8. Only after every DAL1 gate is PASS, prepare compatible Chicago PostgreSQL/PostGIS and streaming replication with explicit fencing/promotion procedures.
