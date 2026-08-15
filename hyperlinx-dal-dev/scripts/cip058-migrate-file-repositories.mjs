import { createHash, randomBytes, scryptSync } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getMigrationPool, closePostgresPools } from "../server/persistence/postgres/client.js";
import { firstText, repositoryMetadata } from "../server/persistence/repositoryCatalog.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    const [rawKey, inlineValue] = argument.slice(2).split("=", 2);
    parsed[rawKey] = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
  }
  return parsed;
}

async function loadEnvironmentFile(filename) {
  if (!filename) return;
  const content = await readFile(filename, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function walkJsonFiles(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(absolute);
    }
  }
  await visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function passwordDigest(password) {
  const salt = randomBytes(16);
  const cost = 16384;
  const blockSize = 8;
  const parallelization = 1;
  const derived = scryptSync(password, salt, 64, { N: cost, r: blockSize, p: parallelization });
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

function requiredBootstrapPassword(name) {
  const value = process.env[`HYPERLINX_BOOTSTRAP_${name.toUpperCase()}_PASSWORD`];
  if (!value) throw new Error(`HYPERLINX_BOOTSTRAP_${name.toUpperCase()}_PASSWORD is required.`);
  return value;
}

const BOOTSTRAP_PRINCIPALS = [
  {
    principalId: "teralinx-user-kyle",
    username: "kyle",
    displayName: "Kyle",
    roleKey: "ADMINISTRATOR_COO",
    password: () => requiredBootstrapPassword("kyle"),
    permissions: ["platform.admin", "runtime.deploy", "users.manage", "workspace.translate", "workspace.commercial", "workspace.proposal", "workspace.salesEngineering", "workspace.engineering.read", "workspace.engineering.write", "scopeversion.authority", "customerDesign.manage", "opportunity.manage", "proposal.manage"],
  },
  {
    principalId: "teralinx-user-ryan",
    username: "ryan",
    displayName: "Ryan",
    roleKey: "CRO",
    password: () => requiredBootstrapPassword("ryan"),
    permissions: ["workspace.translate", "workspace.commercial", "workspace.proposal", "workspace.salesEngineering", "customerDesign.manage", "opportunity.manage", "proposal.manage"],
  },
  {
    principalId: "teralinx-user-fran",
    username: "fran",
    displayName: "Fran",
    roleKey: "CEO",
    password: () => requiredBootstrapPassword("fran"),
    permissions: ["workspace.commercial", "workspace.proposal", "workspace.executiveReview", "workspace.engineering.read", "customerDesign.read", "opportunity.read", "proposal.read"],
  },
  {
    principalId: "google-participant-001",
    username: "google",
    displayName: "Google Customer",
    roleKey: "CUSTOMER_PARTICIPANT",
    password: () => requiredBootstrapPassword("google"),
    permissions: ["workspace.commercial", "workspace.proposal", "customerDesign.manage", "opportunity.read", "proposal.read", "proposal.review"],
  },
];

async function seedIdentity(client) {
  await client.query(`
    INSERT INTO hyperlinx.organizations (organization_id, slug, name)
    VALUES ('org-teralinx', 'teralinx', 'Teralinx')
    ON CONFLICT (organization_id) DO NOTHING
  `);
  for (const principal of BOOTSTRAP_PRINCIPALS) {
    const membershipId = `membership-${principal.principalId}`;
    const roleId = `role-org-teralinx-${principal.roleKey.toLowerCase()}`;
    await client.query(`
      INSERT INTO hyperlinx.principals (principal_id, subject, username, display_name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (principal_id) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        updated_at = clock_timestamp()
    `, [principal.principalId, `internal:${principal.principalId}`, principal.username, principal.displayName]);
    await client.query(`
      INSERT INTO hyperlinx.principal_credentials (principal_id, password_digest)
      VALUES ($1, $2)
      ON CONFLICT (principal_id) DO NOTHING
    `, [principal.principalId, passwordDigest(principal.password())]);
    await client.query(`
      INSERT INTO hyperlinx.memberships (membership_id, organization_id, principal_id)
      VALUES ($1, 'org-teralinx', $2)
      ON CONFLICT (membership_id) DO NOTHING
    `, [membershipId, principal.principalId]);
    await client.query(`
      INSERT INTO hyperlinx.roles (role_id, organization_id, role_key, name)
      VALUES ($1, 'org-teralinx', $2, $2)
      ON CONFLICT (role_id) DO NOTHING
    `, [roleId, principal.roleKey]);
    for (const permissionKey of principal.permissions) {
      const permissionId = `permission-${sha256(permissionKey).slice(0, 20)}`;
      await client.query(`
        INSERT INTO hyperlinx.permissions (permission_id, permission_key)
        VALUES ($1, $2)
        ON CONFLICT (permission_key) DO NOTHING
      `, [permissionId, permissionKey]);
      await client.query(`
        INSERT INTO hyperlinx.role_permissions (role_id, permission_id)
        SELECT $1, permission_id FROM hyperlinx.permissions WHERE permission_key = $2
        ON CONFLICT DO NOTHING
      `, [roleId, permissionKey]);
    }
    await client.query(`
      INSERT INTO hyperlinx.assignments (assignment_id, membership_id, role_id, scope_type, scope_id)
      VALUES ($1, $2, $3, 'ORGANIZATION', 'org-teralinx')
      ON CONFLICT (assignment_id) DO NOTHING
    `, [`assignment-${principal.principalId}-${principal.roleKey.toLowerCase()}`, membershipId, roleId]);
  }
}

function repositoryDetails(dataRoot, filename, payload, raw) {
  const relative = path.relative(dataRoot, filename).split(path.sep).join("/");
  const [repositoryName] = relative.split("/");
  const fileStem = decodeURIComponent(path.basename(filename, ".json"));
  const metadata = repositoryMetadata(repositoryName, payload, fileStem);
  return {
    filename,
    relative,
    repositoryName,
    fileStem,
    metadata,
    payload,
    raw,
    fileHash: sha256(raw),
    byteSize: Buffer.byteLength(raw, "utf8"),
  };
}

async function ensureOrganization(client, organizationId) {
  const resolved = organizationId || "org-teralinx";
  await client.query(`
    INSERT INTO hyperlinx.organizations (organization_id, slug, name)
    VALUES ($1, $2, $3)
    ON CONFLICT (organization_id) DO NOTHING
  `, [resolved, resolved.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || sha256(resolved).slice(0, 12), resolved]);
  return resolved;
}

async function ensureCustomer(client, details) {
  const customerId = details.metadata.customerId || (details.repositoryName === "accounts" ? details.fileStem : "");
  if (!customerId) return null;
  const organizationId = await ensureOrganization(client, details.metadata.organizationId);
  if (details.repositoryName !== "accounts") {
    await client.query(`
      INSERT INTO hyperlinx.customers (customer_id, organization_id, name, status)
      VALUES ($1,$2,$1,'MIGRATED_REFERENCE_ONLY')
      ON CONFLICT (customer_id) DO NOTHING
    `, [customerId, organizationId]);
    return customerId;
  }
  const numericAccount = Number(details.payload.accountNumber ?? details.payload.formalAccountNumber);
  const accountNumber = Number.isSafeInteger(numericAccount) && numericAccount > 0 ? numericAccount : null;
  const name = firstText(details.payload.name, details.payload.accountName, details.payload.customerName, customerId);
  await client.query(`
    INSERT INTO hyperlinx.customers (
      customer_id, organization_id, account_number, name, status, source_record,
      created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,clock_timestamp()),COALESCE($8::timestamptz,clock_timestamp()))
    ON CONFLICT (customer_id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      source_record = EXCLUDED.source_record,
      updated_at = EXCLUDED.updated_at,
      account_number = COALESCE(customers.account_number, EXCLUDED.account_number)
  `, [
    customerId,
    organizationId,
    accountNumber,
    name,
    firstText(details.payload.status, "ACTIVE"),
    details.payload,
    details.payload.createdAt ?? details.payload.createdDate ?? null,
    details.payload.updatedAt ?? details.payload.modifiedDate ?? null,
  ]);
  return customerId;
}

async function importOpportunity(client, details) {
  if (details.repositoryName !== "commercial-opportunities") return;
  const opportunityId = firstText(details.payload.opportunityId, details.fileStem);
  const organizationId = await ensureOrganization(client, details.metadata.organizationId);
  let customerId = details.metadata.customerId;
  if (customerId) {
    await ensureCustomer(client, details);
  } else {
    customerId = null;
  }
  const actorId = firstText(details.payload.createdById, details.payload.ownerId);
  const actorExists = actorId
    ? (await client.query("SELECT 1 FROM hyperlinx.principals WHERE principal_id=$1", [actorId])).rowCount > 0
    : false;
  await client.query(`
    INSERT INTO hyperlinx.opportunities (
      opportunity_id, organization_id, customer_id, name, description, product_reference,
      current_lifecycle_state, current_artifact_type, current_artifact_id, status,
      commercial_state, row_version, created_by, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
      COALESCE($14::timestamptz,clock_timestamp()),COALESCE($15::timestamptz,clock_timestamp())
    )
    ON CONFLICT (opportunity_id) DO UPDATE SET
      customer_id = EXCLUDED.customer_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      product_reference = EXCLUDED.product_reference,
      current_lifecycle_state = EXCLUDED.current_lifecycle_state,
      current_artifact_type = EXCLUDED.current_artifact_type,
      current_artifact_id = EXCLUDED.current_artifact_id,
      status = EXCLUDED.status,
      commercial_state = EXCLUDED.commercial_state,
      row_version = GREATEST(opportunities.row_version, EXCLUDED.row_version),
      updated_at = EXCLUDED.updated_at
  `, [
    opportunityId,
    organizationId,
    customerId,
    firstText(details.payload.name, details.payload.title, opportunityId),
    firstText(details.payload.description, details.payload.summary),
    details.payload.productReference ?? {
      productId: details.payload.productId ?? null,
      productName: details.payload.productName ?? null,
    },
    firstText(details.payload.currentLifecycleState, details.payload.lifecycleState, details.payload.commercialStatus, "PROPOSED"),
    firstText(details.payload.currentArtifactType) || null,
    firstText(details.payload.currentArtifactId, details.payload.routeRepositoryId) || null,
    firstText(details.payload.status, "ACTIVE"),
    details.payload,
    Math.max(1, Number(details.payload.rowVersion ?? details.payload.version ?? 1) || 1),
    actorExists ? actorId : null,
    details.payload.createdAt ?? details.payload.createdDate ?? null,
    details.payload.updatedAt ?? details.payload.modifiedDate ?? null,
  ]);
}

async function importRepositoryRecord(client, importRunId, details) {
  const organizationId = await ensureOrganization(client, details.metadata.organizationId);
  await client.query(`
    INSERT INTO hyperlinx.repository_records (
      repository_name, record_id, source_file_path, classification, organization_id,
      customer_id, opportunity_id, revision, parent_id, status, is_current,
      embedded_hash, source_file_hash, byte_size, payload, import_run_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (repository_name, record_id) DO UPDATE SET
      source_file_path=EXCLUDED.source_file_path,
      classification=EXCLUDED.classification,
      organization_id=EXCLUDED.organization_id,
      customer_id=EXCLUDED.customer_id,
      opportunity_id=EXCLUDED.opportunity_id,
      revision=EXCLUDED.revision,
      parent_id=EXCLUDED.parent_id,
      status=EXCLUDED.status,
      is_current=EXCLUDED.is_current,
      embedded_hash=EXCLUDED.embedded_hash,
      source_file_hash=EXCLUDED.source_file_hash,
      byte_size=EXCLUDED.byte_size,
      payload=EXCLUDED.payload,
      import_run_id=EXCLUDED.import_run_id,
      imported_at=clock_timestamp()
  `, [
    details.repositoryName,
    details.fileStem,
    details.relative,
    details.metadata.classification,
    organizationId,
    details.metadata.customerId || null,
    details.metadata.opportunityId || null,
    details.metadata.revision || null,
    details.metadata.parentId || null,
    details.metadata.status || null,
    details.metadata.isCurrent,
    details.metadata.embeddedHash || null,
    details.fileHash,
    details.byteSize,
    details.payload,
    importRunId,
  ]);
}

async function ensureOpportunityPlaceholder(client, details) {
  const opportunityId = details.metadata.opportunityId;
  if (!opportunityId) return null;
  const organizationId = await ensureOrganization(client, details.metadata.organizationId);
  if (details.metadata.customerId) await ensureCustomer(client, details);
  await client.query(`
    INSERT INTO hyperlinx.opportunities (
      opportunity_id, organization_id, customer_id, name, current_lifecycle_state,
      status, commercial_state
    ) VALUES ($1,$2,$3,$1,'PROPOSED','MIGRATED_REFERENCE_ONLY','{}'::jsonb)
    ON CONFLICT (opportunity_id) DO NOTHING
  `, [opportunityId, organizationId, details.metadata.customerId || null]);
  return opportunityId;
}

async function importSpecializedArtifact(client, details) {
  if (details.metadata.classification !== "IMMUTABLE_ARTIFACT") return;
  const organizationId = await ensureOrganization(client, details.metadata.organizationId);
  const opportunityId = await ensureOpportunityPlaceholder(client, details);
  if (details.metadata.customerId) await ensureCustomer(client, details);
  await client.query(`
    INSERT INTO hyperlinx.governed_artifacts (
      artifact_id, artifact_type, revision, organization_id, customer_id, opportunity_id,
      parent_artifact_id, authority, status, payload, content_hash, source_file_path,
      created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13::timestamptz,clock_timestamp()))
    ON CONFLICT (artifact_type, artifact_id, revision) DO NOTHING
  `, [
    details.metadata.recordId || details.fileStem,
    details.repositoryName.toUpperCase().replace(/-/g, "_"),
    details.metadata.revision || "1",
    organizationId,
    details.metadata.customerId || null,
    opportunityId,
    details.metadata.parentId || null,
    firstText(details.payload.authority, details.payload.sourceAuthority, `${details.repositoryName.toUpperCase().replace(/-/g, "_")}_REPOSITORY`),
    details.metadata.status || "MIGRATED",
    details.payload,
    details.metadata.embeddedHash || details.fileHash,
    details.relative,
    details.payload.createdAt ?? details.payload.certifiedAt ?? null,
  ]);
}

async function importProposal(client, details, revisionCounters) {
  if (details.repositoryName !== "proposal-drafts") return;
  const proposalId = firstText(details.payload.proposalId, details.payload.proposalRecordId, details.fileStem);
  const opportunityId = await ensureOpportunityPlaceholder(client, details);
  if (!opportunityId) return;
  const organizationId = await ensureOrganization(client, details.metadata.organizationId);
  const actorId = firstText(details.payload.createdById, details.payload.ownerId);
  const actorExists = actorId
    ? (await client.query("SELECT 1 FROM hyperlinx.principals WHERE principal_id=$1", [actorId])).rowCount > 0
    : false;
  await client.query(`
    INSERT INTO hyperlinx.proposals (proposal_id, opportunity_id, organization_id, created_by, created_at)
    VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz,clock_timestamp()))
    ON CONFLICT (proposal_id) DO NOTHING
  `, [proposalId, opportunityId, organizationId, actorExists ? actorId : null, details.payload.createdAt ?? null]);
  const revisionId = firstText(details.payload.proposalRevisionId, details.payload.proposalRecordId, details.fileStem);
  const requestedNumber = Number(details.payload.revisionNumber ?? details.payload.revision ?? details.payload.version);
  const currentCounter = revisionCounters.get(proposalId) ?? 0;
  const revisionNumber = Number.isSafeInteger(requestedNumber) && requestedNumber > currentCounter
    ? requestedNumber
    : currentCounter + 1;
  revisionCounters.set(proposalId, revisionNumber);
  await client.query(`
    INSERT INTO hyperlinx.proposal_revisions (
      proposal_revision_id, proposal_id, opportunity_id, organization_id, revision_number,
      parent_revision_id, status, commercial_state, content_hash, created_by, created_at,
      source_file_path
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz,clock_timestamp()),$12)
    ON CONFLICT (proposal_revision_id) DO NOTHING
  `, [
    revisionId,
    proposalId,
    opportunityId,
    organizationId,
    revisionNumber,
    firstText(details.payload.parentRevisionId) || null,
    details.metadata.status || "MIGRATED",
    details.payload,
    details.metadata.embeddedHash || details.fileHash,
    actorExists ? actorId : null,
    details.payload.createdAt ?? details.payload.acceptedAt ?? null,
    details.relative,
  ]);
}

async function importScopeVersion(client, details) {
  if (details.repositoryName !== "scopeversions") return;
  const scopeVersionId = firstText(details.payload.scopeVersionId, details.fileStem);
  const opportunityId = await ensureOpportunityPlaceholder(client, details);
  if (!opportunityId) return;
  const organizationId = await ensureOrganization(client, details.metadata.organizationId);
  const actorId = firstText(details.payload.createdById, details.payload.approvedBy);
  const actorExists = actorId
    ? (await client.query("SELECT 1 FROM hyperlinx.principals WHERE principal_id=$1", [actorId])).rowCount > 0
    : false;
  await client.query(`
    INSERT INTO hyperlinx.scope_versions (
      scope_version_id, organization_id, customer_id, opportunity_id, proposal_revision_id,
      engineering_package_id, engineering_revision_id, engineering_approval_id,
      certified_iof_id, certification_ledger_id, service_order_revision_id,
      customer_signature_id, countersignature_id, status, payload, content_hash,
      created_by, created_at
    ) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,COALESCE($17::timestamptz,clock_timestamp()))
    ON CONFLICT (scope_version_id) DO NOTHING
  `, [
    scopeVersionId,
    organizationId,
    details.metadata.customerId || null,
    opportunityId,
    firstText(details.payload.engineeringPackageId, details.payload.technicalSourcePackageId) || null,
    firstText(details.payload.engineeringRevisionId) || null,
    firstText(details.payload.engineeringApprovalId) || null,
    firstText(details.payload.certifiedIofPackageId, details.payload.certifiedPackageId) || null,
    firstText(details.payload.certificationLedgerId) || null,
    firstText(details.payload.serviceOrderRevisionId, details.payload.serviceOrderId) || null,
    firstText(details.payload.customerSignatureId, details.payload.customerAcceptanceId) || null,
    firstText(details.payload.countersignatureId, details.payload.serviceOrderSignatureId) || null,
    details.metadata.status || "AUTHORIZED",
    details.payload,
    details.metadata.embeddedHash || details.fileHash,
    actorExists ? actorId : null,
    details.payload.createdAt ?? details.payload.decisionTimestamp ?? null,
  ]);
}

async function readDetails(dataRoot, filename) {
  const raw = await readFile(filename, "utf8");
  return repositoryDetails(dataRoot, filename, JSON.parse(raw), raw);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  await loadEnvironmentFile(args["env-file"]);
  const dataRoot = path.resolve(args["data-root"] ?? path.join(PROJECT_ROOT, "server", "data"));
  const files = await walkJsonFiles(dataRoot);
  const fileStats = await Promise.all(files.map(async (filename) => {
    const info = await stat(filename);
    return `${path.relative(dataRoot, filename).split(path.sep).join("/")}\t${info.size}`;
  }));
  const sourceManifestHash = sha256(fileStats.join("\n"));
  const importRunId = args["import-run-id"] ?? `cip058-${Date.now()}`;
  const pool = getMigrationPool();
  const client = await pool.connect();
  let imported = 0;
  let errors = 0;
  const revisionCounters = new Map();
  try {
    await seedIdentity(client);
    await client.query(`
      INSERT INTO hyperlinx.repository_import_runs (
        import_run_id, source_root, source_manifest_hash, status, source_file_count
      ) VALUES ($1,$2,$3,'RUNNING',$4)
      ON CONFLICT (import_run_id) DO UPDATE SET
        status='RUNNING', started_at=clock_timestamp(), completed_at=NULL,
        source_file_count=EXCLUDED.source_file_count, imported_file_count=0, error_count=0
    `, [importRunId, dataRoot, sourceManifestHash, files.length]);

    for (const filename of files) {
      try {
        const details = await readDetails(dataRoot, filename);
        if (details.repositoryName === "accounts") await ensureCustomer(client, details);
        await importOpportunity(client, details);
      } catch (error) {
        errors += 1;
        console.error(`PREPASS_ERROR ${path.relative(dataRoot, filename)} ${error.message}`);
      }
    }

    for (const filename of files) {
      try {
        const details = await readDetails(dataRoot, filename);
        await importRepositoryRecord(client, importRunId, details);
        await importProposal(client, details, revisionCounters);
        await importScopeVersion(client, details);
        await importSpecializedArtifact(client, details);
        imported += 1;
        if (imported % 100 === 0 || imported === files.length) {
          console.log(`MIGRATION_PROGRESS imported=${imported} total=${files.length}`);
        }
      } catch (error) {
        errors += 1;
        console.error(`IMPORT_ERROR ${path.relative(dataRoot, filename)} ${error.message}`);
      }
    }

    await client.query(`
      UPDATE hyperlinx.repository_import_runs
      SET status=$2, completed_at=clock_timestamp(), imported_file_count=$3, error_count=$4,
          details=jsonb_build_object('sourceManifestHash',$5::text)
      WHERE import_run_id=$1
    `, [importRunId, errors ? "FAILED" : "COMPLETED", imported, errors, sourceManifestHash]);
    console.log(JSON.stringify({ importRunId, dataRoot, sourceManifestHash, sourceFileCount: files.length, importedFileCount: imported, errorCount: errors }));
    if (errors) process.exitCode = 1;
  } finally {
    client.release();
    await closePostgresPools();
  }
}

await main();
