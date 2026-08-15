# CIP-059 — DAL1 IOF Authority Reconciliation & PostgreSQL Cutover

Date: 2026-08-15 (America/Chicago)
Execution state: **DAL1 AUTHORITY TRACE COMPLETE — SOURCE AUTHORITY ABSENT — IMPORT AND CUTOVER BLOCKED**

## Outcome

CIP-059 traced the running IOF/Hyperlinx runtime on DAL1 (`67.213.118.179`) and searched DAL1 only. The governed 3SWR acceptance chain is not present in the running DAL1 file repository, another DAL1 application data path, the deployed source or Git history, PM2 logs, the CIP-058 PostgreSQL shadow database, or the live DAL HTTP projections.

This is not a CIP-058 reconciliation failure. CIP-058 imported every one of the 2,415 files supplied by the active DAL1 repository with byte and SHA-256 equality. There is no additional DAL1 3SWR source record available to import losslessly. Creating records from identifiers, rebuilding the chain through Planner, or copying a partial object into an invented repository would manufacture authority, so no import, recertification, resigning, ScopeVersion creation, shadow-write activation, or cutover was performed.

Chicago was not searched, connected to, or changed during CIP-059.

## Running DAL1 runtime trace

| Runtime surface | Observed DAL1 state |
|---|---|
| Process manager | PM2 daemon, PID 685857, user `ubuntu` |
| Application | PM2 app `hyperlinx-dal-api`, online |
| IOF/Hyperlinx process | PID 3354524, `node /opt/hyperlinx-ui/hyperlinx-dal-dev/server/index.js` |
| Process working directory | `/opt/hyperlinx-ui/hyperlinx-dal-dev` |
| Deployed branch / commit | `teralinx-layer1` / `de114b7d0476e05082d84e2190eb0ed8b4eb5a49` |
| Commit date | 2026-07-07T11:45:02-05:00 |
| Process environment | No `DAL_DATA_ROOT` and no live PostgreSQL application variables |
| Active file root | `/opt/hyperlinx-ui/hyperlinx-dal-dev/server/data` |
| Outer application data | `/opt/hyperlinx-ui/server/data`; 11 baseline-graph files only |
| Separate IOF process/service/container | None found |
| Live persistence mode | File repositories; PostgreSQL remains a CIP-058 shadow foundation |

The running server resolves `DATA_ROOT` to its own `server/data` directory when `DAL_DATA_ROOT` is absent. Its IOF handlers, Engineering Certification handler, Service Order handler, ScopeVersion authority engine, Twin handler, and repository adapters are modules inside the same Node process. There is no second running IOF core with a different working directory or data mount.

The latest file in the active DAL repository is dated 2026-08-12T13:18:20Z. The known 3SWR Opportunity identifier embeds epoch `1786645604709`, or 2026-08-13T18:26:44.709Z—more than a day after DAL1's latest authoritative file write.

## Exact-identity search

The audit used the supplied exact identities, not filename-only discovery:

