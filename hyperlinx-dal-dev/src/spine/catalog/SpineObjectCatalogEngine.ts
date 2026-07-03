import {
  SPINE_OBJECT_CATALOG_AUTHORITY,
  SPINE_OBJECT_CATALOG_ID,
  SPINE_OBJECT_CATALOG_VERSION,
  type SpineObjectCatalog,
  type SpineObjectCatalogEntry,
  type SpineObjectCatalogValidation,
  type SpineObjectCatalogValidationIssue,
  type SpineObjectClass,
} from "./SpineObjectCatalogContracts";
import { SPINE_OBJECT_CATALOG_ENTRIES } from "./SpineObjectCatalog";
import { SPINE_OBJECT_CLASSES, classAllowsChild, classAllowsParent } from "./SpineObjectDoctrine";

function byClass(entries: SpineObjectCatalogEntry[]) {
  const grouped = Object.fromEntries(SPINE_OBJECT_CLASSES.map((objectClass) => [objectClass, [] as string[]])) as unknown as Record<SpineObjectClass, string[]>;
  entries.forEach((entry) => grouped[entry.objectClass].push(entry.objectType));
  return grouped;
}

function issue(issueId: string, severity: "FAIL" | "WARNING", reason: string, entry?: SpineObjectCatalogEntry): SpineObjectCatalogValidationIssue {
  return {
    issueId,
    catalogEntryId: entry?.catalogEntryId,
    objectType: entry?.objectType,
    severity,
    reason,
  };
}

