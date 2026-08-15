import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { getApplicationPool, getMigrationPool, closePostgresPools } from "../server/persistence/postgres/client.js";

function argumentsFor(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith("--")) continue;
    result[argv[index].slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

async function loadEnvironment(filename) {
  const content = await readFile(filename, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0 || line.trimStart().startsWith("#")) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] === undefined) process.env[key] = line.slice(separator + 1).trim();
  }
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function expectDatabaseError(operation, acceptedCodes, label) {
  try {
    await operation();
  } catch (error) {
    assert.ok(acceptedCodes.includes(error.code), `${label}: unexpected SQLSTATE ${error.code}: ${error.message}`);
    return { label, status: "PASS", sqlstate: error.code, message: error.message };
  }
  assert.fail(`${label}: operation unexpectedly succeeded`);
}

function percentile(values, percent) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percent))];
}

async function measured(label, iterations, operation) {
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    await operation();
    samples.push(performance.now() - start);
  }
  return {
    label,
    iterations,
    minMs: Number(Math.min(...samples).toFixed(3)),
    p50Ms: Number(percentile(samples, 0.5).toFixed(3)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(3)),
    maxMs: Number(Math.max(...samples).toFixed(3)),
  };
}

async function main() {
  const args = argumentsFor(process.argv.slice(2));
  if (args["env-file"]) await loadEnvironment(args["env-file"]);
  const application = getApplicationPool();
  const migration = getMigrationPool();
  const runId = `cip058-${Date.now()}`;
  const ids = {
    organization: "org-teralinx",
    customer: `customer-${runId}`,
    opportunity: `opportunity-${runId}`,
    proposal: `proposal-${runId}`,
    proposalR1: `proposal-revision-${runId}-r1`,
    proposalR2: `proposal-revision-${runId}-r2`,
    proposalR3: `proposal-revision-${runId}-r3`,
    scope: `scope-version-${runId}`,
    redline: `redline-${runId}`,
    redlineRevision: `redline-revision-${runId}-r1`,
    object: `object-${runId}`,
    routePlace: `place-route-${runId}`,
    sitePlace: `place-site-${runId}`,
    artifact: `artifact-${runId}`,
  };
  const actors = {
    kyle: { principal: "teralinx-user-kyle", membership: "membership-teralinx-user-kyle" },
    ryan: { principal: "teralinx-user-ryan", membership: "membership-teralinx-user-ryan" },
    fran: { principal: "teralinx-user-fran", membership: "membership-teralinx-user-fran" },
    google: { principal: "google-participant-001", membership: "membership-google-participant-001" },
  };
  const report = { runId, tests: [], performance: [], lineage3swr: {}, dal1Gate: "PENDING" };

  try {
    const versions = await migration.query(`
      SELECT current_setting('server_version') AS postgres_version,
             postgis_full_version() AS postgis_version,
             current_setting('data_checksums') AS data_checksums,
             current_setting('listen_addresses') AS listen_addresses
    `);
    report.versions = versions.rows[0];
    assert.equal(report.versions.data_checksums, "on");
    assert.equal(report.versions.listen_addresses, "localhost");
    report.tests.push({ label: "PostgreSQL/PostGIS health and local binding", status: "PASS" });

    const roles = await migration.query(`
      SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication
      FROM pg_roles WHERE rolname IN ('hyperlinx_owner','hyperlinx_migrator','hyperlinx_app')
      ORDER BY rolname
    `);
    assert.equal(roles.rowCount, 3);
    assert.ok(roles.rows.every((role) => !role.rolsuper && !role.rolcreatedb && !role.rolcreaterole && !role.rolreplication));
    report.roles = roles.rows;
    report.tests.push({ label: "Least-privilege database identities", status: "PASS" });

    const importStatus = await migration.query(`
      SELECT status,source_file_count,imported_file_count,error_count
      FROM hyperlinx.repository_import_runs
      WHERE import_run_id='cip058-pre-migration-20260815T142927Z'
    `);
    assert.equal(importStatus.rows[0].status, "COMPLETED");
    assert.equal(Number(importStatus.rows[0].source_file_count), Number(importStatus.rows[0].imported_file_count));
    assert.equal(Number(importStatus.rows[0].error_count), 0);
    report.tests.push({ label: "Lossless repository import status", status: "PASS", ...importStatus.rows[0] });

    const identities = await application.query(`
      SELECT p.principal_id,m.membership_id,m.organization_id,
             array_agg(DISTINCT permission.permission_key ORDER BY permission.permission_key) AS permissions
      FROM hyperlinx.principals p
      JOIN hyperlinx.memberships m ON m.principal_id=p.principal_id
      JOIN hyperlinx.assignments assignment ON assignment.membership_id=m.membership_id
      JOIN hyperlinx.role_permissions rp ON rp.role_id=assignment.role_id
      JOIN hyperlinx.permissions permission ON permission.permission_id=rp.permission_id
      WHERE p.principal_id = ANY($1)
      GROUP BY p.principal_id,m.membership_id,m.organization_id
    `, [[actors.kyle.principal, actors.ryan.principal, actors.fran.principal]]);
    assert.equal(identities.rowCount, 3);
    assert.equal(new Set(identities.rows.map((row) => row.principal_id)).size, 3);
    report.principalAcceptance = identities.rows;
    report.tests.push({ label: "Three distinct principals and memberships", status: "PASS" });

    await migration.query(`
      INSERT INTO hyperlinx.organizations (organization_id,slug,name)
      VALUES ($1,$2,$3) ON CONFLICT DO NOTHING
    `, [`org-${runId}`, `org-${runId}`, `Isolation ${runId}`]);
    await migration.query(`
      INSERT INTO hyperlinx.principals (principal_id,subject,username,display_name)
      VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING
    `, [`principal-${runId}`, `test:${runId}`, `test-${runId}`, `Test ${runId}`]);
    await migration.query(`
      INSERT INTO hyperlinx.memberships (membership_id,organization_id,principal_id)
      VALUES ($1,$2,$3) ON CONFLICT DO NOTHING
    `, [`membership-${runId}`, `org-${runId}`, `principal-${runId}`]);

    const civilMixFixture = {
      civilMix: { plowPercent: 82, dirtPercent: 12, rockPercent: 0, trenchPercent: 6 },
      geometry: { geometryHash: "fixture-geometry-hash", routeRevision: "fixture-route-r1", coordinates: [[-97.1, 36.1], [-97.0, 36.2]] },
      engineering: { packageId: "fixture-engineering", status: "PRESERVED" },
      structuralIof: { objectCount: 4, integrity: "PRESERVED" },
      pricing: { nrc: 1000000, mrc: 25000, termMonths: 120, marginPercent: 30 },
    };
    await migration.query(`
      INSERT INTO hyperlinx.customers (customer_id,organization_id,name)
      VALUES ($1,$2,$3)
    `, [ids.customer, ids.organization, `Acceptance Customer ${runId}`]);
    await migration.query(`
      INSERT INTO hyperlinx.opportunities (
        opportunity_id,organization_id,customer_id,name,current_lifecycle_state,status,
        commercial_state,row_version,created_by
      ) VALUES ($1,$2,$3,$4,'PROPOSED','ACTIVE',$5,1,$6)
    `, [ids.opportunity, ids.organization, ids.customer, `Acceptance ${runId}`, civilMixFixture, actors.kyle.principal]);

    const saved = await application.query(`
      SELECT * FROM hyperlinx.save_opportunity_state(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )
    `, [
      ids.opportunity, ids.organization, ids.customer, `Acceptance ${runId}`, "Exact rehydration",
      { productId: "POINT_TO_POINT" }, "PROPOSED", "COMMERCIAL_ROUTE", "fixture-route-r1",
      "ACTIVE", civilMixFixture, 1, actors.ryan.principal, actors.ryan.membership, `save-${runId}`,
    ]);
    assert.equal(Number(saved.rows[0].row_version), 2);
    const rehydrated = await application.query(`SELECT commercial_state,row_version FROM hyperlinx.opportunities WHERE opportunity_id=$1`, [ids.opportunity]);
    assert.deepEqual(rehydrated.rows[0].commercial_state, civilMixFixture);
    report.tests.push({ label: "Opportunity exact save/reload", status: "PASS", rowVersion: 2 });

    const retry = await application.query(`
      SELECT row_version FROM hyperlinx.save_opportunity_state($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [
      ids.opportunity, ids.organization, ids.customer, `Acceptance ${runId}`, "Exact rehydration",
      { productId: "POINT_TO_POINT" }, "PROPOSED", "COMMERCIAL_ROUTE", "fixture-route-r1",
      "ACTIVE", civilMixFixture, 1, actors.ryan.principal, actors.ryan.membership, `save-${runId}`,
    ]);
    assert.equal(Number(retry.rows[0].row_version), 2);
    report.tests.push({ label: "Opportunity idempotent retry", status: "PASS" });
    report.tests.push(await expectDatabaseError(() => application.query(`
      SELECT * FROM hyperlinx.save_opportunity_state($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [ids.opportunity,ids.organization,ids.customer,"stale","",{},"PROPOSED",null,null,"ACTIVE",{},1,actors.ryan.principal,actors.ryan.membership,`stale-${runId}`]), ["40001"], "Stale opportunity write rejected"));
    report.tests.push(await expectDatabaseError(() => application.query(`
      SELECT * FROM hyperlinx.save_opportunity_state($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [ids.opportunity,ids.organization,ids.customer,"wrong org","",{},"PROPOSED",null,null,"ACTIVE",{},2,`principal-${runId}`,`membership-${runId}`,`wrong-org-${runId}`]), ["42501"], "Wrong organization/membership rejected"));
    report.tests.push(await expectDatabaseError(() => application.query(`
      SELECT * FROM hyperlinx.save_opportunity_state($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [ids.opportunity,ids.organization,ids.customer,"wrong permission","",{},"PROPOSED",null,null,"ACTIVE",{},2,actors.google.principal,actors.google.membership,`wrong-permission-${runId}`]), ["42501"], "Wrong permission rejected"));

    await migration.query(`INSERT INTO hyperlinx.proposals (proposal_id,opportunity_id,organization_id,created_by) VALUES ($1,$2,$3,$4)`, [ids.proposal,ids.opportunity,ids.organization,actors.ryan.principal]);
    await migration.query(`
      INSERT INTO hyperlinx.proposal_revisions (
        proposal_revision_id,proposal_id,opportunity_id,organization_id,revision_number,
        status,commercial_state,content_hash,created_by
      ) VALUES ($1,$2,$3,$4,1,'WORKING',$5,$6,$7)
    `, [ids.proposalR1,ids.proposal,ids.opportunity,ids.organization,civilMixFixture,hash(civilMixFixture),actors.ryan.principal]);
    await migration.query(`INSERT INTO hyperlinx.proposal_current_pointers (proposal_id,proposal_revision_id,pointer_version,updated_by) VALUES ($1,$2,1,$3)`, [ids.proposal,ids.proposalR1,actors.ryan.principal]);
    const clone = await application.query(`SELECT * FROM hyperlinx.clone_proposal_revision($1,$2,$3,$4,$5,$6)`, [ids.proposalR1,ids.proposalR2,1,actors.ryan.principal,actors.ryan.membership,`clone-r2-${runId}`]);
    assert.equal(clone.rows[0].parent_revision_id, ids.proposalR1);
    assert.deepEqual(clone.rows[0].commercial_state, civilMixFixture);
    assert.equal(clone.rows[0].content_hash, hash(civilMixFixture));
    await application.query(`SELECT * FROM hyperlinx.clone_proposal_revision($1,$2,$3,$4,$5,$6)`, [ids.proposalR1,ids.proposalR2,1,actors.ryan.principal,actors.ryan.membership,`clone-r2-${runId}`]);
    const cloneCount = await application.query(`SELECT count(*)::int AS count FROM hyperlinx.proposal_revisions WHERE proposal_id=$1`, [ids.proposal]);
    assert.equal(cloneCount.rows[0].count, 2);
    const branch = await application.query(`SELECT * FROM hyperlinx.clone_proposal_revision($1,$2,$3,$4,$5,$6)`, [ids.proposalR1,ids.proposalR3,2,actors.ryan.principal,actors.ryan.membership,`clone-r3-${runId}`]);
    assert.equal(branch.rows[0].parent_revision_id, ids.proposalR1);
    const noDiff = await application.query(`SELECT hyperlinx.proposal_revision_diff($1,$2) AS diff`, [ids.proposalR1,ids.proposalR2]);
    assert.deepEqual(noDiff.rows[0].diff, {});
    report.tests.push({ label: "Proposal exact clone, branch, diff, and idempotency", status: "PASS" });
    report.tests.push(await expectDatabaseError(() => application.query(`SELECT * FROM hyperlinx.clone_proposal_revision($1,$2,$3,$4,$5,$6)`, [ids.proposalR1,`${ids.proposal}-unauthorized`,3,actors.google.principal,actors.google.membership,`clone-denied-${runId}`]), ["42501"], "Unauthorized proposal clone rejected"));
    report.tests.push(await expectDatabaseError(() => migration.query(`UPDATE hyperlinx.proposal_revisions SET status='MUTATED' WHERE proposal_revision_id=$1`, [ids.proposalR1]), ["55000"], "Immutable proposal update rejected"));

    await migration.query(`
      INSERT INTO hyperlinx.scope_versions (
        scope_version_id,organization_id,customer_id,opportunity_id,proposal_revision_id,
        status,payload,content_hash,created_by
      ) VALUES ($1,$2,$3,$4,$5,'AUTHORIZED',$6,$7,$8)
    `, [ids.scope,ids.organization,ids.customer,ids.opportunity,ids.proposalR1,{ fixture: runId },hash({ fixture: runId }),actors.kyle.principal]);
    report.tests.push(await expectDatabaseError(() => migration.query(`
      INSERT INTO hyperlinx.redline_revisions (redline_revision_id,redline_id,scope_version_id,organization_id,revision_number,status,payload,content_hash)
      VALUES ($1,$2,NULL,$3,1,'AUTHORIZED','{}'::jsonb,$4)
    `, [`redline-no-scope-${runId}`,`redline-no-scope-${runId}`,ids.organization,hash({})]), ["23502"], "Redline without ScopeVersion rejected"));
    await migration.query(`
      INSERT INTO hyperlinx.redline_revisions (
        redline_revision_id,redline_id,scope_version_id,organization_id,revision_number,
        status,payload,content_hash,created_by
      ) VALUES ($1,$2,$3,$4,1,'AUTHORIZED',$5,$6,$7)
    `, [ids.redlineRevision,ids.redline,ids.scope,ids.organization,{ change: "fixture" },hash({ change: "fixture" }),actors.kyle.principal]);
    report.tests.push(await expectDatabaseError(() => migration.query(`UPDATE hyperlinx.redline_revisions SET status='EDITED' WHERE redline_revision_id=$1`, [ids.redlineRevision]), ["55000"], "Authorized Redline revision immutable"));

    await migration.query(`
      INSERT INTO hyperlinx.governed_artifacts (
        artifact_id,artifact_type,revision,organization_id,customer_id,opportunity_id,
        authority,status,payload,content_hash,created_by
      ) VALUES ($1,'ACCEPTANCE_ARTIFACT','1',$2,$3,$4,'CIP058_ACCEPTANCE','CERTIFIED',$5,$6,$7)
    `, [ids.artifact,ids.organization,ids.customer,ids.opportunity,{ fixture: runId },hash({ fixture: runId }),actors.kyle.principal]);
    report.tests.push(await expectDatabaseError(() => migration.query(`UPDATE hyperlinx.governed_artifacts SET status='ALTERED' WHERE artifact_id=$1`, [ids.artifact]), ["55000"], "Immutable governed artifact update rejected"));

    const append = (parameters) => application.query(`
      SELECT * FROM hyperlinx.append_governed_event(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      )
    `, parameters);
    const event1 = `event-${runId}-1`;
    const event2 = `event-${runId}-2`;
    const baseEvent = [event1,"FIELD_RELEASED",ids.organization,actors.kyle.principal,actors.kyle.membership,"OBJECT",ids.object,0,ids.scope,null,ids.object,"CONTROL","RELEASE",null,"RELEASED",{ placeId: ids.routePlace },"CONTROL_AUTHORITY",ids.scope,"1",hash({ fixture: runId }),null,new Date().toISOString(),{},`event-1-${runId}`];
    await append(baseEvent);
    const retryEvent = await append(baseEvent);
    assert.equal(retryEvent.rows[0].event_id, event1);
    report.tests.push(await expectDatabaseError(() => append([`event-stale-${runId}`,"FIELD_STARTED",ids.organization,actors.kyle.principal,actors.kyle.membership,"OBJECT",ids.object,0,ids.scope,null,ids.object,"FIELD","START","RELEASED","IN_PROGRESS",{},"FIELD_AUTHORITY",ids.scope,"1",hash({ fixture: runId }),event1,new Date().toISOString(),{},`event-stale-${runId}`]), ["40001"], "Stale event append rejected"));
    await append([event2,"FIELD_STARTED",ids.organization,actors.kyle.principal,actors.kyle.membership,"OBJECT",ids.object,1,ids.scope,null,ids.object,"FIELD","START","RELEASED","IN_PROGRESS",{},"FIELD_AUTHORITY",ids.scope,"1",hash({ fixture: runId }),event1,new Date().toISOString(),{},`event-2-${runId}`]);
    report.tests.push(await expectDatabaseError(() => append([`event-wrong-actor-${runId}`,"FIELD_CLOSE",ids.organization,`principal-${runId}`,`membership-${runId}`,"OBJECT",ids.object,2,ids.scope,null,ids.object,"FIELD","CLOSE","IN_PROGRESS","COMPLETED",{},"FIELD_AUTHORITY",ids.scope,"1",hash({}),event2,new Date().toISOString(),{},`event-wrong-actor-${runId}`]), ["42501"], "Wrong event actor rejected"));
    const concurrent = await Promise.allSettled([
      append([`event-${runId}-3a`,"FIELD_CLOSED",ids.organization,actors.kyle.principal,actors.kyle.membership,"OBJECT",ids.object,2,ids.scope,ids.redlineRevision,ids.object,"FIELD","CLOSE","IN_PROGRESS","COMPLETED",{},"FIELD_AUTHORITY",ids.scope,"1",hash({ fixture: "a" }),event2,new Date().toISOString(),{},`event-3a-${runId}`]),
      append([`event-${runId}-3b`,"FIELD_HELD",ids.organization,actors.kyle.principal,actors.kyle.membership,"OBJECT",ids.object,2,ids.scope,ids.redlineRevision,ids.object,"FIELD","HOLD","IN_PROGRESS","HOLD",{},"FIELD_AUTHORITY",ids.scope,"1",hash({ fixture: "b" }),event2,new Date().toISOString(),{},`event-3b-${runId}`]),
    ]);
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter((result) => result.status === "rejected" && result.reason.code === "40001").length, 1);
    const replay = await application.query(`SELECT * FROM hyperlinx.replay_integrity WHERE organization_id=$1 AND object_id=$2`, [ids.organization,ids.object]);
    assert.equal(replay.rows[0].integrity_ok, true);
    report.tests.push({ label: "Event append, idempotency, concurrency, current projection, replay", status: "PASS", finalVersion: Number(replay.rows[0].projection_version) });

    await application.query(`
      INSERT INTO hyperlinx.places (place_id,organization_id,place_type,name,geometry,properties)
      VALUES ($1,$2,'ROUTE','Acceptance Route',ST_GeomFromText('LINESTRING(-97.1 36.1,-97.0 36.2)',4326),$3),
             ($4,$2,'SITE','Acceptance Site',ST_GeomFromText('POINT(-97.05 36.15)',4326),$5)
    `, [ids.routePlace,ids.organization,{ stationStart: 0, stationEnd: 50000 },ids.sitePlace,{ facilityType: "ILA" }]);
    const spatial = await application.query(`
      SELECT count(*)::int AS count FROM hyperlinx.places
      WHERE organization_id=$1 AND geometry && ST_MakeEnvelope(-97.2,36.0,-96.9,36.3,4326)
    `, [ids.organization]);
    assert.ok(spatial.rows[0].count >= 2);
    report.tests.push({ label: "Generalized PostGIS Place and viewport query", status: "PASS", matchingPlaces: spatial.rows[0].count });

    const lineage = await migration.query(`
      SELECT repository_name,count(*)::int AS count
      FROM hyperlinx.repository_records
      WHERE opportunity_id ILIKE '%3SWR%'
         OR payload->>'opportunityId' ILIKE '%3SWR%'
         OR payload->>'scopeVersionId' ILIKE '%3SWR%'
         OR payload->>'proposalId' ILIKE '%3SWR%'
         OR payload->>'packageId' ILIKE '%3SWR%'
      GROUP BY repository_name ORDER BY repository_name
    `);
    report.lineage3swr = Object.fromEntries(lineage.rows.map((row) => [row.repository_name, row.count]));
    const required3swr = ["commercial-opportunities","proposal-drafts","commercial-routes","iof-packages","engineering-packages","engineering-approvals","certification-ledgers","certified-iof-packages","service-orders","scopeversions"];
    report.missing3swrAuthorities = required3swr.filter((repository) => !report.lineage3swr[repository]);
    report.tests.push({
      label: "3SWR lineage repository coverage",
      status: report.missing3swrAuthorities.length ? "BLOCKED" : "PASS",
      missing: report.missing3swrAuthorities,
    });

    report.performance.push(await measured("Opportunity lookup", 30, () => application.query(`SELECT opportunity_id,row_version FROM hyperlinx.opportunities WHERE opportunity_id=$1`, [ids.opportunity])));
    report.performance.push(await measured("Opportunity rehydration", 20, () => application.query(`SELECT commercial_state FROM hyperlinx.opportunities WHERE opportunity_id=$1`, [ids.opportunity])));
    report.performance.push(await measured("ScopeVersion lookup", 30, () => application.query(`SELECT scope_version_id,content_hash FROM hyperlinx.scope_versions WHERE scope_version_id=$1`, [ids.scope])));
    report.performance.push(await measured("Object current-state lookup", 30, () => application.query(`SELECT current_state,projection_version FROM hyperlinx.object_current_state WHERE organization_id=$1 AND object_id=$2`, [ids.organization,ids.object])));
    report.performance.push(await measured("Viewport spatial query", 30, () => application.query(`SELECT count(*) FROM hyperlinx.places WHERE organization_id=$1 AND geometry && ST_MakeEnvelope(-97.2,36.0,-96.9,36.3,4326)`, [ids.organization])));
    report.performance.push(await measured("Station/range property query", 30, () => application.query(`SELECT place_id FROM hyperlinx.places WHERE organization_id=$1 AND place_type='ROUTE' AND (properties->>'stationStart')::numeric <= 25000 AND (properties->>'stationEnd')::numeric >= 25000`, [ids.organization])));
    report.performance.push(await measured("Replay integrity", 30, () => application.query(`SELECT integrity_ok FROM hyperlinx.replay_integrity WHERE organization_id=$1 AND object_id=$2`, [ids.organization,ids.object])));
    report.performance.push(await measured("User authorization", 30, () => application.query(`
      SELECT EXISTS (
        SELECT 1 FROM hyperlinx.memberships membership
        JOIN hyperlinx.assignments assignment ON assignment.membership_id=membership.membership_id
        JOIN hyperlinx.role_permissions role_permission ON role_permission.role_id=assignment.role_id
        JOIN hyperlinx.permissions permission ON permission.permission_id=role_permission.permission_id
        WHERE membership.organization_id=$1 AND membership.principal_id=$2
          AND permission.permission_key IN ('opportunity.manage','platform.admin')
      ) AS authorized
    `, [ids.organization,actors.ryan.principal])));

    report.dal1Gate = report.missing3swrAuthorities.length ? "BLOCKED" : "PASS";
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await closePostgresPools();
  }
}

await main();
