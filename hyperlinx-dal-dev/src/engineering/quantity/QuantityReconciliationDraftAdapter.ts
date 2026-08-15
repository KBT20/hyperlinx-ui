import { createQuantityReconciliation } from "./QuantityReconciliationEngine";
import type {
  QuantityArtifactScope,
  QuantityEvidenceReference,
  QuantityReconciliation,
  QuantityReconciliationStatus,
} from "./QuantityReconciliationContracts";

type JsonObject = Record<string, unknown>;

function record(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

const QUANTITY_CLASS: Record<string, { objectClass: string; unit: string }> = {
  routeFeet: { objectClass: "SPINE", unit: "route-foot" },
  conduitFeet: { objectClass: "CONDUIT", unit: "conduit-foot" },
  fiberFeet: { objectClass: "FIBER", unit: "cable-foot" },
  handholeCount: { objectClass: "HANDHOLE", unit: "each" },
  spliceCaseCount: { objectClass: "SPLICE_CASE", unit: "each" },
  ILACount: { objectClass: "ILA_SITE", unit: "each" },
};

const DEFAULT_DERIVATIONS: Record<string, { method: string; formula: string; doctrineRule: string }> = {
  routeFeet: { method: "geodesic length of authoritative measured centerline", formula: "MEASURED_CENTERLINE_GEODESIC_LENGTH", doctrineRule: "route linear quantities derive from measured spine" },
  conduitFeet: { method: "measured route multiplied by configured conduit count", formula: "MEASURED_ROUTE_FEET × CONFIGURED_CONDUIT_COUNT", doctrineRule: "conduit quantity derives from route feet and configured duct count" },
  fiberFeet: { method: "measured route multiplied by placement/slack factor", formula: "MEASURED_ROUTE_FEET × PLACEMENT_FACTOR", doctrineRule: "fiber quantity includes configured placement/slack factor" },
  handholeCount: { method: "source-defined or Engineering-defined structure plan", formula: "APPROVED_STRUCTURE_PLAN", doctrineRule: "Product Doctrine requires a governed structure plan and does not invent structure quantities" },
  spliceCaseCount: { method: "Engineering splice architecture", formula: "ENGINEERING_SPLICE_ARCHITECTURE", doctrineRule: "splice cases derive from approved splice architecture" },
  ILACount: { method: "Engineering optical design", formula: "APPROVED_OPTICAL_DESIGN", doctrineRule: "ILA sites derive from optical design, not arbitrary distance" },
};

export function quantityScopeFromDraft(draft: JsonObject): QuantityArtifactScope {
  const product = record(draft.product);
  const doctrine = record(draft.doctrine);
  return {
    organizationId: text(draft.organizationId, "UNSCOPED_ORGANIZATION"),
    tenantId: text(draft.tenantId, text(draft.organizationId, "UNSCOPED_TENANT")),
    customerId: text(draft.customerId ?? draft.accountId, "UNSCOPED_CUSTOMER"),
    opportunityId: text(draft.opportunityId, "UNSCOPED_OPPORTUNITY"),
    packageId: text(draft.packageId ?? draft.referencePackageId, "UNSCOPED_PACKAGE"),
    productId: text(draft.productId ?? product.productId, "UNKNOWN_PRODUCT"),
    productVersion: text(draft.productVersion ?? product.productVersion, "UNKNOWN_PRODUCT_VERSION"),
    doctrineId: text(draft.doctrineId ?? doctrine.doctrineId, "UNKNOWN_DOCTRINE"),
    doctrineVersion: text(draft.doctrineVersion ?? draft.productDoctrineVersion ?? doctrine.doctrineVersion, "UNKNOWN_DOCTRINE_VERSION"),
  };
}

function sourceEvidence(draft: JsonObject, field: string, fallback: string): QuantityEvidenceReference[] {
  const workbookEvidence = record(draft.workbookEvidence);
  const normalizedValue = record(record(workbookEvidence.values)[field]);
  const provenance = record(normalizedValue.provenance);
  const sourceHash = text(provenance.sourceHash ?? workbookEvidence.sourceHash ?? draft.sourceHash);
  if (!sourceHash) return [];
  return [{
    evidenceRef: text(provenance.sourceLocation, fallback),
    sourceFile: text(provenance.sourceFile ?? workbookEvidence.sourceFile),
    worksheet: text(provenance.worksheet),
    sourceLocation: text(provenance.sourceLocation),
    sourceHash,
    sourceAuthority: text(provenance.sourceAuthority ?? workbookEvidence.sourceAuthority, "PROJECT_EVIDENCE"),
    authorityMode: text(provenance.authorityMode, "SOURCE_WORKBOOK"),
  }];
}

export function quantityReconciliationFromDraft(draftValue: unknown): QuantityReconciliation | null {
  const draft = record(draftValue);
  const raw = draft.quantityReconciliation;
  if (raw && !Array.isArray(raw) && Array.isArray(record(raw).items)) return raw as QuantityReconciliation;
  if (!Array.isArray(raw) || !raw.length) return null;
  const scope = quantityScopeFromDraft(draft);
  const product = record(draft.product);
  const quantityRules = Array.isArray(product.quantityRules) ? product.quantityRules.map(record) : [];
  return createQuantityReconciliation({
    scope,
    revisionId: text(draft.engineeringRevisionId ?? draft.packageRevision, `${scope.packageId}:REVISION:0`),
    sourceHash: text(draft.sourceHash ?? record(draft.workbookEvidence).sourceHash, "MISSING_SOURCE_HASH"),
    items: raw.map((value) => {
      const item = record(value);
      const normalizedField = text(item.normalizedField);
      const profile = QUANTITY_CLASS[normalizedField] ?? { objectClass: text(item.objectClass, "UNKNOWN"), unit: text(item.unit, "unit") };
      const fallbackDerivation = DEFAULT_DERIVATIONS[normalizedField] ?? { method: text(item.resolution, "Engineering derivation required"), formula: "ENGINEERING_DERIVATION_REQUIRED", doctrineRule: "Project quantity requires Engineering authority" };
      const productRule = quantityRules.find((rule) => text(rule.normalizedField) === normalizedField);
      return {
        objectClass: profile.objectClass,
        quantityType: normalizedField,
        unit: profile.unit,
        sourceQuantity: number(item.sourceValue),
        sourceAuthority: text(item.sourceAuthority, "PROJECT_EVIDENCE"),
        sourceEvidence: sourceEvidence(draft, normalizedField, text(item.sourceEvidence, `${scope.packageId}:${normalizedField}:SOURCE`)),
        derivedQuantity: number(item.doctrineValue ?? item.derivedValue),
        derivationMethod: text(item.derivationMethod, fallbackDerivation.method),
        derivationAuthority: normalizedField === "routeFeet" ? "MEASURED_GEOMETRY" : "PRODUCT_DOCTRINE_DERIVATION",
        derivationFormula: text(item.formula ?? productRule?.formula, fallbackDerivation.formula),
        doctrineRule: text(item.doctrineRule ?? productRule?.formula, fallbackDerivation.doctrineRule),
        geometryAuthority: normalizedField === "routeFeet" || ["conduitFeet", "fiberFeet", "handholeCount"].includes(normalizedField) ? "MEASURED_CENTERLINE" : undefined,
        status: text(item.status, "ENGINEERING_REVIEW_REQUIRED") as QuantityReconciliationStatus,
      };
    }),
  });
}
