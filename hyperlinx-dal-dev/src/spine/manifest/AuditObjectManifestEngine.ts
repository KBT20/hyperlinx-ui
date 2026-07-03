import {
  AUDIT_OBJECT_MANIFEST_AUTHORITY,
  AUDIT_OBJECT_MANIFEST_VERSION,
  type AuditManifestReviewObject,
  type AuditObjectManifest,
  type AuditObjectManifestEntry,
  type AuditObjectManifestValidation,
  type AuditObjectManifestValidationIssue,
  type CreateAuditObjectManifestInput,
} from "./AuditObjectManifestContracts";
import type { SpineObjectCatalog, SpineObjectCatalogEntry } from "../catalog/SpineObjectCatalogContracts";
import { getSpineObjectCatalogEntry, validateSpineObjectHierarchy } from "../catalog/SpineObjectCatalogEngine";

type ManifestSeed = {
  objectType: string;
  expectedQuantity: number;
  expectedQuantityUnit: string;
  sourceAuditEntryIds?: string[];
  sourceQuantities?: string[];
  constructionMethods?: string[];
  expectedParentObjectType?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function auditId(entry: unknown, index: number) {
  const record = asRecord(entry);
  return asString(record.auditId ?? record.id ?? record.key, `AUDIT-${String(index + 1).padStart(4, "0")}`);
}

function auditLabel(entry: unknown) {
  const record = asRecord(entry);
  return asString(record.label ?? record.name ?? record.auditItem ?? record.formula ?? record.value, "").toUpperCase();
}

function auditQuantity(entry: unknown, fallback = 1) {
  const record = asRecord(entry);
  return asNumber(record.expectedQuantity ?? record.quantity ?? record.count ?? record.value, fallback);
}

function pushSeed(seeds: Map<string, ManifestSeed>, seed: ManifestSeed) {
  const key = seed.objectType.toUpperCase();
  const current = seeds.get(key);
  if (!current) {
    seeds.set(key, { ...seed, objectType: key, sourceAuditEntryIds: seed.sourceAuditEntryIds ?? [], sourceQuantities: seed.sourceQuantities ?? [], constructionMethods: seed.constructionMethods ?? [] });
    return;
  }
  current.expectedQuantity += seed.expectedQuantity;
  current.sourceAuditEntryIds = [...new Set([...(current.sourceAuditEntryIds ?? []), ...(seed.sourceAuditEntryIds ?? [])])];
  current.sourceQuantities = [...new Set([...(current.sourceQuantities ?? []), ...(seed.sourceQuantities ?? [])])];
  current.constructionMethods = [...new Set([...(current.constructionMethods ?? []), ...(seed.constructionMethods ?? [])])];
  current.expectedParentObjectType = current.expectedParentObjectType ?? seed.expectedParentObjectType;
}

function seedFromAuditEntry(entry: unknown, index: number): ManifestSeed | null {
  const label = auditLabel(entry);
  const id = auditId(entry, index);
  if (!label) return null;
  if (label.includes("HANDHOLE")) return { objectType: "HANDHOLE", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "each", sourceAuditEntryIds: [id] };
  if (label.includes("MANHOLE")) return { objectType: "MANHOLE", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "each", sourceAuditEntryIds: [id] };
  if (label.includes("VAULT")) return { objectType: "VAULT", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "each", sourceAuditEntryIds: [id] };
  if (label.includes("POP")) return { objectType: "POP", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "each", sourceAuditEntryIds: [id] };
  if (label.includes("REGEN")) return { objectType: "REGEN", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "each", sourceAuditEntryIds: [id] };
  if (label.includes("ILA")) return { objectType: "ILA", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "each", sourceAuditEntryIds: [id] };
  if (label.includes("SPLICE")) return { objectType: "SPLICE_CASE", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "each", sourceAuditEntryIds: [id], expectedParentObjectType: "HANDHOLE" };
  if (label.includes("CONDUIT") || label.includes("DUCT")) return { objectType: "CONDUIT", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "feet", sourceAuditEntryIds: [id], constructionMethods: ["INSTALL_CONDUIT"] };
  if (label.includes("FIBER")) return { objectType: "FIBER", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "feet", sourceAuditEntryIds: [id], constructionMethods: ["PLACE_FIBER"] };
  if (label.includes("PLOW")) return { objectType: "PLOW_SEGMENT", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "feet", sourceAuditEntryIds: [id], constructionMethods: ["PLOW"] };
  if (label.includes("BORE")) return { objectType: label.includes("ROCK") ? "ROCK_BORE_SEGMENT" : "DIRECTIONAL_BORE_SEGMENT", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "feet", sourceAuditEntryIds: [id], constructionMethods: ["DIRECTIONAL_BORE"] };
  if (label.includes("TRENCH")) return { objectType: "OPEN_TRENCH_SEGMENT", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "feet", sourceAuditEntryIds: [id], constructionMethods: ["OPEN_TRENCH"] };
  if (label.includes("RESTORATION")) return { objectType: "RESTORATION", expectedQuantity: auditQuantity(entry), expectedQuantityUnit: "feet", sourceAuditEntryIds: [id], constructionMethods: ["RESTORATION"] };
  return null;
}

function reviewObjectFromAuditEntry(packageId: string, entry: unknown, index: number): AuditManifestReviewObject | null {
  const label = auditLabel(entry);
  if (!label.includes("UNKNOWN") && !label.includes("REVIEW") && !label.includes("LOW CONFIDENCE")) return null;
  const id = auditId(entry, index);
  const blocking = label.includes("RAIL") || label.includes("ROCK") || label.includes("UTILITY") || label.includes("DOT") || label.includes("WATER");
  const objectType =
    label.includes("RAIL") ? "RAILROAD_CROSSING" :
      label.includes("RIVER") ? "RIVER_CROSSING" :
      label.includes("WATER") ? "WATER_CROSSING" :
        label.includes("DOT") || label.includes("HIGHWAY") ? "DOT_CROSSING" :
          label.includes("ROAD") ? "ROAD_CROSSING" :
            label.includes("BRIDGE") ? "BRIDGE" :
            label.includes("UTILITY") ? "UTILITY_CONFLICT" :
              label.includes("ENVIRONMENT") ? "ENVIRONMENTAL_IMPACT" :
                label.includes("ROCK") ? "ROCK_REVIEW" :
                  undefined;
  return {
    reviewObjectId: `${packageId}:AUDIT-MANIFEST-REVIEW:${id}`,
    packageId,
    reviewType: objectType ? "UNKNOWN_CONSTRAINT" : "UNKNOWN_COMMERCIAL_QUANTITY",
    label: asString(asRecord(entry).label, label || "Unknown commercial review item"),
    catalogEntryId: objectType ? `SPINE-CATALOG:${objectType}` : undefined,
    objectType,
    blocking,
    confidence: asNumber(asRecord(entry).confidence, blocking ? 40 : 65),
    commercialReason: asString(asRecord(entry).formula ?? asRecord(entry).reason, "Commercial audit item requires Engineering disposition."),
    engineeringDispositionRequired: true,
    sourceAuditEntryId: id,
    instantiationStatus: "NOT_INSTANTIATED_YET",
    createsObject: false,
    noScopeVersionCreation: true,
  };
}

function seedsFromQuantitySummary(quantitySummary: unknown) {
  const summary = asRecord(quantitySummary);
  const seeds: ManifestSeed[] = [];
  const routeFeet = asNumber(summary.routeFeet);
  const conduitFeet = asNumber(summary.conduitFeet);
  const fiberFeet = asNumber(summary.fiberFeet);
  const structureCount = asNumber(summary.structureCount);
  const crossingCount = asNumber(summary.crossingCount);
  if (routeFeet > 0) pushRouteSeeds(seeds, routeFeet);
  if (conduitFeet > 0) seeds.push({ objectType: "CONDUIT", expectedQuantity: conduitFeet, expectedQuantityUnit: "feet", sourceQuantities: ["quantitySummary.conduitFeet"], constructionMethods: ["INSTALL_CONDUIT"] });
  if (fiberFeet > 0) seeds.push({ objectType: "FIBER", expectedQuantity: fiberFeet, expectedQuantityUnit: "feet", sourceQuantities: ["quantitySummary.fiberFeet"], constructionMethods: ["PLACE_FIBER"] });
  if (structureCount > 0) seeds.push({ objectType: "HANDHOLE", expectedQuantity: structureCount, expectedQuantityUnit: "each", sourceQuantities: ["quantitySummary.structureCount"] });
  if (crossingCount > 0) seeds.push({ objectType: "RAILROAD_CROSSING", expectedQuantity: crossingCount, expectedQuantityUnit: "each", sourceQuantities: ["quantitySummary.crossingCount"] });
  return seeds;
}

function pushRouteSeeds(seeds: ManifestSeed[], routeFeet: number) {
  seeds.push({ objectType: "PLOW_SEGMENT", expectedQuantity: routeFeet, expectedQuantityUnit: "feet", sourceQuantities: ["quantitySummary.routeFeet"], constructionMethods: ["PLOW"] });
}

function compactCatalogEntry(entry: SpineObjectCatalogEntry) {
  return {
    catalogEntryId: entry.catalogEntryId,
    objectType: entry.objectType,
    displayName: entry.displayName,
    objectClass: entry.objectClass,
    addressType: entry.addressType,
  };
}

function createManifestEntry(packageId: string, catalog: SpineObjectCatalog, seed: ManifestSeed, index: number): AuditObjectManifestEntry | null {
  const catalogEntry = getSpineObjectCatalogEntry(catalog, seed.objectType);
  if (!catalogEntry) return null;
  const parent = seed.expectedParentObjectType ? getSpineObjectCatalogEntry(catalog, seed.expectedParentObjectType) : undefined;
  const hierarchyValid = parent ? validateSpineObjectHierarchy(catalog, parent.objectType, catalogEntry.objectType) : true;
  return {
    manifestEntryId: `${packageId}:AUDIT-MANIFEST:${String(index + 1).padStart(4, "0")}:${catalogEntry.objectType}`,
    packageId,
    catalogEntryId: catalogEntry.catalogEntryId,
    objectClass: catalogEntry.objectClass,
    objectType: catalogEntry.objectType,
    catalogEntry: compactCatalogEntry(catalogEntry),
    constitutionalRole: catalogEntry.constitutionalRole,
    catalogProfile: catalogEntry.profile,
    sourceAuditEntryIds: seed.sourceAuditEntryIds ?? [],
    sourceDoctrines: catalogEntry.requiredDoctrine,
    sourceQuantities: seed.sourceQuantities ?? [],
    expectedQuantity: Math.max(0, seed.expectedQuantity),
    expectedQuantityUnit: seed.expectedQuantityUnit,
    expectedHierarchy: {
      parentObjectClasses: catalogEntry.parentClasses,
      childObjectClasses: catalogEntry.childClasses,
      expectedParentObjectType: parent?.objectType,
      expectedChildObjectTypes: catalog.entries.filter((entry) => catalogEntry.childClasses.includes(entry.objectClass)).map((entry) => entry.objectType),
      hierarchyStatus: hierarchyValid ? "CATALOG_VALIDATED" : "REVIEW_REQUIRED",
    },
    placementStrategy: {
      addressType: catalogEntry.addressType,
      placementMethod: catalogEntry.defaultPlacementMethod,
      engineeringReview: catalogEntry.defaultEngineeringReview,
      stationingRequired: !["PACKAGE", "UNASSIGNED_REVIEW"].includes(catalogEntry.addressType),
      instantiationDeferred: true,
    },
    constructionMethods: seed.constructionMethods?.length ? seed.constructionMethods : [catalogEntry.defaultPlacementMethod],
    constructionMethodTemplates: catalogEntry.constructionMethods,
    placementStrategies: catalogEntry.placementStrategies,
    requiredEvidence: catalogEntry.requiredEvidence,
    defaultDependencies: catalogEntry.defaultDependencies,
    defaultExecutionSequence: catalogEntry.defaultExecutionSequence,
    dependencyTemplates: catalogEntry.dependencyTemplates,
    sequenceTemplates: catalogEntry.sequenceTemplates,
    evidenceTemplates: catalogEntry.evidenceTemplates,
    recommendationTemplates: catalogEntry.recommendationTemplates,
    paymentBehavior: catalogEntry.defaultPaymentBehavior,
    visibility: {
      commercial: catalogEntry.commercialVisibility,
      engineering: catalogEntry.engineeringVisibility,
      marketplace: catalogEntry.marketplaceVisibility,
      control: catalogEntry.controlVisibility,
      field: catalogEntry.fieldVisibility,
      operationalTwin: catalogEntry.operationalTwinVisibility,
      twin: catalogEntry.twinVisibility,
      lifecycleParticipation: catalogEntry.lifecycleParticipation,
    },
    commercialReviewStatus: catalogEntry.commercialVisibility === "VISIBLE" ? "VISIBLE" : "SUMMARY_ONLY",
    engineeringReviewStatus: catalogEntry.defaultEngineeringReview.includes("REQUIRED") ? "REQUIRED" : "OPTIONAL",
    instantiationStatus: "NOT_INSTANTIATED_YET",
    createsObject: false,
    noScopeVersionCreation: true,
  };
}

function validateManifest(catalog: SpineObjectCatalog, packageId: string, entries: AuditObjectManifestEntry[], reviewObjects: AuditManifestReviewObject[]): AuditObjectManifestValidation {
  const failures: AuditObjectManifestValidationIssue[] = [];
  const warnings: AuditObjectManifestValidationIssue[] = [];
  entries.forEach((entry) => {
    if (!catalog.byObjectType[entry.objectType]) failures.push({ issueId: `${entry.manifestEntryId}:CATALOG`, manifestEntryId: entry.manifestEntryId, severity: "FAIL", reason: "Manifest entry references missing catalog entry." });
    if (entry.expectedHierarchy.hierarchyStatus !== "CATALOG_VALIDATED") failures.push({ issueId: `${entry.manifestEntryId}:HIERARCHY`, manifestEntryId: entry.manifestEntryId, severity: "FAIL", reason: "Manifest entry hierarchy is not catalog legal." });
    if (!entry.paymentBehavior.validationRelationship) failures.push({ issueId: `${entry.manifestEntryId}:PAYMENT`, manifestEntryId: entry.manifestEntryId, severity: "FAIL", reason: "Manifest entry is missing payment validation relationship." });
    if (entry.createsObject !== false || entry.instantiationStatus !== "NOT_INSTANTIATED_YET") failures.push({ issueId: `${entry.manifestEntryId}:INSTANTIATION`, manifestEntryId: entry.manifestEntryId, severity: "FAIL", reason: "Audit Object Manifest must not instantiate objects in Sprint 24B." });
  });
  reviewObjects.forEach((reviewObject) => {
    if (reviewObject.blocking) warnings.push({ issueId: `${reviewObject.reviewObjectId}:BLOCKING-REVIEW`, reviewObjectId: reviewObject.reviewObjectId, severity: "WARNING", reason: "Blocking review object must receive Engineering disposition before certification." });
  });
  return {
    validationId: `${packageId}:AUDIT-OBJECT-MANIFEST:VALIDATION`,
    packageId,
    status: failures.length ? "FAIL" : warnings.length ? "WARNING" : "PASS",
    checkedManifestEntryCount: entries.length,
    checkedReviewObjectCount: reviewObjects.length,
    invalidCatalogReferenceCount: failures.filter((item) => item.issueId.includes("CATALOG")).length,
    illegalHierarchyCount: failures.filter((item) => item.issueId.includes("HIERARCHY")).length,
    missingPaymentRelationshipCount: failures.filter((item) => item.issueId.includes("PAYMENT")).length,
    blockingReviewObjectCount: reviewObjects.filter((item) => item.blocking).length,
    warnings,
    failures,
    authority: AUDIT_OBJECT_MANIFEST_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

export function createAuditObjectManifest(input: CreateAuditObjectManifestInput): AuditObjectManifest {
  const auditEntries = asArray(input.commercialAuditEntries);
  const seeds = new Map<string, ManifestSeed>();
  auditEntries.forEach((entry, index) => {
    const seed = seedFromAuditEntry(entry, index);
    if (seed) pushSeed(seeds, seed);
  });
  seedsFromQuantitySummary(input.quantitySummary).forEach((seed) => pushSeed(seeds, seed));
  const reviewObjects = auditEntries
    .map((entry, index) => reviewObjectFromAuditEntry(input.packageId, entry, index))
    .filter(Boolean) as AuditManifestReviewObject[];
  const entries = Array.from(seeds.values())
    .map((seed, index) => createManifestEntry(input.packageId, input.catalog, seed, index))
    .filter(Boolean) as AuditObjectManifestEntry[];
  const validation = validateManifest(input.catalog, input.packageId, entries, reviewObjects);
  const requiredCatalogEntryIds = [...new Set(entries.map((entry) => entry.catalogEntryId))];
  return {
    manifestId: `${input.packageId}:AUDIT-OBJECT-MANIFEST`,
    packageId: input.packageId,
    catalogId: input.catalog.catalogId,
    catalogVersion: input.catalog.catalogVersion,
    manifestVersion: AUDIT_OBJECT_MANIFEST_VERSION,
    authority: AUDIT_OBJECT_MANIFEST_AUTHORITY,
    source: "COMMERCIAL_AUDIT",
    sourceDoctrines: ["PD-001", "PD-002A", "PD-002B-PRECURSOR"],
    catalog: {
      catalogId: input.catalog.catalogId,
      catalogVersion: input.catalog.catalogVersion,
      authority: input.catalog.authority,
      summary: input.catalog.summary,
    },
    requiredCatalogEntryIds,
    entries,
    reviewObjects,
    validation,
    summary: {
      summaryId: `${input.packageId}:AUDIT-OBJECT-MANIFEST:SUMMARY`,
      packageId: input.packageId,
      catalogId: input.catalog.catalogId,
      catalogVersion: input.catalog.catalogVersion,
      manifestEntryCount: entries.length,
      reviewObjectCount: reviewObjects.length,
      blockingReviewObjectCount: reviewObjects.filter((item) => item.blocking).length,
      expectedPhysicalObjectTypeCount: entries.filter((entry) => entry.visibility.lifecycleParticipation === "EXECUTABLE").length,
      expectedRangeObjectTypeCount: entries.filter((entry) => entry.placementStrategy.addressType === "RANGE").length,
      expectedPointObjectTypeCount: entries.filter((entry) => entry.placementStrategy.addressType === "POINT").length,
      totalExpectedQuantity: entries.reduce((sum, entry) => sum + entry.expectedQuantity, 0),
      status: validation.status,
      instantiationStatus: "NOT_INSTANTIATED_YET",
      createsObjects: false,
      noScopeVersionCreation: true,
    },
    instantiationDeferredUntil: "SPRINT_24C",
    instantiationStatus: "NOT_INSTANTIATED_YET",
    createsObjects: false,
    noScopeVersionCreation: true,
  };
}
