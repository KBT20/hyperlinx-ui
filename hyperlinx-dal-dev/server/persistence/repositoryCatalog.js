import path from "node:path";

const REPOSITORY_CLASSIFICATIONS = Object.freeze({
  accounts: "AUTHORITY",
  contacts: "AUTHORITY",
  products: "AUTHORITY",
  "commercial-opportunities": "AUTHORITY",
  "commercial-routes": "IMMUTABLE_ARTIFACT",
  "commercial-revisions": "IMMUTABLE_ARTIFACT",
  "commercial-change-sets": "IMMUTABLE_ARTIFACT",
  "commercial-release-packages": "IMMUTABLE_ARTIFACT",
  "proposal-drafts": "WORKING_STATE",
  "customer-design-imports": "EVIDENCE_REFERENCE",
  "candidate-sites": "WORKING_STATE",
  "opportunity-seeds": "FIXTURE",
  "fulfillment-plans": "AUTHORITY",
  "iof-packages": "IMMUTABLE_ARTIFACT",
  "engineering-intakes": "EVIDENCE_REFERENCE",
  "engineering-drafts": "WORKING_STATE",
  "engineering-packages": "IMMUTABLE_ARTIFACT",
  "engineering-baselines": "IMMUTABLE_ARTIFACT",
  "engineering-change-sets": "IMMUTABLE_ARTIFACT",
  "engineering-approvals": "IMMUTABLE_ARTIFACT",
  "engineering-object-manifests": "IMMUTABLE_ARTIFACT",
  "station-projections": "CURRENT_PROJECTION",
  "station-graphs": "CURRENT_PROJECTION",
  "station-object-manifests": "IMMUTABLE_ARTIFACT",
  "measured-centerlines": "IMMUTABLE_ARTIFACT",
  "projected-object-manifests": "CURRENT_PROJECTION",
  "quantity-reconciliations": "IMMUTABLE_ARTIFACT",
  "product-doctrine-assemblies": "IMMUTABLE_ARTIFACT",
  "project-configurations": "IMMUTABLE_ARTIFACT",
  "certification-ledgers": "EVENT",
  "certified-iof-packages": "IMMUTABLE_ARTIFACT",
  "certified-routes": "IMMUTABLE_ARTIFACT",
  "execution-authorization-certificates": "IMMUTABLE_ARTIFACT",
  "service-orders": "IMMUTABLE_ARTIFACT",
  "customer-signatures": "IMMUTABLE_ARTIFACT",
  "teralinx-countersignatures": "IMMUTABLE_ARTIFACT",
  "commercial-authorization-transactions": "EVENT",
  scopeversions: "IMMUTABLE_ARTIFACT",
  "close-events": "EVENT",
  "closure-ledgers": "EVENT",
  "field-closures": "EVENT",
  "control-work-items": "WORKING_STATE",
  "marketplace-quotes": "WORKING_STATE",
  "marketplace-packages": "WORKING_STATE",
  "marketplace-responses": "WORKING_STATE",
  "marketplace-allocations": "IMMUTABLE_ARTIFACT",
  "marketplace-awards": "IMMUTABLE_ARTIFACT",
  "marketplace-observations": "EVIDENCE_REFERENCE",
  "inventory-graphs": "CURRENT_PROJECTION",
  "iof-package-twins": "CURRENT_PROJECTION",
  "runtime-workspaces": "WORKING_STATE",
  "runtime-workspace-sessions": "TEMPORARY",
  "runtime-objects": "CURRENT_PROJECTION",
  "runtime-relationships": "CURRENT_PROJECTION",
  "runtime-inventories": "CURRENT_PROJECTION",
  "runtime-evidence": "EVIDENCE_REFERENCE",
  "runtime-history": "EVENT",
  activity: "EVENT",
  "runtime-validation": "DIAGNOSTIC",
  "runtime-connectors": "DIAGNOSTIC",
  "translation-commits": "IMMUTABLE_ARTIFACT",
  "transaction-manifests": "DIAGNOSTIC",
});

export function repositoryNameForDirectory(directory) {
  return path.basename(directory);
}

export function classifyRepository(repositoryName, record = {}) {
  if (record?.initializedFromFixture === true || record?.fixture === true) return "FIXTURE";
  if (record?.immutable === true || record?.isImmutable === true || record?.repositoryTruthImmutable === true) {
    return "IMMUTABLE_ARTIFACT";
  }
  return REPOSITORY_CLASSIFICATIONS[repositoryName] ?? "UNKNOWN";
}

export function repositoryClassificationInventory() {
  return { ...REPOSITORY_CLASSIFICATIONS };
}

export function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

export function inferRecordId(record, fallback) {
  return firstText(
    record?.recordId,
    record?.artifactId,
    record?.opportunityId,
    record?.proposalRevisionId,
    record?.proposalRecordId,
    record?.proposalId,
    record?.routeRepositoryId,
    record?.packageId,
    record?.engineeringPackageId,
    record?.engineeringBaselineId,
    record?.engineeringApprovalId,
    record?.certificationLedgerId,
    record?.certifiedIofPackageId,
    record?.certifiedPackageId,
    record?.scopeVersionId,
    record?.serviceOrderId,
    record?.eventId,
    record?.objectId,
    fallback,
  );
}

export function repositoryMetadata(repositoryName, record, fallbackId = "") {
  return {
    recordId: inferRecordId(record, fallbackId),
    classification: classifyRepository(repositoryName, record),
    organizationId: firstText(record?.organizationId, record?.tenantId),
    customerId: firstText(record?.customerId, record?.accountId),
    opportunityId: firstText(record?.opportunityId),
    revision: firstText(record?.revision, record?.revisionId, record?.proposalRevision, record?.routeRevision, record?.version),
    parentId: firstText(record?.parentRevisionId, record?.parentId, record?.parentScopeVersionId),
    status: firstText(record?.status, record?.lifecycleState, record?.workflowStatus),
    isCurrent: typeof record?.isCurrent === "boolean" ? record.isCurrent : null,
    embeddedHash: firstText(
      record?.contentHash,
      record?.hash,
      record?.repositoryHash,
      record?.packageHash,
      record?.certifiedPackageHash,
      record?.certificationHash,
      record?.geometryHash,
    ),
  };
}