export function validateSpineObjectCatalog(entries: SpineObjectCatalogEntry[], catalogId = SPINE_OBJECT_CATALOG_ID): SpineObjectCatalogValidation {
  const failures: SpineObjectCatalogValidationIssue[] = [];
  const warnings: SpineObjectCatalogValidationIssue[] = [];
  const seen = new Set<string>();

  entries.forEach((entry) => {
    if (seen.has(entry.objectType)) failures.push(issue(`CATALOG-DUPLICATE:${entry.objectType}`, "FAIL", "Duplicate object type in Spine Object Catalog.", entry));
    seen.add(entry.objectType);
    if (!entry.requiredDoctrine.length) failures.push(issue(`CATALOG-DOCTRINE:${entry.objectType}`, "FAIL", "Catalog entry is missing required doctrine.", entry));
    if (!entry.requiredEvidence.length) failures.push(issue(`CATALOG-EVIDENCE:${entry.objectType}`, "FAIL", "Catalog entry is missing required evidence.", entry));
    if (!entry.defaultExecutionSequence.length) failures.push(issue(`CATALOG-SEQUENCE:${entry.objectType}`, "FAIL", "Catalog entry is missing default execution sequence.", entry));
    if (!entry.defaultPaymentBehavior.validationRelationship) failures.push(issue(`CATALOG-PAYMENT:${entry.objectType}`, "FAIL", "Catalog entry is missing payment validation relationship.", entry));
    if (!entry.profile?.identity || !entry.profile.constitutionalRole) failures.push(issue(`CATALOG-PROFILE:${entry.objectType}`, "FAIL", "Catalog entry is missing Spine Object Profile.", entry));
    if (!entry.constitutionalRole || !entry.constitutionalRoles?.length) failures.push(issue(`CATALOG-ROLE:${entry.objectType}`, "FAIL", "Catalog entry is missing constitutional role.", entry));
    if (!entry.doctrine?.workspaceDuplicationProhibited) failures.push(issue(`CATALOG-DOCTRINE-MODEL:${entry.objectType}`, "FAIL", "Catalog entry is missing Spine Object Doctrine model.", entry));
    if (!entry.constructionMethods?.length) failures.push(issue(`CATALOG-CONSTRUCTION:${entry.objectType}`, "FAIL", "Catalog entry is missing construction methods.", entry));
    if (!entry.placementStrategies?.length) failures.push(issue(`CATALOG-PLACEMENT:${entry.objectType}`, "FAIL", "Catalog entry is missing placement strategy.", entry));
    if (!entry.hierarchy?.illegalHierarchyFailsValidation) failures.push(issue(`CATALOG-HIERARCHY:${entry.objectType}`, "FAIL", "Catalog entry is missing hierarchy model.", entry));
    if (!entry.dependencyTemplates?.templates?.length) failures.push(issue(`CATALOG-DEPENDENCY-TEMPLATE:${entry.objectType}`, "FAIL", "Catalog entry is missing dependency template model.", entry));
    if (!entry.sequenceTemplates?.templates?.length) failures.push(issue(`CATALOG-SEQUENCE-TEMPLATE:${entry.objectType}`, "FAIL", "Catalog entry is missing sequence template model.", entry));
    if (!entry.evidenceTemplates?.requiredEvidence?.length) failures.push(issue(`CATALOG-EVIDENCE-TEMPLATE:${entry.objectType}`, "FAIL", "Catalog entry is missing evidence template model.", entry));
    if (!entry.visibilityProfile?.commercial || !entry.visibilityProfile.operationalTwin) failures.push(issue(`CATALOG-VISIBILITY:${entry.objectType}`, "FAIL", "Catalog entry is missing visibility profile.", entry));
    if (!entry.recommendationTemplates?.length) failures.push(issue(`CATALOG-RECOMMENDATION:${entry.objectType}`, "FAIL", "Catalog entry is missing deterministic recommendation template.", entry));
    if (entry.constructionParticipation === "PARTICIPATES" && !entry.productionProfileIds?.length) failures.push(issue(`CATALOG-PRODUCTION-PROFILE:${entry.objectType}`, "FAIL", "Producible catalog entry is missing PD-003 production profile reference.", entry));
    entry.parentClasses.forEach((parentClass) => {
      if (!SPINE_OBJECT_CLASSES.includes(parentClass) || !classAllowsParent(entry.objectClass, parentClass)) {
        failures.push(issue(`CATALOG-ILLEGAL-PARENT:${entry.objectType}:${parentClass}`, "FAIL", `Illegal parent class ${parentClass} for ${entry.objectClass}.`, entry));
      }
    });
    entry.childClasses.forEach((childClass) => {
      if (!SPINE_OBJECT_CLASSES.includes(childClass) || !classAllowsChild(entry.objectClass, childClass)) {
        failures.push(issue(`CATALOG-ILLEGAL-CHILD:${entry.objectType}:${childClass}`, "FAIL", `Illegal child class ${childClass} for ${entry.objectClass}.`, entry));
      }
    });
    if (entry.addressType === "UNASSIGNED_REVIEW" && entry.reviewClassification === "STANDARD") {
      warnings.push(issue(`CATALOG-REVIEW:${entry.objectType}`, "WARNING", "Unassigned review entry should carry review classification.", entry));
    }
  });

  const representedClasses = new Set(entries.map((entry) => entry.objectClass));
  SPINE_OBJECT_CLASSES.forEach((objectClass) => {
    if (!representedClasses.has(objectClass)) failures.push(issue(`CATALOG-MISSING-CLASS:${objectClass}`, "FAIL", `Catalog is missing object class ${objectClass}.`));
  });

  return {
    validationId: `${catalogId}:VALIDATION`,
    catalogId,
    catalogVersion: SPINE_OBJECT_CATALOG_VERSION,
    status: failures.length ? "FAIL" : warnings.length ? "WARNING" : "PASS",
    checkedEntryCount: entries.length,
    checkedClassCount: representedClasses.size,
    illegalHierarchyCount: failures.filter((item) => item.issueId.includes("ILLEGAL")).length,
    missingDoctrineCount: failures.filter((item) => item.issueId.includes("DOCTRINE")).length,
    missingEvidenceCount: failures.filter((item) => item.issueId.includes("EVIDENCE")).length,
    missingSequenceCount: failures.filter((item) => item.issueId.includes("SEQUENCE")).length,
    warnings,
    failures,
    authority: SPINE_OBJECT_CATALOG_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

export function buildSpineObjectCatalog(generatedAt = "2026-07-01T00:00:00.000Z"): SpineObjectCatalog {
  const entries = SPINE_OBJECT_CATALOG_ENTRIES;
  const byObjectType = Object.fromEntries(entries.map((entry) => [entry.objectType, entry])) as Record<string, SpineObjectCatalogEntry>;
  const validation = validateSpineObjectCatalog(entries);
  const grouped = byClass(entries);
  return {
    catalogId: SPINE_OBJECT_CATALOG_ID,
    catalogVersion: SPINE_OBJECT_CATALOG_VERSION,
    doctrineId: "PD-002B-PRECURSOR",
    authority: SPINE_OBJECT_CATALOG_AUTHORITY,
    generatedAt,
    entries,
    byObjectType,
    byClass: grouped,
    validation,
    summary: {
      catalogId: SPINE_OBJECT_CATALOG_ID,
      catalogVersion: SPINE_OBJECT_CATALOG_VERSION,
      catalogEntryCount: entries.length,
      objectClasses: SPINE_OBJECT_CLASSES,
      pointAddressCount: entries.filter((entry) => entry.addressType === "POINT").length,
      rangeAddressCount: entries.filter((entry) => entry.addressType === "RANGE").length,
      inheritedAddressCount: entries.filter((entry) => entry.addressType === "INHERITED").length,
      reviewObjectCount: entries.filter((entry) => entry.addressType === "UNASSIGNED_REVIEW").length,
      executableObjectCount: entries.filter((entry) => entry.lifecycleParticipation === "EXECUTABLE").length,
      authorityObjectCount: entries.filter((entry) => entry.objectClass === "AUTHORITY").length,
      profileCount: entries.filter((entry) => Boolean(entry.profile)).length,
      recommendationTemplateCount: entries.reduce((sum, entry) => sum + entry.recommendationTemplates.length, 0),
      productionProfileReferenceCount: entries.reduce((sum, entry) => sum + entry.productionProfileIds.length + entry.materialProfileIds.length, 0),
      instantiationStatus: "CATALOG_ONLY",
      noObjectsInstantiated: true,
      noScopeVersionCreation: true,
    },
    instantiationStatus: "CATALOG_ONLY",
    createsObjects: false,
    noScopeVersionCreation: true,
  };
}

export function getSpineObjectCatalogEntry(catalog: SpineObjectCatalog, objectType: string) {
  return catalog.byObjectType[String(objectType).toUpperCase()];
}

export function validateSpineObjectHierarchy(catalog: SpineObjectCatalog, parentObjectType: string, childObjectType: string) {
  const parent = getSpineObjectCatalogEntry(catalog, parentObjectType);
  const child = getSpineObjectCatalogEntry(catalog, childObjectType);
  if (!parent || !child) return false;
  return parent.childClasses.includes(child.objectClass) && child.parentClasses.includes(parent.objectClass);
}