- `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- `ENG-REV-ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2-000`
- `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- `ENG-APPROVAL-ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2-29ac9a51d822ac4a-2bc2d2c47f53`
- approval hash `b22a98a39fdbf389733d96190b986024c9f4b9e9581dc487fab81c7133461f80`
- Opportunity `OPP-DEMO-OPPORTUNITY-3SWR-1786645604709`
- Proposal `PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Proposal Revision `PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`
- Certified IOF `CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`

Read-only content searches covered current DAL1 files under `/opt`, `/home`, `/data`, `/var`, `/srv`, `/mnt`, `/media`, `/tmp`, and root-controlled paths, with operating-system, package-cache, PostgreSQL binary-storage, `node_modules`, and Git object directories excluded where direct semantic searching would be invalid. The search also covered PM2 logs and deployed Git history using content search. No exact identity or approval-hash match was found.

No relevant deleted-but-open file is attached to the running Node process, and DAL1 has no additional application filesystem mount hiding another IOF repository.

## PostgreSQL and live-projection reconciliation

The CIP-058 database was queried read-only for exact identity and payload matches.

| PostgreSQL authority surface | Exact 3SWR matches |
|---|---:|
| `opportunities` | 0 |
| `proposals` | 0 |
| `proposal_revisions` | 0 |
| `governed_artifacts` | 0 |
| `scope_versions` | 0 |
| `governed_events` | 0 |
| `repository_records` | 0 |

The live DAL HTTP process was queried with an existing read-authorized actor token. It returned `404` for the exact:

- Opportunity;
- Proposal;
- Engineering Package;
- Draft IOF Package;
- Certified IOF Package.

The database and live application therefore agree with the filesystem trace: DAL1 currently has no 3SWR chain to reconcile.

## Repository-adapter finding

The deployed DAL1 server registers repository adapters for Commercial Opportunities and Routes, Proposal Drafts, IOF Packages, Engineering Drafts and Intakes, Engineering Packages, Engineering Certification, Certified IOF Packages, Service Orders, ScopeVersions, close/events, runtime objects/relationships/history, and Twin projection.

However, the deployed commit does not register the later repository surfaces required by the supplied acceptance chain, including distinct Engineering Revision, Engineering Approval, Certification Ledger, signature/countersignature, and the later governed projection repositories. Their corresponding directories are absent from the deployed data tree. `engineering-packages` exists but is empty.

This establishes the root cause: **the 3SWR chain was created against a later runtime/repository contract than the one deployed and writing on DAL1. It was never persisted by the running DAL1 authority and therefore was not omitted by the CIP-058 importer.**

## Browser-storage boundary

The deployed UI contains a legacy IndexedDB database named `hyperlinx-dal-dev`, with migration support from legacy `localStorage`. Its collections are limited to inventory graphs/jobs, customer design imports, candidate sites, graph extensions, ScopeVersions, IOF packages, close events, Opportunities, opportunity seeds, quotes, work items, and closures.

That browser store is not the DAL1 server filesystem, is not reachable from the DAL1 Node process, and does not define collections for Engineering Packages, Engineering Revisions, Engineering Approvals, Certification Ledgers, Certified IOF Packages, or Service Orders. It cannot provide the complete acceptance chain required for a lossless cutover. No browser or other machine was searched under CIP-059.

## Authority classification required when a source is produced

The CIP-058 manifest remains complete for the records it received. A future DAL1 migration input containing the exact chain must be classified without changing identifiers, payloads, revisions, hashes, or lineage:

| Record family | Required authority classification |
|---|---|
| Customer / Account | Authority record |
| Opportunity | Commercial authority/current governed state |
| Commercial Route and accepted source geometry | Immutable governed artifact plus source evidence/provenance |
| Proposal and Proposal Revision | Proposal authority; revision immutable after release |
| Draft IOF Package | Governed Commercial-to-Engineering handoff artifact |
| Engineering Package | Engineering work-package authority |
| Engineering Revision | Immutable Engineering revision |
| Engineering Approval | Immutable human-approval authority artifact |
| Certification Ledger | Append-only certification ledger |
| Certified IOF Package | Immutable certified authority artifact |
| Service Order and signatures | Immutable Commercial authorization/evidence artifacts |
| ScopeVersion | Immutable constitutional execution authority |
| Objects and stations | Governed object/station records with their existing source lineage; projections remain projections |
| Close events / Twin | Append-only governed events and derived/current Twin projections |

This table defines manifest treatment only. It is not authorization to synthesize missing rows.

## Absolute cutover gate

PostgreSQL cutover remains blocked until a DAL1-owned, byte-preserving source contains the complete existing chain and all checks below pass:

1. Same Account/Customer and Opportunity identities.
2. Same accepted Route, route revision, source evidence, geometry, and geometry hash.
3. Same Proposal and immutable Proposal Revision.
4. Same Draft IOF and Engineering Package.
5. Same Engineering Revision and human Engineering Approval ID/hash.
6. Same Certification Ledger and Certified IOF.
7. Same Service Order and existing signature/countersignature evidence.
8. Same ScopeVersion—no new ScopeVersion.
9. Same objects, stations, hashes, parent references, and full lineage.
10. Exact file-to-PostgreSQL byte/hash reconciliation.
11. Shadow read and write equivalence through the live API.
12. Browser validation that 3SWR opens at its current location and state.

Until those conditions pass, no live adapter may make PostgreSQL primary, no file repository may be cleared or demoted, and no Chicago preparation or replication may begin.

## Changes and non-changes

- Added this audit/reconciliation report only.
- Made no DAL1 application, repository, database, PM2, service, firewall, or configuration mutation.
- Did not import or invent any 3SWR record.
- Did not rebuild, recertify, resign, or generate a ScopeVersion.
- Did not enable shadow writes or perform cutover.
- Did not access or change Chicago.
