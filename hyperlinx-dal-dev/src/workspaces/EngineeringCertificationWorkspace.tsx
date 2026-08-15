import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addEngineeringCertificationConstraint,
  approveEngineeringRevision,
  certifyDraftIofPackage,
  certifyIofUnit,
  createEngineeringCertificationRouteRedline,
  dispositionEngineeringCertificationConstraint,
  getEngineeringApprovalStatus,
  listCertifiedIofPackages,
  listEngineeringReviewQueue,
  moveEngineeringCertificationObject,
  openCertifiedIofPackage,
  openDraftIofPackageForCertification,
  recordEngineeringDoctrineException,
  returnDraftIofPackageToCommercial,
  type CertifiedIofPackageRuntime,
  type DraftIofPackageRuntime,
  type EngineeringPackageRuntime,
  type EngineeringApprovalRuntime,
  type EngineeringApprovalEligibilityRuntime,
  type EngineeringReviewQueueItem,
  TeralinxRuntimeRequestError,
} from "../api/teralinxRuntime";
import { useDALState } from "../dal/DALState";
import {
  buildEngineeringCertificationChecklist,
  canMoveEngineeringObjectToStation,
  engineeringCertificationReady,
  type EngineeringConstraintCategory,
} from "../engineering/EngineeringCertificationProjection";
import {
  buildEngineeringRevisionProjection,
  createEngineeringPatch,
  engineeringChangeSetFromPatches,
  type EngineeringChangeSet,
  type EngineeringPatch,
  type EngineeringPatchType,
  type EngineeringPatchValue,
  type EngineeringRevisionProjection,
} from "../engineeringChangeSet";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import {
  MapKernel,
  renderSharedOpportunityMapProjection,
  sharedOpportunityMapProjectionFromDraft,
} from "../mapkernel";
import ConstitutionalAssemblyReviewPanel, { evaluateConstitutionalAssemblyReview, type ConstitutionalAssemblyFocus } from "../components/commercial/ConstitutionalAssemblyReviewPanel";
import { EngineeringQuantityReconciliationPanel } from "../components/engineering/EngineeringQuantityReconciliationPanel";
import { SpineObjectCatalogPanel } from "../components/engineering/SpineObjectCatalogPanel";
import { quantityReconciliationFromDraft, quantityReconciliationRepository, type QuantityReconciliation } from "../engineering/quantity";
import { engineeringFailureAuthorityProjection } from "../engineering/EngineeringFailureAuthority";
import { scheduleEngineeringProjection } from "../runtime/ConstitutionalAssemblyScheduler";
import { EngineeringChangeSetRepository } from "../repositories/commercialRepositories";

type EngineeringDisciplineLens = "SALES_ENGINEER" | "OSP" | "FIBER" | "SUPPLY_CHAIN" | "FINAL_ENGINEERING";
type EngineeringReviewSelection = { kind: string; id: string } | null;
type EngineeringReviewSurface = "MAP" | "BUDGET" | "QUANTITIES" | "CONSTITUTIONAL" | "COMPLIANCE" | "CONDITIONS" | "FINAL";
type EngineeringApprovalState = "ACTION REQUIRED" | "READY TO APPROVE" | "APPROVED" | "RESOLVED" | "BLOCKED" | "INFORMATIONAL";
type EngineeringApprovalItem = {
  id: string;
  title: string;
  description: string;
  nextResult: string;
  state: EngineeringApprovalState;
  affectedCount: number;
  humanActionRequired: boolean;
  blocker: boolean;
  actionLabel: string;
  actionTarget: EngineeringReviewSurface;
  sourceGate: string;
};
type EngineeringApprovalFailure = {
  code: string;
  message: string;
  failedPredicate: string;
  expectedValue: unknown;
  actualValue: unknown;
  sourceAuthority: string;
};
type EngineeringConditionClassification =
  | "ROW" | "Railroad" | "Water" | "Road Crossing" | "Environmental" | "Utility Conflict"
  | "Constructability" | "Access" | "Permitting" | "Power" | "Facility Placement"
  | "Fiber / Cable" | "Splicing" | "ILA / Regeneration" | "Customer Site" | "Quantity"
  | "Cost / Budget" | "Doctrine Exception" | "Route" | "Other";
type EngineeringConditionHumanSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "BLOCKING";

const ENGINEERING_CONDITION_CLASSIFICATIONS: EngineeringConditionClassification[] = [
  "ROW", "Railroad", "Water", "Road Crossing", "Environmental", "Utility Conflict", "Constructability",
  "Access", "Permitting", "Power", "Facility Placement", "Fiber / Cable", "Splicing", "ILA / Regeneration",
  "Customer Site", "Quantity", "Cost / Budget", "Doctrine Exception", "Route", "Other",
];

const CONDITION_CONSTRAINT_CATEGORY: Record<EngineeringConditionClassification, EngineeringConstraintCategory> = {
  ROW: "ROW",
  Railroad: "railroad",
  Water: "water crossing",
  "Road Crossing": "DOT / highway",
  Environmental: "environmental",
  "Utility Conflict": "utility conflict",
  Constructability: "rock / geology",
  Access: "ROW",
  Permitting: "permit jurisdiction",
  Power: "power availability",
  "Facility Placement": "ROW",
  "Fiber / Cable": "utility conflict",
  Splicing: "utility conflict",
  "ILA / Regeneration": "power availability",
  "Customer Site": "customer requested change",
  Quantity: "customer requested change",
  "Cost / Budget": "customer requested change",
  "Doctrine Exception": "customer requested change",
  Route: "ROW",
  Other: "ROW",
};

type ManualStationPlan = {
  stationPlanId: string;
  draftIofPackageId: string;
  opportunityId: string;
  routeRepositoryId: string;
  stationIntervalFeet: number;
  routeLengthFeet: number;
  generatedBy: string;
  generatedAt: string;
  status: "GENERATED" | "CERTIFIED";
  stations: Array<{
    stationId: string;
    label: string;
    stationFeet: number;
    milepost: number;
    coordinate?: unknown;
  }>;
  objectAssignments: Array<{
    objectId: string;
    objectType: string;
    stationId: string;
    stationLabel: string;
    stationRange: string;
    assignmentMethod: "REPOSITORY_STATION_PROJECTION" | "MANUAL_CERTIFICATION_DEFAULT";
  }>;
  noScopeVersionCreation: true;
};

type EngineeringBudgetRow = {
  objectId: string;
  objectType: string;
  stationReference: string;
  stationRange: string;
  commercialBudget: number;
  engineeringApprovedBudget: number;
  confirmed: boolean;
  notes: string;
};

type EngineeringProjection = ReturnType<typeof scheduleEngineeringProjection>;

type EngineeringProjectionValidationWarning = {
  warningId: string;
  severity: "WARNING";
  title: string;
  objectId: string;
  layer: string;
  field: string;
  message: string;
  detail: string;
};

type EngineeringProjectionFailure = {
  title: "Projection Validation Failure";
  message: string;
  stack?: string;
};

type EngineeringReadinessCheck = {
  key: string;
  label: string;
  status: string;
  id?: string;
  required?: boolean;
  detail?: string;
  repositoryPath?: string;
};

type EngineeringReadinessReport = {
  status: string;
  checks: EngineeringReadinessCheck[];
  warnings: EngineeringReadinessCheck[];
  readyForProjection: boolean;
  readyForStationPlanning: boolean;
  readyForCertification: boolean;
};

type EngineeringProjectionBoundaryProps = {
  resetKey: string;
  children: ReactNode;
};

type EngineeringProjectionBoundaryState = {
  error: Error | null;
};

class EngineeringProjectionErrorBoundary extends Component<EngineeringProjectionBoundaryProps, EngineeringProjectionBoundaryState> {
  state: EngineeringProjectionBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): EngineeringProjectionBoundaryState {
    return { error };
  }

  componentDidUpdate(previousProps: EngineeringProjectionBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <section className="dal-panel engineering-certification-projection-failure">
          <div className="dal-panel-title-row">
            <div>
              <h3>Projection Validation Failure</h3>
              <span>Repository state remains intact. Review diagnostics and continue from the Engineering Package.</span>
            </div>
            <span className="dal-badge warning">WARNING</span>
          </div>
          <div className="dal-status">{this.state.error.message}</div>
        </section>
      );
    }
    return this.props.children;
  }
}

const DISCIPLINE_LENSES: Array<{ key: EngineeringDisciplineLens; label: string; detail: string }> = [
  { key: "SALES_ENGINEER", label: "Sales Engineer", detail: "Commercial assumptions, customer commitment readiness, and proposal traceability." },
  { key: "OSP", label: "OSP", detail: "Civil constructability, route redlines, crossings, and station-range blockers." },
  { key: "FIBER", label: "Fiber", detail: "Fiber segments, splice expectations, ILA/regen placement, and dependency continuity." },
  { key: "SUPPLY_CHAIN", label: "Supply Chain", detail: "Billable unit availability, long-lead facilities, and material constraints." },
  { key: "FINAL_ENGINEERING", label: "Final Engineering", detail: "Constitutional assembly, object addressing, close sequence, and evidence readiness." },
];

function percent(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)}%` : "n/a";
}

function money(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "$0";
}

function feet(value: number | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString()} ft`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numeric(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return "";
}

function stringList(value: unknown): string[] {
  return asArray(value).map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function readinessCheck(key: string, label: string, ok: boolean, detail: string, options: Partial<EngineeringReadinessCheck> = {}): EngineeringReadinessCheck {
  return {
    key,
    label,
    status: ok ? "PASS" : options.required ? "FAIL" : "WARNING",
    detail,
    ...options,
  };
}

function serverRepositoryChecks(draft: DraftIofPackageRuntime | null): EngineeringReadinessCheck[] {
  const report = asRecord((draft as Record<string, unknown> | null)?.engineeringRepositoryValidation);
  return asArray(report.checks)
    .map((item) => asRecord(item))
    .filter((item) => firstText(item.key, item.label))
    .map((item) => ({
      key: firstText(item.key, item.label),
      label: firstText(item.label, item.key),
      status: firstText(item.status, "WARNING"),
      id: firstText(item.id),
      required: Boolean(item.required),
      detail: firstText(item.detail),
      repositoryPath: firstText(item.repositoryPath),
    }));
}

function rawProjectionObjectsForValidation(draft: DraftIofPackageRuntime, projection: EngineeringProjection): Record<string, unknown>[] {
  const loose = draft as Record<string, unknown>;
  const candidates = [
    loose.objects,
    draft.proposedIofUnits,
    loose.spineObjectCatalogEntries,
    loose.auditObjectManifestEntries,
  ];
  const firstCollection = candidates.map(asArray).find((collection) => collection.length);
  if (firstCollection?.length) return firstCollection.map(asRecord);
  return projection.objects.map((object) => asRecord(object.raw));
}

function validateEngineeringProjectionObjects(draft: DraftIofPackageRuntime, projection: EngineeringProjection): EngineeringProjectionValidationWarning[] {
  return rawProjectionObjectsForValidation(draft, projection).flatMap((record, index) => {
    const metadata = asRecord(record.metadata);
    const objectId = firstText(
      record.objectId,
      record.unitId,
      record.iofUnitId,
      record.runtimeObjectId,
      record.sourceRuntimeObjectId,
      record.id,
      projection.objects[index]?.objectId,
      `OBJECT-${String(index + 1).padStart(5, "0")}`,
    );
    const objectType = firstText(
      metadata.structureType,
      metadata.objectType,
      record.structureType,
      record.unitType,
      record.objectType,
      record.type,
      record.classification,
    );
    const layer = firstText(
      record.layer,
      record.layerId,
      record.sourceLayer,
      metadata.layer,
      metadata.layerId,
      metadata.sourceLayer,
      "Undefined",
    );
    const warnings: EngineeringProjectionValidationWarning[] = [];
    if (!objectType) {
      warnings.push({
        warningId: `PROJECTION-WARNING-${objectId}-OBJECT-TYPE`,
        severity: "WARNING",
        title: "Missing Object Type",
        objectId,
        layer,
        field: "objectType",
        message: `Missing Object Type. Object: ${objectId}. Layer: ${layer}. Continuing certification.`,
        detail: "Projection substituted a deterministic engineering object type so the workspace can continue.",
      });
    }
    if (layer === "Undefined") {
      warnings.push({
        warningId: `PROJECTION-WARNING-${objectId}-LAYER`,
        severity: "WARNING",
        title: "Missing Object Layer",
        objectId,
        layer,
        field: "layer",
        message: `Missing Object Layer. Object: ${objectId}. Layer: Undefined. Continuing certification.`,
        detail: "Layer metadata is missing from the source object; certification remains repository-backed.",
      });
    }
    return warnings;
  });
}

function projectionWarningsFromProjector(projection: EngineeringProjection): EngineeringProjectionValidationWarning[] {
  return asArray((projection as unknown as Record<string, unknown>).projectionValidationWarnings)
    .map((warning) => asRecord(warning))
    .filter((warning) => firstText(warning.warningId, warning.propertyPath, warning.message))
    .map((warning, index) => ({
      warningId: firstText(warning.warningId, `PROJECTOR-WARNING-${index + 1}`),
      severity: "WARNING",
      title: "Projection Validation",
      objectId: firstText(warning.objectId, "Package"),
      layer: firstText(warning.layer, "Engineering Projection"),
      field: firstText(warning.missingField, warning.propertyPath, "unknown"),
      message: firstText(warning.message, "Projection completed with validation warnings."),
      detail: `Default applied: ${firstText(warning.defaultApplied, "UNKNOWN")}`,
    }));
}

function uniqueProjectionWarnings(warnings: EngineeringProjectionValidationWarning[]) {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    if (seen.has(warning.warningId)) return false;
    seen.add(warning.warningId);
    return true;
  });
}

function safeScheduleEngineeringProjection(draft: DraftIofPackageRuntime): {
  projection: EngineeringProjection | null;
  warnings: EngineeringProjectionValidationWarning[];
  failure: EngineeringProjectionFailure | null;
} {
  try {
    const projection = scheduleEngineeringProjection(draft);
    return {
      projection,
      warnings: uniqueProjectionWarnings([
        ...projectionWarningsFromProjector(projection),
        ...validateEngineeringProjectionObjects(draft, projection),
      ]),
      failure: null,
    };
  } catch (error) {
    return {
      projection: null,
      warnings: [],
      failure: {
        title: "Projection Validation Failure",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

function buildEngineeringReadinessReport(
  draft: DraftIofPackageRuntime | null,
  engineeringPackage: EngineeringPackageRuntime | null,
  projection: EngineeringProjection | null,
  projectionWarnings: EngineeringProjectionValidationWarning[],
  projectionFailure: EngineeringProjectionFailure | null,
  certificationReady: boolean,
): EngineeringReadinessReport {
  const serverChecks = serverRepositoryChecks(draft);
  const packageId = draft?.packageId ?? engineeringPackage?.draftIOFPackageId ?? "";
  const routeRepositoryId = routeRepositoryIdForDraft(draft) || engineeringPackage?.routeRepositoryId || "";
  const fallbackChecks = [
    readinessCheck("engineeringPackage", "Engineering Package", Boolean(engineeringPackage?.engineeringPackageId), "Engineering Package must restore from Engineering Repository.", { id: engineeringPackage?.engineeringPackageId, required: true }),
    readinessCheck("engineeringBaseline", "Engineering Baseline", Boolean(engineeringPackage?.engineeringBaselineId && engineeringPackage?.engineeringBaselineHash), "Immutable Engineering Baseline must restore before Engineering projection.", { id: engineeringPackage?.engineeringBaselineId, required: true }),
    readinessCheck("draftIofPackage", "Draft IOF Package", Boolean(packageId), "Draft IOF Package reference must resolve before projection.", { id: packageId, required: true }),
    readinessCheck("proposal", "Proposal", Boolean(engineeringPackage?.proposalId ?? draft?.proposalId), "Proposal reference must resolve from repository data.", { id: engineeringPackage?.proposalId ?? draft?.proposalId, required: true }),
    readinessCheck("workbook", "Workbook", Boolean(engineeringPackage?.commercialWorkbookId ?? (draft as Record<string, unknown> | null)?.commercialWorkbookId), "Workbook reference must resolve without rebuilding.", { id: engineeringPackage?.commercialWorkbookId ?? String((draft as Record<string, unknown> | null)?.commercialWorkbookId ?? ""), required: true }),
    readinessCheck("estimate", "Estimate", Boolean(engineeringPackage?.estimateId ?? (draft as Record<string, unknown> | null)?.estimateId), "Estimate reference must resolve without recalculation.", { id: engineeringPackage?.estimateId ?? String((draft as Record<string, unknown> | null)?.estimateId ?? ""), required: true }),
    readinessCheck("routeRepository", "Route Repository", Boolean(routeRepositoryId), "Route Repository reference must resolve before map projection.", { id: routeRepositoryId, required: true }),
  ];
  const baseChecks = serverChecks.length ? serverChecks : fallbackChecks;
  const projectionChecks = [
    readinessCheck("objectValidation", "Object Validation", !projectionFailure && projectionWarnings.length === 0, projectionWarnings.length ? `${projectionWarnings.length.toLocaleString()} projection warning(s). Continuing certification.` : "Projection object fields validated.", { required: false }),
    readinessCheck("repositoryIntegrity", "Repository Integrity", baseChecks.every((check) => !check.required || check.status === "PASS"), "Required Engineering Repository references are resolved before projection.", { required: true }),
    readinessCheck("baselineGraph", "Baseline Graph", true, "/api/baseline-graphs is optional; unavailable baseline graph service does not block Engineering Certification.", { required: false, status: "PASS" }),
    readinessCheck("reasoning", "Reasoning", true, "Reasoning OFFLINE. Using deterministic doctrine.", { required: false, status: "WARNING" }),
  ];
  const requiredChecks = [...baseChecks, ...projectionChecks].filter((check) => check.required);
  const readyForProjection = Boolean(draft && !projectionFailure && requiredChecks.every((check) => check.status === "PASS"));
  const readyForStationPlanning = Boolean(readyForProjection && projection);
  const checks = [
    ...baseChecks,
    ...projectionChecks,
    readinessCheck("readyForStationPlanning", "Ready for Station Review", readyForStationPlanning, readyForStationPlanning ? "Ready for Station Review." : "Station Review is locked until repository validation and projection pass.", { required: false }),
    readinessCheck("readyForCertification", "Ready for Certification", certificationReady, certificationReady ? "Ready for Certification." : "Certification remains locked until manual Engineering gates pass.", { required: false }),
  ];
  return {
    status: checks.some((check) => check.status === "FAIL") ? "FAIL" : checks.some((check) => check.status === "WARNING") ? "WARNING" : "PASS",
    checks,
    warnings: checks.filter((check) => check.status !== "PASS"),
    readyForProjection,
    readyForStationPlanning,
    readyForCertification: certificationReady,
  };
}

function routeRepositoryIdForDraft(draft: DraftIofPackageRuntime | null) {
  if (!draft) return "";
  const loose = draft as Record<string, unknown>;
  return String(
    loose.routeRepositoryId ??
      asRecord(loose.routeRepositoryRef).routeRepositoryId ??
      asRecord(loose.routeRepositorySnapshot).routeRepositoryId ??
      asRecord(loose.commercialDraftSnapshot).routeRepositoryId ??
      asRecord(draft.proposalSummary).routeRepositoryId ??
      "",
  );
}

function engineeringPackageForDraft(draft: DraftIofPackageRuntime | null): EngineeringPackageRuntime | null {
  return (draft?.engineeringPackage && typeof draft.engineeringPackage === "object" ? draft.engineeringPackage : null) as EngineeringPackageRuntime | null;
}

function engineeringRevisionReferenceForDraft(draft: DraftIofPackageRuntime | null, engineeringPackage: EngineeringPackageRuntime | null) {
  const draftRecord = asRecord(draft);
  const packageRecord = asRecord(engineeringPackage);
  const engineeringBaselineId = firstText(packageRecord.engineeringBaselineId, draftRecord.engineeringBaselineId);
  const engineeringBaselineHash = firstText(packageRecord.engineeringBaselineHash, draftRecord.engineeringBaselineHash);
  const engineeringPackageId = firstText(packageRecord.engineeringPackageId, draftRecord.engineeringPackageId);
  const draftIOFPackageId = firstText(packageRecord.draftIOFPackageId, packageRecord.draftIofPackageId, draft?.packageId);
  return {
    engineeringBaselineId,
    engineeringBaselineHash,
    engineeringPackageId,
    engineeringRevisionId: firstText(packageRecord.engineeringRevisionId, draftRecord.engineeringRevisionId, engineeringPackageId ? `ENG-REV-${engineeringPackageId}-000` : ""),
    draftIOFPackageId,
    draftIofPackageId: draftIOFPackageId,
    opportunityId: firstText(packageRecord.opportunityId, draft?.opportunityId),
    routeRepositoryId: firstText(packageRecord.routeRepositoryId, routeRepositoryIdForDraft(draft)),
    proposalId: firstText(packageRecord.proposalId, draft?.proposalId),
    estimateId: firstText(packageRecord.estimateId, draftRecord.estimateId),
    workbookId: firstText(packageRecord.workbookId, packageRecord.commercialWorkbookId, draftRecord.workbookId, draftRecord.commercialWorkbookId),
    stationProjectionId: firstText(packageRecord.engineeringBaselineProjectionId, packageRecord.stationGraphId, draftRecord.stationGraphId),
    objectManifestId: firstText(packageRecord.projectedObjectManifestId, packageRecord.stationObjectManifestId, draftRecord.projectedObjectManifestId, draftRecord.stationObjectManifestId),
  };
}

function queueEngineeringPackageId(item: EngineeringReviewQueueItem | DraftIofPackageRuntime) {
  return String((item as EngineeringReviewQueueItem).engineeringPackageId ?? (item as DraftIofPackageRuntime).engineeringPackageId ?? item.packageId);
}

function draftPricingSummary(draft: DraftIofPackageRuntime | null) {
  if (!draft) return {};
  const loose = draft as Record<string, unknown>;
  const commercialSummary = asRecord(draft.commercialSummary);
  return asRecord(
    loose.pricingSummary ??
      commercialSummary.pricingSummary ??
      loose.commercialEstimate ??
      commercialSummary.estimate ??
      loose.estimate,
  );
}

function draftEstimatedCost(draft: DraftIofPackageRuntime | null) {
  const pricing = draftPricingSummary(draft);
  return numeric(pricing.totalCost ?? pricing.constructionCost ?? pricing.ospCost ?? pricing.cost);
}

function draftRevenue(draft: DraftIofPackageRuntime | null) {
  const pricing = draftPricingSummary(draft);
  return numeric(pricing.revenue ?? pricing.nrcRevenue ?? pricing.sellPriceIru ?? pricing.totalRevenue);
}

function draftMargin(draft: DraftIofPackageRuntime | null) {
  const pricing = draftPricingSummary(draft);
  const explicit = numeric(pricing.margin ?? pricing.grossMargin, Number.NaN);
  if (Number.isFinite(explicit)) return explicit;
  return draftRevenue(draft) - draftEstimatedCost(draft);
}

function commercialBudgetForObject(object: { raw: Record<string, unknown>; quantityImpact: string }) {
  const raw = object.raw;
  const metadata = asRecord(raw.metadata);
  const explicit = [
    raw.engineeringApprovedBudget,
    raw.commercialBudget,
    raw.estimatedCost,
    raw.totalCost,
    raw.cost,
    raw.extendedCost,
    metadata.engineeringApprovedBudget,
    metadata.commercialBudget,
    metadata.estimatedCost,
    metadata.totalCost,
    metadata.cost,
  ].map((value) => numeric(value, Number.NaN)).find(Number.isFinite);
  if (explicit !== undefined) return Math.max(0, explicit);
  const quantity = numeric(raw.quantity ?? raw.commercialQuantity ?? raw.engineeringQuantity ?? object.quantityImpact, 1);
  const unitCost = numeric(raw.unitCost ?? metadata.unitCost ?? raw.rate ?? metadata.rate, 0);
  if (unitCost > 0) return Math.max(0, quantity * unitCost);
  return Math.max(1000, quantity * 1000);
}

function coordinateLabel(coordinate: unknown) {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return "n/a";
  const lon = Number(coordinate[0]);
  const lat = Number(coordinate[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return "n/a";
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

function statusClass(status: string) {
  if (status === "PASS" || status === "complete" || status === "RESOLVED" || status === "ACCEPTED") return "pass";
  if (status === "FAIL" || status === "CRITICAL") return "fail";
  if (status === "active") return "green";
  return "warning";
}

function EngineeringReadinessReportPanel({
  report,
  projectionWarnings,
  projectionFailure,
}: {
  report: EngineeringReadinessReport;
  projectionWarnings: EngineeringProjectionValidationWarning[];
  projectionFailure: EngineeringProjectionFailure | null;
}) {
  return (
    <section className="dal-panel engineering-certification-readiness-report">
      <div className="dal-panel-title-row">
        <div>
          <h3>Engineering Readiness</h3>
          <span>Repository validation and projection diagnostics. Missing object fields warn and continue.</span>
        </div>
        <span className={`dal-badge ${statusClass(report.status)}`}>{report.status}</span>
      </div>
      <div className="teralinx-summary-grid compact">
        {report.checks.map((check, index) => (
          <div key={`${check.key}:${check.id ?? "no-id"}:${index}`}>
            <span>{check.label}</span>
            <b className={`dal-badge ${statusClass(check.status)}`}>{check.status}</b>
            <small>{check.id ? `${check.id}. ` : ""}{check.detail}</small>
          </div>
        ))}
      </div>
      {projectionFailure ? (
        <div className="dal-status warning">
          Projection Validation Failure. {projectionFailure.message}
        </div>
      ) : null}
      <div className="engineering-certification-list">
        {projectionWarnings.map((warning) => (
          <div key={warning.warningId}>
            <b>{warning.title}</b>
            <span className="dal-badge warning">{warning.severity}</span>
            <small>Object: {warning.objectId}</small>
            <small>Layer: {warning.layer}</small>
            <small>{warning.message}</small>
          </div>
        ))}
        {!projectionWarnings.length ? <div className="dal-status">Projection validation warnings: none.</div> : null}
      </div>
      <div className="dal-status">Reasoning OFFLINE. Using deterministic doctrine.</div>
    </section>
  );
}

const DOCTRINE_PROJECTION_DIAGNOSTIC_GATES = [
  "Math Present",
  "Objects Calculated",
  "Addresses Assigned",
  "Objects Projected",
];

function DoctrineProjectionDiagnosticsPanel({ projection }: { projection: EngineeringProjection }) {
  const projectionRecord = projection as unknown as Record<string, unknown>;
  const draft = asRecord(projectionRecord.sourceDraftPackage);
  const projectedObjectManifest = asRecord(draft.projectedObjectManifest);
  const diagnostics = asRecord(
    projectionRecord.doctrineProjectionDiagnostics ??
      draft.doctrineProjectionDiagnostics ??
      projectedObjectManifest.doctrineProjectionDiagnostics,
  );
  const objectTypes = asArray(diagnostics.objectTypes).map(asRecord);
  const failedGates = asArray(diagnostics.failedGates).map(asRecord);
  if (!firstText(diagnostics.diagnosticsId)) {
    return (
      <section className="dal-panel engineering-certification-readiness-report">
        <div className="dal-panel-title-row">
          <div>
            <h3>Doctrine Projection Diagnostics</h3>
            <span>Projection math diagnostics are required for certification.</span>
          </div>
          <span className="dal-badge fail">MISSING</span>
        </div>
        <div className="dal-status warning">Projection ID missing. Draft IOF must be reassembled or resubmitted through the Doctrine Projection Engine.</div>
      </section>
    );
  }
  return (
    <section className="dal-panel engineering-certification-readiness-report">
      <div className="dal-panel-title-row">
        <div>
          <h3>Doctrine Projection Diagnostics</h3>
          <span>Run the math, look at the spine, address the objects, place them.</span>
        </div>
        <span className={`dal-badge ${statusClass(firstText(diagnostics.status, "FAIL"))}`}>{firstText(diagnostics.status, "FAIL")}</span>
      </div>
      <div className="teralinx-summary-grid compact">
        <div><span>Route Length</span><b>{feet(numeric(diagnostics.routeFeet))}</b></div>
        <div><span>Station Count</span><b>{numeric(diagnostics.stationCount).toLocaleString()}</b></div>
        <div><span>Doctrine Objects</span><b>{numeric(diagnostics.expectedObjectCount).toLocaleString()}</b></div>
        <div><span>Objects Projected</span><b>{numeric(diagnostics.projectedObjectCount).toLocaleString()}</b></div>
        <div><span>Derived Spans</span><b>{numeric(diagnostics.derivedSpanCount).toLocaleString()}</b></div>
        <div><span>Linear Attachments</span><b>{numeric(diagnostics.linearAssetAttachmentCount).toLocaleString()}</b></div>
      </div>
      {failedGates.length ? (
        <div className="dal-status warning">
          {failedGates.map((gate) => `${firstText(gate.objectType, "UNKNOWN")} ${firstText(gate.gate, "Gate")}: ${firstText(gate.reason, "unknown reason")}`).join("; ")}
        </div>
      ) : (
        <div className="dal-status">Projection math gates: PASS.</div>
      )}
      <div className="engineering-certification-list">
        <div className="dal-status">Diagnostic gates: {DOCTRINE_PROJECTION_DIAGNOSTIC_GATES.join(" / ")}</div>
        {objectTypes.map((item) => {
          const gates = asArray(item.gates).map(asRecord);
          const coordinates = asArray(item.resolvedCoordinates).map(asRecord);
          return (
            <div key={firstText(item.objectType, "UNKNOWN")}>
              <b>{firstText(item.objectType, "Unknown Object Type")}</b>
              <span className={`dal-badge ${statusClass(firstText(item.projectionResult, "FAIL"))}`}>{firstText(item.projectionResult, "FAIL")}</span>
              <small>Doctrine quantity source: {firstText(item.doctrineQuantitySource, "missing doctrine quantity")}</small>
              <small>Route Length: {feet(numeric(item.routeFeet))}</small>
              <small>Station Count: {numeric(item.stationCount).toLocaleString()}</small>
              <small>Object Count: {numeric(item.objectCount).toLocaleString()}</small>
              <small>Nominal Interval: {feet(numeric(item.nominalIntervalFeet))}</small>
              <small>Placement Authority: {firstText(item.placementAuthority, "UNKNOWN")}</small>
              <small>Calculated Stations: {stringList(item.calculatedStations).join(", ") || "none"}</small>
              <small>
                Resolved Coordinates: {coordinates.map((coordinate) => (
                  `${firstText(coordinate.objectId)} ${firstText(coordinate.stationAddress)} ${numeric(coordinate.latitude).toFixed(6)}, ${numeric(coordinate.longitude).toFixed(6)}`
                )).join("; ") || "none"}
              </small>
              <div className="teralinx-summary-grid compact">
                {gates.map((gate) => (
                  <div key={`${firstText(item.objectType)}:${firstText(gate.gate)}`}>
                    <span>{firstText(gate.gate, "Gate")}</span>
                    <b className={`dal-badge ${statusClass(firstText(gate.status, "FAIL"))}`}>{firstText(gate.status, "FAIL")}</b>
                    <small>{firstText(gate.reason, "unknown reason")}</small>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GeometryAuthorityDiagnosticsPanel({ projection }: { projection: EngineeringProjection }) {
  const projectionRecord = projection as unknown as Record<string, unknown>;
  const draft = asRecord(projectionRecord.sourceDraftPackage);
  const projectedObjectManifest = asRecord(draft.projectedObjectManifest);
  const doctrineDiagnostics = asRecord(
    projectionRecord.doctrineProjectionDiagnostics ??
      draft.doctrineProjectionDiagnostics ??
      projectedObjectManifest.doctrineProjectionDiagnostics,
  );
  const diagnostics = asRecord(
    draft.geometryAuthorityDiagnostics ??
      projectedObjectManifest.geometryAuthorityDiagnostics ??
      doctrineDiagnostics.geometryAuthorityDiagnostics,
  );
  const status = firstText(diagnostics.geometryAuthority, diagnostics.status, "MISSING");
  return (
    <section className="dal-panel engineering-certification-readiness-report" data-geometry-authority-diagnostics="visible">
      <div className="dal-panel-title-row">
        <div>
          <h3>Geometry Authority</h3>
          <span>Single measured centerline authority for Engineering projection.</span>
        </div>
        <span className={`dal-badge ${statusClass(status)}`}>{status}</span>
      </div>
      <div className="teralinx-summary-grid compact">
        <div><span>Measured Centerline</span><b>{firstText(diagnostics.measuredCenterlineId, "missing")}</b></div>
        <div><span>Independent Geometry</span><b>{numeric(diagnostics.independentGeometryCount).toLocaleString()}</b></div>
        <div><span>Projected Objects</span><b>{numeric(diagnostics.projectedObjectCount).toLocaleString()}</b></div>
        <div><span>Projected Spans</span><b>{numeric(diagnostics.projectedSpanCount).toLocaleString()}</b></div>
        <div><span>Objects On Spine</span><b>{numeric(diagnostics.objectsOnSpine).toLocaleString()} / {numeric(diagnostics.objectsOnSpineTotal).toLocaleString()}</b></div>
        <div><span>Maximum Drift</span><b>{numeric(diagnostics.maximumDriftFeet).toFixed(2)} ft</b></div>
        <div><span>Independent Span Geometry</span><b>{numeric(diagnostics.independentSpanGeometryCount).toLocaleString()}</b></div>
        <div><span>Commercial</span><b>{firstText(diagnostics.commercialRenderValidation, "PENDING")}</b></div>
        <div><span>Engineering</span><b>{firstText(diagnostics.engineeringRenderValidation, "PENDING")}</b></div>
        <div><span>Field</span><b>{firstText(diagnostics.fieldRenderValidation, "PENDING")}</b></div>
        <div><span>Twin</span><b>{firstText(diagnostics.twinRenderValidation, "PENDING")}</b></div>
      </div>
      {asArray(diagnostics.failures).length ? (
        <div className="dal-status warning">{asArray(diagnostics.failures).map((failure) => String(failure)).join("; ")}</div>
      ) : (
        <div className="dal-status">Geometry drift: 0.00 ft. Independent span geometry: 0.</div>
      )}
    </section>
  );
}


function selectedStationLabel(draft: DraftIofPackageRuntime | null) {
  const first = draft?.stations?.[0] as Record<string, unknown> | undefined;
  return String(first?.stationId ?? first?.label ?? "");
}

function buildManualStationPlan(
  draft: DraftIofPackageRuntime,
  projection: ReturnType<typeof scheduleEngineeringProjection>,
  reviewer: string,
): ManualStationPlan {
  const routeRepositoryId = routeRepositoryIdForDraft(draft);
  const generatedAt = new Date().toISOString();
  return {
    stationPlanId: `STATION-PLAN-${draft.packageId}`,
    draftIofPackageId: draft.packageId,
    opportunityId: draft.opportunityId,
    routeRepositoryId,
    stationIntervalFeet: 5280,
    routeLengthFeet: projection.routeLength,
    generatedBy: reviewer,
    generatedAt,
    status: "GENERATED",
    stations: projection.stations.map((station) => ({
      stationId: station.stationId,
      label: station.label,
      stationFeet: station.stationFeet,
      milepost: station.milepost,
      coordinate: station.coordinate,
    })),
    objectAssignments: projection.objects.map((object, index) => {
      const station = object.station
        ? projection.stations.find((item) => item.stationId === object.station || item.label === object.station)
        : projection.stations[Math.min(projection.stations.length - 1, Math.max(0, index))];
      return {
        objectId: object.objectId,
        objectType: object.objectType,
        stationId: station?.stationId ?? object.station ?? "",
        stationLabel: station?.label ?? object.station ?? "Station pending",
        stationRange: object.stationRange || "",
        assignmentMethod: "REPOSITORY_STATION_PROJECTION",
      };
    }),
    noScopeVersionCreation: true,
  };
}

function buildEngineeringBudgetRows(
  projection: ReturnType<typeof scheduleEngineeringProjection>,
  previousRows: EngineeringBudgetRow[] = [],
): EngineeringBudgetRow[] {
  const previousById = new Map(previousRows.map((row) => [row.objectId, row]));
  return projection.objects.map((object) => {
    const previous = previousById.get(object.objectId);
    const commercialBudget = commercialBudgetForObject(object);
    return {
      objectId: object.objectId,
      objectType: object.objectType,
      stationReference: object.station || "",
      stationRange: object.stationRange || "",
      commercialBudget,
      engineeringApprovedBudget: previous?.engineeringApprovedBudget ?? commercialBudget,
      confirmed: previous?.confirmed ?? false,
      notes: previous?.notes ?? "",
    };
  });
}

export default function EngineeringCertificationWorkspace() {
  const {
    selectedEngineeringDraftIofPackage,
    selectedEngineeringDraftIofPackageId,
    setSelectedEngineeringDraftIofPackage,
    setSelectedEngineeringDraftIofPackageId,
    setWorkspace,
  } = useDALState();
  const { session, can } = useTeralinxAuth();
  const canRead = Boolean(session && (can("workspace.engineering.read") || can("workspace.engineering.write") || can("scopeversion.authority")));
  const canWrite = Boolean(session && (can("workspace.engineering.write") || can("scopeversion.authority")));
  const currentUserName = session?.user.name ?? "Engineering";

  const [queue, setQueue] = useState<EngineeringReviewQueueItem[]>([]);
  const [activeDraft, setActiveDraft] = useState<DraftIofPackageRuntime | null>(selectedEngineeringDraftIofPackage);
  const [activeEngineeringPackage, setActiveEngineeringPackage] = useState<EngineeringPackageRuntime | null>(engineeringPackageForDraft(selectedEngineeringDraftIofPackage));
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [reviewSelection, setReviewSelection] = useState<EngineeringReviewSelection>(null);
  const [activeReviewSurface, setActiveReviewSurface] = useState<EngineeringReviewSurface>("MAP");
  const [focusFeatureId, setFocusFeatureId] = useState("");
  const [disciplineLens, setDisciplineLens] = useState<EngineeringDisciplineLens>("FINAL_ENGINEERING");
  const [notice, setNotice] = useState("Engineering Certification consumes an Engineering Baseline and Engineering Package.");
  const [pending, setPending] = useState(false);
  const [certifiedPackages, setCertifiedPackages] = useState<CertifiedIofPackageRuntime[]>([]);
  const [activeCertifiedPackage, setActiveCertifiedPackage] = useState<CertifiedIofPackageRuntime | null>(null);
  const [activeEngineeringApproval, setActiveEngineeringApproval] = useState<EngineeringApprovalRuntime | null>(null);
  const [approvalEligibility, setApprovalEligibility] = useState<EngineeringApprovalEligibilityRuntime | null>(null);
  const [approvalFailure, setApprovalFailure] = useState<EngineeringApprovalFailure | null>(null);
  const [approvalConfirmOpen, setApprovalConfirmOpen] = useState(false);
  const [manualStationPlan, setManualStationPlan] = useState<ManualStationPlan | null>(null);
  const [engineeringBudgetRows, setEngineeringBudgetRows] = useState<EngineeringBudgetRow[]>([]);
  const [engineeringBudgetApproved, setEngineeringBudgetApproved] = useState(false);
  const [engineeringChangeSetHistory, setEngineeringChangeSetHistory] = useState<EngineeringChangeSet[]>([]);
  const [engineeringChangeSetNotice, setEngineeringChangeSetNotice] = useState("Engineering Revision mirrors Baseline. No Engineering Change Set patches are active.");

  const [constraintNotes, setConstraintNotes] = useState("");
  const [conditionTitle, setConditionTitle] = useState("");
  const [conditionClassification, setConditionClassification] = useState<EngineeringConditionClassification>("Constructability");
  const [conditionSeverity, setConditionSeverity] = useState<EngineeringConditionHumanSeverity>("MEDIUM");
  const [conditionDispositionReason, setConditionDispositionReason] = useState("");
  const [conditionImpactSummary, setConditionImpactSummary] = useState("");

  const [moveStation, setMoveStation] = useState("");
  const [moveReason, setMoveReason] = useState("Power availability");
  const [moveAuthority, setMoveAuthority] = useState(currentUserName);

  const [redlineReason, setRedlineReason] = useState("Constructability redline");
  const [redlineDescription, setRedlineDescription] = useState("");

  const [exceptionRule, setExceptionRule] = useState("PD-001 spacing rule");
  const [exceptionCondition, setExceptionCondition] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionImpact, setExceptionImpact] = useState("");

  const [certificationNotes, setCertificationNotes] = useState("Engineering Certification complete.");
  const [commercialRevisionReason, setCommercialRevisionReason] = useState("Engineering requests Commercial revision.");

  const projectionResult = useMemo(
    () => activeDraft ? safeScheduleEngineeringProjection(activeDraft) : { projection: null, warnings: [], failure: null },
    [activeDraft],
  );
  const projection = projectionResult.projection;
  const projectionWarnings = projectionResult.warnings;
  const projectionFailure = projectionResult.failure;
  const selectedObject = useMemo(() => {
    if (!projection) return null;
    return projection.objects.find((object) => object.objectId === selectedObjectId) ?? projection.objects[0] ?? null;
  }, [projection, selectedObjectId]);
  const selectedStation = useMemo(() => projection?.stations.find((station) => station.stationId === moveStation || station.label === moveStation), [moveStation, projection]);
  const activeLens = useMemo(
    () => DISCIPLINE_LENSES.find((lens) => lens.key === disciplineLens) ?? DISCIPLINE_LENSES[0],
    [disciplineLens],
  );
  const engineeringApprovedBudgetTotal = useMemo(
    () => engineeringBudgetRows.reduce((sum, row) => sum + numeric(row.engineeringApprovedBudget), 0),
    [engineeringBudgetRows],
  );
  const commercialBudgetBaseline = useMemo(
    () => engineeringBudgetRows.reduce((sum, row) => sum + numeric(row.commercialBudget), 0),
    [engineeringBudgetRows],
  );
  const budgetAffectedObjectIds = useMemo(() => new Set(
    engineeringChangeSetHistory.flatMap((changeSet) => changeSet.patches)
      .filter((patch) => ["MOVE_OBJECT", "CHANGE_OBJECT_SIZE", "CHANGE_OBJECT_CONFIGURATION", "CHANGE_PLACEMENT", "CHANGE_ILA_CONFIGURATION", "CHANGE_REGEN"].includes(patch.patchType))
      .map((patch) => patch.targetObjectId)
      .filter(Boolean),
  ), [engineeringChangeSetHistory]);
  const budgetRowsForReview = useMemo(
    () => engineeringBudgetRows.filter((row) => budgetAffectedObjectIds.has(row.objectId) || row.engineeringApprovedBudget !== row.commercialBudget || Boolean(row.notes)),
    [budgetAffectedObjectIds, engineeringBudgetRows],
  );
  const allObjectBudgetsConfirmed = budgetRowsForReview.every((row) => row.confirmed);
  const activeQuantityReconciliation = useMemo(() => quantityReconciliationFromDraft(activeDraft), [activeDraft]);
  const quantityReconciliationRequired = Boolean(activeQuantityReconciliation?.items.length);
  const quantityReconciliationReady = !quantityReconciliationRequired || activeQuantityReconciliation?.status === "PASS";
  const constitutionalReview = useMemo(() => evaluateConstitutionalAssemblyReview(activeDraft), [activeDraft]);
  const constitutionalQuantityGateReady = !quantityReconciliationRequired || constitutionalReview.status === "PASS";
  const manualCertificationReady = Boolean(
    allObjectBudgetsConfirmed
    && engineeringBudgetApproved
    && quantityReconciliationReady
    && constitutionalQuantityGateReady
  );
  const engineeringReadinessReport = useMemo(
    () => buildEngineeringReadinessReport(
      activeDraft,
      activeEngineeringPackage ?? engineeringPackageForDraft(activeDraft),
      projection,
      projectionWarnings,
      projectionFailure,
      Boolean(manualCertificationReady && projection && engineeringCertificationReady(projection)),
    ),
    [activeDraft, activeEngineeringPackage, manualCertificationReady, projection, projectionFailure, projectionWarnings],
  );
  const engineeringRevisionReference = useMemo(
    () => engineeringRevisionReferenceForDraft(activeDraft, activeEngineeringPackage ?? engineeringPackageForDraft(activeDraft)),
    [activeDraft, activeEngineeringPackage],
  );
  const engineeringRevisionProjection = useMemo<EngineeringRevisionProjection>(
    () => buildEngineeringRevisionProjection(engineeringRevisionReference, engineeringRevisionReference, engineeringChangeSetHistory),
    [engineeringChangeSetHistory, engineeringRevisionReference],
  );
  const sharedOpportunityMapProjection = useMemo(() => sharedOpportunityMapProjectionFromDraft(activeDraft), [activeDraft]);
  const engineeringMapSpecs = useMemo(() => {
    if (!projection || !sharedOpportunityMapProjection) return [];
    const engineeringOverlay = {
      ...projection.mapSpec,
      specId: `${projection.mapSpec.specId}:engineering-overlays`,
      name: "Engineering review overlays",
      primitives: projection.mapSpec.primitives.filter((primitive) => primitive.ref.kind !== "Route" && primitive.metadata?.isRouteAuthority !== true),
      features: [],
      metadata: {
        ...projection.mapSpec.metadata,
        routeGeometryAuthority: "COMMERCIAL_ROUTE_REPOSITORY",
        sharedOpportunityMap: true,
      },
    };
    return [renderSharedOpportunityMapProjection(sharedOpportunityMapProjection), engineeringOverlay];
  }, [projection, sharedOpportunityMapProjection]);
  const conditionSelectionContext = useMemo(() => {
    if (!projection || !activeDraft) return null;
    const object = reviewSelection?.kind === "Object"
      ? projection.objects.find((item) => item.objectId === reviewSelection.id) ?? null
      : selectedObject;
    const station = reviewSelection?.kind === "Station"
      ? projection.stations.find((item) => item.stationId === reviewSelection.id) ?? null
      : object
        ? projection.stations.find((item) => item.stationId === object.station || item.label === object.station) ?? null
        : null;
    const endpoint = reviewSelection?.kind === "Site"
      ? sharedOpportunityMapProjection?.endpoints.find((item) => reviewSelection.id.endsWith(`:${item.role}`)) ?? null
      : null;
    const coordinate = object?.coordinate ?? station?.coordinate ?? endpoint?.coordinate;
    return {
      opportunityId: activeDraft.opportunityId,
      engineeringPackageId: activeEngineeringPackage?.engineeringPackageId ?? activeDraft.engineeringPackageId ?? "",
      engineeringRevisionId: engineeringRevisionReference.engineeringRevisionId,
      routeRepositoryId: sharedOpportunityMapProjection?.routeRepositoryId ?? routeRepositoryIdForDraft(activeDraft),
      routeRevision: sharedOpportunityMapProjection?.routeRevision,
      geometryHash: sharedOpportunityMapProjection?.geometryHash,
      routeGeometryId: sharedOpportunityMapProjection?.routeGeometryId,
      orientation: sharedOpportunityMapProjection?.orientation,
      station: station?.label ?? object?.station ?? "",
      stationId: station?.stationId ?? "",
      coordinates: coordinate ?? null,
      objectId: object?.objectId ?? "",
      objectType: object?.objectType ?? "",
      doctrineReference: projection.doctrineIdVersion,
      currentAuthority: object?.currentAuthority || "ENGINEERING",
      selectionKind: reviewSelection?.kind ?? (object ? "Object" : "Route"),
      selectionId: reviewSelection?.id ?? object?.objectId ?? sharedOpportunityMapProjection?.routeRepositoryId ?? "",
      endpointRole: endpoint?.role ?? "",
      humanActor: currentUserName,
    };
  }, [activeDraft, activeEngineeringPackage, currentUserName, engineeringRevisionReference.engineeringRevisionId, projection, reviewSelection, selectedObject, sharedOpportunityMapProjection]);

  useEffect(() => {
    setActiveDraft(selectedEngineeringDraftIofPackage);
    setActiveEngineeringPackage(engineeringPackageForDraft(selectedEngineeringDraftIofPackage));
  }, [selectedEngineeringDraftIofPackage]);

  useEffect(() => {
    if (!canRead) return;
    const packageRecord = activeEngineeringPackage ?? engineeringPackageForDraft(activeDraft);
    const reference = engineeringRevisionReferenceForDraft(activeDraft, packageRecord);
    if (!reference.engineeringRevisionId && !reference.engineeringBaselineId) {
      setEngineeringChangeSetHistory([]);
      setEngineeringChangeSetNotice("Engineering Revision mirrors Baseline. No Engineering Change Set patches are active.");
      return;
    }
    let cancelled = false;
    EngineeringChangeSetRepository.listChangeSets(session)
      .then((records) => {
        if (cancelled) return;
        const matching = records.filter((record) => (
          record.revisionId === reference.engineeringRevisionId ||
          record.engineeringBaselineId === reference.engineeringBaselineId ||
          record.engineeringPackageId === reference.engineeringPackageId
        )) as unknown as EngineeringChangeSet[];
        setEngineeringChangeSetHistory(matching);
        const patchCount = matching.reduce((total, item) => total + (item.activePatchCount ?? item.patchCount ?? 0), 0);
        setEngineeringChangeSetNotice(patchCount
          ? `${patchCount.toLocaleString()} Engineering Change Set patch(es) restored for Engineering Revision.`
          : "Engineering Revision mirrors Baseline. No Engineering Change Set patches are active.");
      })
      .catch((error) => {
        if (!cancelled) setEngineeringChangeSetNotice(`Engineering Change Set restore unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDraft, activeEngineeringPackage, canRead, session]);

  useEffect(() => {
    if (!projection || !activeDraft) {
      setManualStationPlan(null);
      setEngineeringBudgetRows([]);
      setEngineeringBudgetApproved(false);
      return;
    }
    setManualStationPlan((current) => current?.draftIofPackageId === activeDraft.packageId ? current : buildManualStationPlan(activeDraft, projection, currentUserName));
    setEngineeringBudgetRows((current) => buildEngineeringBudgetRows(projection, current));
    setEngineeringBudgetApproved(false);
  }, [activeDraft?.packageId, currentUserName, projection]);

  useEffect(() => {
    const budgetApprovalTarget = `ENG-BUDGET-${activeDraft?.packageId ?? ""}`;
    const restoredApproval = engineeringChangeSetHistory.some((changeSet) => (
      ["ACTIVE", "APPLIED"].includes(changeSet.status)
      && changeSet.patches.some((patch) => (
        patch.patchType === "CHANGE_REVIEW_STATUS"
        && patch.targetObjectId === budgetApprovalTarget
        && patch.targetProperty === "engineeringApprovedBudget.status"
        && patch.newValue === "APPROVED"
        && patch.validationState !== "INVALID"
      ))
    ));
    if (restoredApproval) setEngineeringBudgetApproved(true);
  }, [activeDraft?.packageId, engineeringChangeSetHistory]);

  useEffect(() => {
    const engineeringPackageId = firstText(activeEngineeringPackage?.engineeringPackageId, activeDraft?.engineeringPackageId);
    const engineeringRevisionId = engineeringRevisionProjection.revisionId;
    if (!canRead || !engineeringPackageId || !engineeringRevisionId) {
      setActiveEngineeringApproval(null);
      setApprovalEligibility(null);
      return;
    }
    let cancelled = false;
    getEngineeringApprovalStatus({ engineeringPackageId, engineeringRevisionId }, session)
      .then((result) => {
        if (!cancelled) {
          setActiveEngineeringApproval(result.currentEngineeringApproval ?? null);
          setApprovalEligibility(result.approvalEligibility);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveEngineeringApproval(null);
          setApprovalEligibility(null);
        }
      });
    return () => { cancelled = true; };
  }, [activeDraft?.engineeringPackageId, activeEngineeringPackage?.engineeringPackageId, canRead, engineeringRevisionProjection.diagnostics.revisionHash, engineeringRevisionProjection.revisionId, session]);

  useEffect(() => {
    if (!projection?.objects.length) return;
    if (!selectedObjectId || !projection.objects.some((object) => object.objectId === selectedObjectId)) {
      setSelectedObjectId(projection.objects[0].objectId);
    }
  }, [projection, selectedObjectId]);

  useEffect(() => {
    if (moveStation || !activeDraft) return;
    setMoveStation(selectedStationLabel(activeDraft));
  }, [activeDraft, moveStation]);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    listEngineeringReviewQueue(session)
      .then(async (items) => {
        if (cancelled) return;
        setQueue(items);
        const certified = await listCertifiedIofPackages(session).catch(() => []);
        if (!cancelled) setCertifiedPackages(certified);
        const preferredPackageId = selectedEngineeringDraftIofPackageId || selectedEngineeringDraftIofPackage?.engineeringPackageId || selectedEngineeringDraftIofPackage?.packageId;
        if (!activeDraft && preferredPackageId) {
          setPending(true);
          try {
            const draft = await openDraftIofPackageForCertification(preferredPackageId, session);
            if (cancelled) return;
            const engineeringPackage = engineeringPackageForDraft(draft);
            setActiveDraft(draft);
            setActiveEngineeringPackage(engineeringPackage);
            setSelectedEngineeringDraftIofPackage(draft);
            setSelectedEngineeringDraftIofPackageId(engineeringPackage?.engineeringPackageId ?? draft.engineeringPackageId ?? draft.packageId);
            setNotice(`${engineeringPackage?.engineeringPackageId ?? draft.engineeringPackageId ?? draft.packageId} restored from Engineering Baseline authority.`);
          } finally {
            if (!cancelled) setPending(false);
          }
        } else {
          setNotice(items.length ? "Engineering Packages awaiting review loaded." : "No Engineering Packages are waiting.");
        }
      })
      .catch((error) => {
        if (!cancelled) setNotice(`Engineering Certification queue unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDraft, canRead, selectedEngineeringDraftIofPackage?.packageId, selectedEngineeringDraftIofPackageId, session, setSelectedEngineeringDraftIofPackage]);

  async function refreshQueue(message?: string) {
    if (!canRead) return;
    const items = await listEngineeringReviewQueue(session);
    setQueue(items);
    setCertifiedPackages(await listCertifiedIofPackages(session).catch(() => []));
    if (message) setNotice(message);
  }

  async function openPackage(packageId: string) {
    setPending(true);
    try {
      const draft = await openDraftIofPackageForCertification(packageId, session);
      const engineeringPackage = engineeringPackageForDraft(draft);
      setActiveDraft(draft);
      setActiveEngineeringPackage(engineeringPackage);
      setSelectedEngineeringDraftIofPackage(draft);
      setSelectedEngineeringDraftIofPackageId(engineeringPackage?.engineeringPackageId ?? draft.engineeringPackageId ?? draft.packageId);
      setNotice(`${engineeringPackage?.engineeringPackageId ?? draft.engineeringPackageId ?? draft.packageId} opened. Engineering Baseline, Draft IOF, route, workbook, estimate, and proposal resolved without regeneration.`);
    } catch (error) {
      setNotice(`Open package failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  function syncDraft(draft: DraftIofPackageRuntime, message: string, engineeringPackage?: EngineeringPackageRuntime | null) {
    setActiveDraft(draft);
    setActiveEngineeringPackage(engineeringPackage ?? engineeringPackageForDraft(draft) ?? activeEngineeringPackage);
    setSelectedEngineeringDraftIofPackage(draft);
    setNotice(message);
  }

  function bindQuantityReconciliation(reconciliation: QuantityReconciliation) {
    if (!activeDraft) return;
    const nextDraft = {
      ...activeDraft,
      quantityReconciliation: reconciliation,
      quantityReconciliationStatus: reconciliation.status,
      quantityReconciliationHash: reconciliation.calculationHash,
      engineeringApprovedQuantities: reconciliation.items
        .filter((item) => item.status === "MATCH" || item.status === "RESOLVED")
        .map((item) => ({
          reconciliationItemId: item.reconciliationItemId,
          objectClass: item.objectClass,
          quantityType: item.quantityType,
          approvedQuantity: item.approvedQuantity ?? item.sourceQuantity ?? item.derivedQuantity,
          unit: item.unit,
          decisionHash: item.decisionHash,
          sourceHash: item.sourceHash,
        })),
      quantityDoctrineExceptionIds: reconciliation.exceptionIds,
    } as DraftIofPackageRuntime;
    setActiveDraft(nextDraft);
    setSelectedEngineeringDraftIofPackage(nextDraft);
    setNotice(`Quantity reconciliation recalculated ${reconciliation.status}; ${reconciliation.resolvedCount}/${reconciliation.requiredCount} required items resolved.`);
  }

  async function openCertifiedPackage(certifiedPackageId: string) {
    if (!certifiedPackageId) return;
    setPending(true);
    try {
      const certified = await openCertifiedIofPackage(certifiedPackageId, session);
      setActiveCertifiedPackage(certified);
      setNotice(`${certified.certifiedPackageId} restored from Certified IOF Package repository. Service Order Ready; ScopeVersion remains future.`);
    } catch (error) {
      setNotice(`Open Certified IOF Package failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  function openStationReview() {
    if (!activeDraft || !projection) return;
    setManualStationPlan((current) => current?.draftIofPackageId === activeDraft.packageId ? current : buildManualStationPlan(activeDraft, projection, currentUserName));
    setNotice("Station Review opened from the persisted station graph and station object manifest.");
  }

  async function recordEngineeringChangeSetPatch(args: {
    patchType: EngineeringPatchType;
    targetObjectId?: string;
    targetProperty: string;
    oldValue?: EngineeringPatchValue;
    newValue?: EngineeringPatchValue;
    reason?: string;
  }) {
    const packageRecord = activeEngineeringPackage ?? engineeringPackageForDraft(activeDraft);
    const reference = engineeringRevisionReferenceForDraft(activeDraft, packageRecord);
    if (!reference.engineeringBaselineId || !reference.engineeringRevisionId) {
      setEngineeringChangeSetNotice("Engineering Change Set skipped: Engineering Baseline or Revision reference is missing.");
      return null;
    }
    const patch = createEngineeringPatch({
      revisionId: reference.engineeringRevisionId,
      patchType: args.patchType,
      targetObjectId: args.targetObjectId,
      targetProperty: args.targetProperty,
      oldValue: args.oldValue,
      newValue: args.newValue,
      createdBy: currentUserName,
      reason: args.reason,
    });
    const changeSet = engineeringChangeSetFromPatches({
      revisionId: reference.engineeringRevisionId,
      engineeringBaselineId: reference.engineeringBaselineId,
      engineeringPackageId: reference.engineeringPackageId,
      draftIOFPackageId: reference.draftIOFPackageId,
      opportunityId: reference.opportunityId,
      routeRepositoryId: reference.routeRepositoryId,
      proposalId: reference.proposalId,
      estimateId: reference.estimateId,
      workbookId: reference.workbookId,
      baselineHash: reference.engineeringBaselineHash,
      patches: [patch],
      createdBy: currentUserName,
      createdById: session?.user.userId,
    });
    try {
      const saved = await EngineeringChangeSetRepository.saveChangeSet(changeSet as never, session) as unknown as EngineeringChangeSet;
      setEngineeringChangeSetHistory((history) => [...history.filter((item) => item.changeSetId !== saved.changeSetId), saved]);
      setEngineeringChangeSetNotice(`${patch.patchType} saved as Engineering Change Set patch. Baseline and Engineering Package remain unchanged.`);
      return saved;
    } catch (error) {
      setEngineeringChangeSetNotice(`Engineering Change Set save failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  function updateEngineeringBudgetRow(objectId: string, patch: Partial<EngineeringBudgetRow>) {
    const currentRow = engineeringBudgetRows.find((row) => row.objectId === objectId);
    setEngineeringBudgetRows((rows) => rows.map((row) => row.objectId === objectId ? { ...row, ...patch } : row));
    setEngineeringBudgetApproved(false);
    void recordEngineeringChangeSetPatch({
      patchType: "CHANGE_OBJECT_CONFIGURATION",
      targetObjectId: objectId,
      targetProperty: `objectBudget.${Object.keys(patch)[0] ?? "configuration"}`,
      oldValue: asRecord(currentRow)[Object.keys(patch)[0] ?? "configuration"] as EngineeringPatchValue,
      newValue: patch as EngineeringPatchValue,
      reason: "Engineering object budget/configuration changed.",
    });
  }

  function approveEngineeringBudget() {
    if (!allObjectBudgetsConfirmed) {
      setNotice("Confirm each budget affected by an Engineering decision before approving the Engineering budget.");
      return;
    }
    setEngineeringBudgetApproved(true);
    setNotice(`Engineering budget approved at ${money(engineeringApprovedBudgetTotal)}; unchanged baseline objects required no individual acknowledgement.`);
    void recordEngineeringChangeSetPatch({
      patchType: "CHANGE_REVIEW_STATUS",
      targetObjectId: `ENG-BUDGET-${activeDraft?.packageId ?? "PACKAGE"}`,
      targetProperty: "engineeringApprovedBudget.status",
      oldValue: "PENDING",
      newValue: "APPROVED",
      reason: "Engineering object budget approved.",
    });
  }

  async function addConstraint() {
    if (!activeDraft || !conditionSelectionContext) return;
    setPending(true);
    try {
      const result = await addEngineeringCertificationConstraint(activeDraft.packageId, {
        conditionTitle: conditionTitle.trim() || `${conditionClassification} condition`,
        humanClassification: conditionClassification,
        humanSeverity: conditionSeverity,
        category: CONDITION_CONSTRAINT_CATEGORY[conditionClassification],
        station: conditionSelectionContext.station,
        objectReference: conditionSelectionContext.objectId,
        severity: conditionSeverity === "BLOCKING" ? "CRITICAL" : conditionSeverity === "INFO" ? "LOW" : conditionSeverity,
        status: "OPEN",
        engineeringDisposition: "PENDING_ENGINEERING_DISPOSITION",
        notesEvidence: constraintNotes,
        conditionContext: conditionSelectionContext,
      }, session);
      const draft = { ...activeDraft, updatedAt: result.updatedAt, engineeringConstraints: result.engineeringConstraints } as DraftIofPackageRuntime;
      const savedConstraints = result.engineeringConstraints.map(asRecord);
      const savedCondition = savedConstraints.at(-1);
      const savedConditionId = firstText(savedCondition?.constraintId, savedCondition?.id, `${activeDraft.packageId}:CONDITION`);
      setConditionTitle("");
      setConstraintNotes("");
      setReviewSelection({ kind: "Constraint", id: savedConditionId });
      setFocusFeatureId(savedConditionId);
      syncDraft(draft, "Engineering condition added to the governed constraint queue with inherited map context.");
      await recordEngineeringChangeSetPatch({
        patchType: "ADD_CONSTRAINT",
        targetObjectId: savedConditionId,
        targetProperty: "engineeringConstraints",
        oldValue: null,
        newValue: {
          conditionTitle: conditionTitle.trim() || `${conditionClassification} condition`,
          humanClassification: conditionClassification,
          station: conditionSelectionContext.station,
          objectId: conditionSelectionContext.objectId,
          severity: conditionSeverity,
          status: "OPEN",
          disposition: "PENDING_ENGINEERING_DISPOSITION",
        },
        reason: constraintNotes || "Condition identified during human Engineering review.",
      });
      await refreshQueue();
    } catch (error) {
      setNotice(`Add Constraint failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function dispositionCondition(status: "RESOLVED" | "ACCEPTED", disposition: "ACCEPT" | "ENGINEERING_CHANGE" | "DOCTRINE_EXCEPTION") {
    if (!activeDraft || !selectedConstraintForReview) return;
    setPending(true);
    try {
      const reason = conditionDispositionReason.trim() || (disposition === "ACCEPT" ? "Proposed design accepted without physical change." : "Engineering condition resolved by governed Engineering action.");
      const result = await dispositionEngineeringCertificationConstraint(activeDraft.packageId, selectedConstraintForReview.constraintId, {
        status,
        disposition,
        reason,
        impactSummary: conditionImpactSummary,
        notesEvidence: reason,
      }, session);
      const draft = { ...activeDraft, updatedAt: result.updatedAt, engineeringConstraints: result.engineeringConstraints } as DraftIofPackageRuntime;
      setConditionDispositionReason("");
      setConditionImpactSummary("");
      syncDraft(draft, disposition === "ACCEPT"
        ? "Condition accepted without route, station, or object mutation."
        : `Condition resolved through ${disposition.replaceAll("_", " ").toLowerCase()} authority.`);
      await recordEngineeringChangeSetPatch({
        patchType: "RESOLVE_CONSTRAINT",
        targetObjectId: selectedConstraintForReview.constraintId,
        targetProperty: "engineeringConstraints.status",
        oldValue: selectedConstraintForReview.status,
        newValue: { status, disposition, impactSummary: conditionImpactSummary },
        reason,
      });
      await refreshQueue();
    } catch (error) {
      setNotice(`Condition disposition failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function moveObject() {
    if (!activeDraft || !selectedObject || !canMoveEngineeringObjectToStation(selectedObject) || !moveStation) return;
    setPending(true);
    try {
      const draft = await moveEngineeringCertificationObject(activeDraft.packageId, {
        objectId: selectedObject.objectId,
        newStation: moveStation,
        reason: moveReason,
        authority: moveAuthority || currentUserName,
        impactSummary: `Object reference moved to ${selectedStation?.label ?? moveStation}. Coordinate recalculated from station authority.`,
      }, session);
      await recordEngineeringChangeSetPatch({
        patchType: "MOVE_OBJECT",
        targetObjectId: selectedObject.objectId,
        targetProperty: "stationReference",
        oldValue: selectedObject.station || null,
        newValue: moveStation,
        reason: moveReason || "Object moved by station authority.",
      });
      syncDraft(draft, `${selectedObject.objectId} station reference moved. Stations remained fixed.`);
      await refreshQueue();
    } catch (error) {
      setNotice(`Move Object failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function createRedline() {
    if (!activeDraft) return;
    setPending(true);
    try {
      const draft = await createEngineeringCertificationRouteRedline(activeDraft.packageId, {
        reason: redlineReason,
        description: redlineDescription,
        authority: currentUserName,
        affectedStations: selectedObject?.station,
        impactSummary: "Governed route redline created for Commercial Draft IOF revision.",
      }, session);
      await recordEngineeringChangeSetPatch({
        patchType: "CHANGE_PLACEMENT",
        targetObjectId: selectedObject?.objectId ?? activeDraft.packageId,
        targetProperty: "routeRedline",
        oldValue: null,
        newValue: {
          reason: redlineReason,
          description: redlineDescription,
          affectedStations: selectedObject?.station,
        },
        reason: redlineReason || "Route redline created.",
      });
      setRedlineDescription("");
      syncDraft(draft, "Route redline created new engineering revision metadata.");
      await refreshQueue();
    } catch (error) {
      setNotice(`Create Route Redline failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  function focusConstitutionalAssemblyObject(focus: ConstitutionalAssemblyFocus) {
    if (focus.spineObjectId && projection?.objects.some((object) => object.objectId === focus.spineObjectId)) {
      setSelectedObjectId(focus.spineObjectId);
    }
    if (focus.stationRef) setMoveStation(focus.stationRef);
    setNotice(`${focus.spineObjectId ?? "Package"} focused from Constitutional Assembly Review.`);
  }

  async function recordException() {
    if (!activeDraft) return;
    setPending(true);
    try {
      const draft = await recordEngineeringDoctrineException(activeDraft.packageId, {
        doctrineRule: exceptionRule,
        actualCondition: exceptionCondition,
        reason: exceptionReason,
        approvalAuthority: currentUserName,
        impactSummary: exceptionImpact,
      }, session);
      await recordEngineeringChangeSetPatch({
        patchType: "ADD_EXCEPTION",
        targetObjectId: activeDraft.packageId,
        targetProperty: "doctrineExceptions",
        oldValue: null,
        newValue: {
          doctrineRule: exceptionRule,
          actualCondition: exceptionCondition,
          reason: exceptionReason,
          impactSummary: exceptionImpact,
        },
        reason: exceptionReason || "Doctrine exception recorded.",
      });
      setExceptionCondition("");
      setExceptionReason("");
      setExceptionImpact("");
      syncDraft(draft, "Doctrine exception recorded for Engineering Certification.");
      await refreshQueue();
    } catch (error) {
      setNotice(`Record Doctrine Exception failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function refreshApprovalEligibility() {
    if (!activeEngineeringPackage) return null;
    const result = await getEngineeringApprovalStatus({
      engineeringPackageId: activeEngineeringPackage.engineeringPackageId,
      engineeringRevisionId: approvalEligibility?.engineeringRevisionId ?? engineeringRevisionProjection.revisionId,
    }, session);
    setActiveEngineeringApproval(result.currentEngineeringApproval ?? null);
    setApprovalEligibility(result.approvalEligibility);
    return result.approvalEligibility;
  }

  async function approveCurrentEngineeringRevision() {
    if (!activeDraft || !activeEngineeringPackage || !approvalEligibility) return;
    setPending(true);
    try {
      const result = await approveEngineeringRevision({
        engineeringPackageId: activeEngineeringPackage.engineeringPackageId,
        engineeringRevisionId: approvalEligibility.engineeringRevisionId,
        engineeringRevisionHash: approvalEligibility.engineeringRevisionHash,
        reviewSummaryHash: approvalEligibility.reviewSummaryHash,
        organizationId: session?.user.organizationId,
        tenantId: session?.user.organizationId,
        customerId: activeDraft.customerId,
        opportunityId: activeDraft.opportunityId,
      }, session);
      setActiveEngineeringApproval(result.engineeringApproval);
      setApprovalFailure(null);
      setApprovalConfirmOpen(false);
      setNotice(`${result.engineeringApproval.approvalId} recorded for exact Engineering Revision ${result.engineeringApproval.engineeringRevisionId}${result.idempotentReplay ? " (idempotent replay)" : ""}. Certification remains an explicit next action.`);
    } catch (error) {
      const body = error instanceof TeralinxRuntimeRequestError ? error.body : {};
      const currentEligibility = asRecord(body.approvalEligibility) as EngineeringApprovalEligibilityRuntime;
      if (currentEligibility.engineeringPackageId) setApprovalEligibility(currentEligibility);
      setApprovalFailure({
        code: firstText(body.code, "ENGINEERING_APPROVAL_FAILURE"),
        message: firstText(body.error, error instanceof Error ? error.message : String(error)),
        failedPredicate: firstText(body.failedPredicate, asArray(body.missingRequirements)[0], "approvalEligible"),
        expectedValue: body.expectedValue ?? true,
        actualValue: body.actualValue ?? false,
        sourceAuthority: firstText(body.sourceAuthority, "ENGINEERING_APPROVAL_ELIGIBILITY"),
      });
      setNotice("Approval cannot be completed. Refresh the governed package state or return to review.");
    } finally {
      setPending(false);
    }
  }

  async function certifyPackage() {
    if (!activeDraft || !projection) return;
    if (!allObjectBudgetsConfirmed || !engineeringBudgetApproved) {
      setNotice("Certification blocked until every object budget is confirmed and the Engineering budget is approved.");
      return;
    }
    if (!quantityReconciliationReady || !constitutionalQuantityGateReady) {
      setNotice("Certification blocked until every required quantity has an attributable Engineering disposition and Constitutional Assembly recalculates PASS.");
      return;
    }
    if (!engineeringCertificationReady(projection)) {
      setNotice("Certification blocked until compliance failures are excepted and constraints are resolved or accepted.");
      return;
    }
    if (!activeEngineeringApproval
      || !approvalEligibility
      || activeEngineeringApproval.engineeringRevisionId !== approvalEligibility.engineeringRevisionId
      || activeEngineeringApproval.engineeringRevisionHash !== approvalEligibility.engineeringRevisionHash
      || activeEngineeringApproval.reviewSummaryHash !== approvalEligibility.reviewSummaryHash) {
      setNotice("Certification blocked until an authorized human approves this exact Engineering Revision.");
      return;
    }
    setPending(true);
    try {
      let draft = activeDraft;
      for (const unit of asArray(draft.proposedIofUnits).filter((item) => asRecord(item).status !== "CERTIFIED")) {
        const unitId = String(asRecord(unit).unitId ?? "");
        if (!unitId) continue;
        const result = await certifyIofUnit(draft.packageId, unitId, {
          engineeringNote: "Certified by Engineering Certification package gate.",
          engineeringConfidence: 94,
          engineeringRisk: "ACCEPTED",
          engineeringComments: ["Certified as part of CERTIFY PACKAGE action."],
        }, session);
        draft = result.iofPackage;
      }
      const refreshedProjectionResult = safeScheduleEngineeringProjection(draft);
      if (!refreshedProjectionResult.projection) {
        throw new Error(refreshedProjectionResult.failure?.message ?? "Projection validation failed during certification.");
      }
      const refreshedProjection = refreshedProjectionResult.projection;
      const certificationRevisionProjection = buildEngineeringRevisionProjection(
        engineeringRevisionReference,
        engineeringRevisionReference,
        engineeringChangeSetHistory,
      );
      const effectiveStationPlan = manualStationPlan ?? buildManualStationPlan(activeDraft, refreshedProjection, currentUserName);
      const result = await certifyDraftIofPackage(draft.packageId, {
        engineeringApprovalId: activeEngineeringApproval?.approvalId,
        engineeringRevision: {
          engineeringBaselineId: engineeringRevisionReference.engineeringBaselineId,
          engineeringBaselineHash: engineeringRevisionReference.engineeringBaselineHash,
          engineeringPackageId: approvalEligibility.engineeringPackageId,
          engineeringRevisionId: approvalEligibility.engineeringRevisionId,
          engineeringRevisionHash: approvalEligibility.engineeringRevisionHash,
          engineeringChangeSetIds: certificationRevisionProjection.changeSetIds,
          activePatchCount: certificationRevisionProjection.diagnostics.activePatchCount,
          appliedPatchCount: certificationRevisionProjection.diagnostics.appliedPatchCount,
          patchReplayTimeMs: certificationRevisionProjection.diagnostics.patchReplayTimeMs,
          projectionTimeMs: certificationRevisionProjection.diagnostics.projectionTimeMs,
          certificationConsumesEngineeringRevision: true,
          noBaselineMutation: true,
          noEngineeringPackageMutation: true,
          noScopeVersionCreation: true,
        },
        checklist: buildEngineeringCertificationChecklist(refreshedProjection, certificationNotes, 94),
        stationPlan: {
          ...(draft.referenceOnly ? {
            stationPlanId: effectiveStationPlan.stationPlanId,
            stationCount: effectiveStationPlan.stations.length,
            objectAssignmentCount: effectiveStationPlan.objectAssignments.length,
            stationProjectionId: draft.stationProjectionId,
            stationGraphId: draft.stationGraphId,
            referenceOnly: true,
          } : effectiveStationPlan),
          status: "CERTIFIED",
          certifiedBy: currentUserName,
          certifiedAt: new Date().toISOString(),
        },
        engineeringApprovedObjectBudget: {
          budgetId: `ENG-BUDGET-${draft.packageId}`,
          draftIofPackageId: draft.packageId,
          opportunityId: draft.opportunityId,
          routeRepositoryId: routeRepositoryIdForDraft(draft),
          approvedBy: currentUserName,
          approvedAt: new Date().toISOString(),
          totalApprovedBudget: engineeringApprovedBudgetTotal,
          objectBudgets: draft.referenceOnly ? budgetRowsForReview : engineeringBudgetRows,
          allObjectsConfirmed: true,
          noScopeVersionCreation: true,
        },
        engineeringApprovedBudget: engineeringApprovedBudgetTotal,
        quantityReconciliation: activeQuantityReconciliation ? {
          reconciliationId: activeQuantityReconciliation.reconciliationId,
          revisionId: activeQuantityReconciliation.revisionId,
          status: activeQuantityReconciliation.status,
          calculationHash: activeQuantityReconciliation.calculationHash,
          sourceHash: activeQuantityReconciliation.sourceHash,
          items: activeQuantityReconciliation.items,
          approvedQuantities: activeQuantityReconciliation.items.map((item) => ({
            reconciliationItemId: item.reconciliationItemId,
            quantityType: item.quantityType,
            approvedQuantity: item.approvedQuantity ?? item.sourceQuantity ?? item.derivedQuantity,
            unit: item.unit,
            status: item.status,
            decisionHash: item.decisionHash,
            sourceHash: item.sourceHash,
          })),
          doctrineExceptionIds: activeQuantityReconciliation.exceptionIds,
          doctrineExceptions: quantityReconciliationRepository.listExceptions(activeQuantityReconciliation),
          auditEventIds: activeQuantityReconciliation.auditEventIds,
          noScopeVersionCreation: true,
          noExecutionAuthorization: true,
        } : undefined,
        manualHandoff: {
          displayPackageObjects: true,
          generateAssignStations: true,
          reviewObjectBudget: true,
          approveEngineeringBudget: true,
          certifyIofPackage: true,
          serviceOrderReady: true,
          awaitSignature: true,
          scopeVersionFuture: true,
        },
        notes: certificationNotes,
      }, session);
      setActiveCertifiedPackage(result.certifiedIofPackage);
      syncDraft(result.draftPackage, `${result.certifiedIofPackage.certificationLedgerId ?? result.certifiedIofPackage.certifiedDraftIofPackageId ?? result.draftPackage.packageId} recorded in Certification Ledger. Certified IOF Package projection is Service Order Ready; ScopeVersion not created.`, result.engineeringPackage ?? null);
      await refreshQueue();
    } catch (error) {
      setNotice(`CERTIFY PACKAGE failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function requestCommercialRevision() {
    if (!activeDraft) return;
    setPending(true);
    try {
      const draft = await returnDraftIofPackageToCommercial(activeDraft.packageId, { reason: commercialRevisionReason }, session);
      syncDraft(draft, "Draft IOF Package returned to Commercial for revision.");
      await refreshQueue();
    } catch (error) {
      setNotice(`Commercial revision request failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  if (!canRead) {
    return (
      <section className="dal-panel engineering-certification-shell">
        <h3>Engineering Certification</h3>
        <div className="dal-status">Engineering Certification requires Engineering read authority.</div>
      </section>
    );
  }

  if (!activeDraft) {
    return (
      <section className="dal-panel engineering-certification-shell">
        <div className="dal-panel-title-row">
          <div>
            <h3>Engineering Certification</h3>
            <div className="dal-status">Engineering Package Browser</div>
          </div>
          <button type="button" onClick={() => setWorkspace("googleRfp")}>Return to Commercial</button>
        </div>
        <div className="dal-list">
          {queue.map((item) => {
            const engineeringPackageId = queueEngineeringPackageId(item);
            return (
            <button className="dal-list-row" type="button" key={engineeringPackageId} onClick={() => void openPackage(engineeringPackageId)} disabled={pending}>
              <b>{item.customer || item.packageName || item.packageId}</b>
              <span>Engineering Package {engineeringPackageId} / Draft IOF {item.draftIofPackageId ?? item.packageId}</span>
              <small>{String(item.packageStatus).replaceAll("_", " ")}. {item.commercialStatus?.replaceAll("_", " ") ?? "Submitted to Engineering"}. Open Station Review.</small>
            </button>
            );
          })}
          {!queue.length ? <div className="dal-status">No Engineering Packages are currently pending certification.</div> : null}
        </div>
        <div className="dal-status">{notice}</div>
      </section>
    );
  }

  if (!projection) {
    const renderEngineeringPackage = activeEngineeringPackage ?? engineeringPackageForDraft(activeDraft);
    const renderEngineeringPackageId = renderEngineeringPackage?.engineeringPackageId ?? activeDraft.engineeringPackageId ?? activeDraft.packageId;
    return (
      <section className="engineering-certification-shell">
        <section className="dal-panel engineering-certification-package-header">
          <div className="dal-panel-title-row">
            <div>
              <h3>Engineering Package</h3>
              <span>{renderEngineeringPackageId}</span>
            </div>
            <button type="button" onClick={() => setWorkspace("googleRfp")}>Return to Commercial</button>
          </div>
          <div className="dal-status warning">
            Projection Validation Failure. Repository state remains intact and no ScopeVersion was created.
          </div>
        </section>
        <EngineeringReadinessReportPanel
          report={engineeringReadinessReport}
          projectionWarnings={projectionWarnings}
          projectionFailure={projectionFailure}
        />
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Engineering Package Browser</h3>
            <span className="dal-badge warning">RECOVERABLE</span>
          </div>
          <div className="dal-list">
            {queue.map((item) => {
              const engineeringPackageId = queueEngineeringPackageId(item);
              return (
                <button className="dal-list-row" type="button" key={engineeringPackageId} onClick={() => void openPackage(engineeringPackageId)} disabled={pending}>
                  <b>{item.customer || item.packageName || item.packageId}</b>
                  <span>Engineering Package {engineeringPackageId} / Draft IOF {item.draftIofPackageId ?? item.packageId}</span>
                  <small>{String(item.packageStatus).replaceAll("_", " ")}. {item.commercialStatus?.replaceAll("_", " ") ?? "Submitted to Engineering"}.</small>
                </button>
              );
            })}
            {!queue.length ? <div className="dal-status">No alternate Engineering Packages are currently pending certification.</div> : null}
          </div>
          <div className="dal-status">{notice}</div>
        </section>
      </section>
    );
  }
  const renderDraft = activeDraft;
  const renderEngineeringPackage = activeEngineeringPackage ?? engineeringPackageForDraft(renderDraft);
  const renderEngineeringPackageId = renderEngineeringPackage?.engineeringPackageId ?? renderDraft.engineeringPackageId ?? renderDraft.packageId;
  const renderEngineeringBaselineId = String(renderEngineeringPackage?.engineeringBaselineId ?? (renderDraft as Record<string, unknown>).engineeringBaselineId ?? "Pending");
  const renderEngineeringBaselineHash = String(renderEngineeringPackage?.engineeringBaselineHash ?? (renderDraft as Record<string, unknown>).engineeringBaselineHash ?? "Pending");
  const renderEngineeringRevisionId = String(approvalEligibility?.engineeringRevisionId ?? renderEngineeringPackage?.engineeringRevisionId ?? (renderDraft as Record<string, unknown>).engineeringRevisionId ?? "Mirrors Package");
  const renderEngineeringRevisionHash = approvalEligibility?.engineeringRevisionHash ?? "Resolving server authority";
  const rawEngineeringPackageStatus = String(renderEngineeringPackage?.engineeringStatus ?? renderEngineeringPackage?.status ?? renderDraft.engineeringStatus ?? "STATION_REVIEW");
  const engineeringPackageStatus = rawEngineeringPackageStatus === "STATION_PLANNING" ? "STATION_REVIEW" : rawEngineeringPackageStatus;
  const serviceOrderReadyStatus = String(renderEngineeringPackage?.serviceOrderState ?? renderEngineeringPackage?.serviceOrderStatus ?? activeCertifiedPackage?.serviceOrderStatus ?? "Service Order Ready");
  const selectedStationForReview = reviewSelection?.kind === "Station"
    ? projection.stations.find((station) => station.stationId === reviewSelection.id)
    : null;
  const selectedConstraintForReview = reviewSelection?.kind === "Constraint"
    ? projection.constraints.find((constraint) => constraint.constraintId === reviewSelection.id)
    : null;
  const unresolvedConstraints = projection.constraints.filter((constraint) => !["RESOLVED", "ACCEPTED"].includes(constraint.status));
  const openConditions = unresolvedConstraints;
  const modifiedObjectIds = new Set([
    ...engineeringRevisionProjection.projectionState.objects.moves.map((patch) => patch.targetObjectId),
    ...Object.keys(engineeringRevisionProjection.projectionState.objects.configurations),
    ...Object.keys(engineeringRevisionProjection.projectionState.objects.sizes),
    ...Object.keys(engineeringRevisionProjection.projectionState.constraints.placements),
  ].filter(Boolean));
  const quantityDifferenceCount = activeQuantityReconciliation?.items.filter((item) => !["MATCH", "RESOLVED", "SUPERSEDED"].includes(item.status)).length ?? 0;
  const doctrineExceptionCount = asArray((renderDraft as Record<string, unknown>).doctrineExceptions).length;
  const selectedObjectBudget = selectedObject ? engineeringBudgetRows.find((row) => row.objectId === selectedObject.objectId) : null;
  const selectedObjectOpenConditionCount = selectedObject
    ? openConditions.filter((condition) => condition.objectReference === selectedObject.objectId).length
    : 0;
  const failedCompliance = projection.compliance.filter((row) => row.status === "FAIL");
  const failureAuthorityIssues = engineeringFailureAuthorityProjection(projection);
  const complianceBlockers = failureAuthorityIssues.filter((issue) => issue.blocking && !issue.humanActionRequired);
  const waitingSystemIssues = failureAuthorityIssues.filter((issue) => issue.classification === "DERIVED_SYSTEM_VALIDATION" && issue.blocking && !issue.humanActionRequired);
  const blockerLabels = [
    !sharedOpportunityMapProjection ? "Governed route projection unavailable" : "",
    !allObjectBudgetsConfirmed ? "Engineering-affected budgets unconfirmed" : "",
    !engineeringBudgetApproved ? "Engineering budget not approved" : "",
    !quantityReconciliationReady ? "Quantity reconciliation incomplete" : "",
    !constitutionalQuantityGateReady ? "Constitutional quantity gate incomplete" : "",
    unresolvedConstraints.length ? `${unresolvedConstraints.length.toLocaleString()} unresolved constraint(s)` : "",
    failedCompliance.length ? `${failedCompliance.length.toLocaleString()} compliance failure(s)` : "",
  ].filter(Boolean);
  const readyForHumanCertification = Boolean(manualCertificationReady && engineeringCertificationReady(projection) && blockerLabels.length === 0);
  const requiredApprovals: EngineeringApprovalItem[] = [
    ...(!allObjectBudgetsConfirmed || !engineeringBudgetApproved ? [{
      id: "engineering-budget",
      title: "Engineering Budget",
      description: !allObjectBudgetsConfirmed
        ? `${budgetRowsForReview.filter((row) => !row.confirmed).length.toLocaleString()} Engineering-affected budget item(s) still require confirmation.`
        : `The ${money(commercialBudgetBaseline)} Commercial baseline has not been approved by Engineering.`,
      nextResult: "Approval records the existing Engineering Change Set review-status patch and clears the budget gate.",
      state: "ACTION REQUIRED" as const,
      affectedCount: budgetRowsForReview.filter((row) => !row.confirmed).length,
      humanActionRequired: true,
      blocker: true,
      actionLabel: "Review & Approve",
      actionTarget: "BUDGET" as const,
      sourceGate: "engineeringApprovedBudget / allObjectBudgetsConfirmed",
    }] : []),
    ...(!quantityReconciliationReady ? [{
      id: "quantity-reconciliation",
      title: "Quantity Reconciliation",
      description: `${quantityDifferenceCount.toLocaleString()} quantity item(s) require an attributable Engineering disposition.`,
      nextResult: "The existing Quantity Reconciliation authority recalculates after every governed disposition.",
      state: "ACTION REQUIRED" as const,
      affectedCount: quantityDifferenceCount,
      humanActionRequired: true,
      blocker: true,
      actionLabel: "Review Quantities",
      actionTarget: "QUANTITIES" as const,
      sourceGate: "quantityReconciliation.status",
    }] : []),
    ...(!constitutionalQuantityGateReady ? [{
      id: "constitutional-quantity",
      title: "Constitutional Quantity Review",
      description: "Quantity authority remains incomplete after the current reconciliation decisions.",
      nextResult: "Resolve the underlying quantity disposition; Constitutional Assembly remains deterministic and cannot be manually approved.",
      state: "BLOCKED" as const,
      affectedCount: quantityDifferenceCount,
      humanActionRequired: true,
      blocker: true,
      actionLabel: "Review Quantity Authority",
      actionTarget: "CONSTITUTIONAL" as const,
      sourceGate: "constitutionalAssembly.quantityReconciliation",
    }] : []),
    ...(unresolvedConstraints.length ? [{
      id: "blocking-conditions",
      title: "Engineering Conditions",
      description: `${unresolvedConstraints.length.toLocaleString()} governed condition(s) require Engineering disposition.`,
      nextResult: "Accepted or resolved conditions clear the existing constraint gate without changing source evidence.",
      state: "ACTION REQUIRED" as const,
      affectedCount: unresolvedConstraints.length,
      humanActionRequired: true,
      blocker: true,
      actionLabel: "Review Conditions",
      actionTarget: "CONDITIONS" as const,
      sourceGate: "engineeringCertificationReady.constraints",
    }] : []),
  ];
  const eligibilityBlockers = approvalEligibility?.blockers.map((blocker) => `${blocker.predicate}: expected ${String(blocker.expected)}, resolved ${String(blocker.actual)}`) ?? [];
  const systemBlockers = [
    !sharedOpportunityMapProjection ? "Governed route authority could not be projected." : "",
    projectionFailure ? projectionFailure.message : "",
    engineeringReadinessReport.status === "FAIL" && !projectionFailure ? "Engineering Package integrity validation is blocked. Open Technical Details for the failing reference." : "",
    ...complianceBlockers.map((issue) => `${issue.title}: ${issue.humanReadableReason}`),
    ...eligibilityBlockers,
  ].filter(Boolean);
  const humanActionCount = requiredApprovals.filter((item) => item.blocker && item.humanActionRequired).length;
  const unresolvedApprovalCount = humanActionCount + systemBlockers.length;
  const engineeringReviewComplete = approvalEligibility?.approvalEligible === true;
  const exactEngineeringApprovalValid = Boolean(
    activeEngineeringApproval
    && approvalEligibility
    && activeEngineeringApproval.engineeringPackageId === renderEngineeringPackageId
    && activeEngineeringApproval.engineeringRevisionId === approvalEligibility.engineeringRevisionId
    && activeEngineeringApproval.engineeringRevisionHash === renderEngineeringRevisionHash
    && activeEngineeringApproval.reviewSummaryHash === approvalEligibility.reviewSummaryHash
  );
  const certificationReady = engineeringReviewComplete && exactEngineeringApprovalValid;
  const humanApprovalProgressState = exactEngineeringApprovalValid
    ? "APPROVED"
    : activeCertifiedPackage
      ? "LEGACY / NOT RECORDED"
      : engineeringReviewComplete
        ? "READY"
        : `BLOCKED${unresolvedApprovalCount ? ` — ${unresolvedApprovalCount} ACTION${unresolvedApprovalCount === 1 ? "" : "S"} REMAIN` : ""}`;

  return (
    <section className="engineering-review-shell">
      <EngineeringProjectionErrorBoundary resetKey={renderEngineeringPackageId}>
        <header className="engineering-review-header">
          <div>
            <span className="engineering-review-eyebrow">Engineering review</span>
            <h2>{projection.customer} · {String((renderDraft as Record<string, unknown>).routeName ?? renderDraft.packageName ?? "Opportunity Route")}</h2>
            <span>{projection.customer} · {renderEngineeringPackage?.opportunityId ?? renderDraft.opportunityId}</span>
          </div>
          <div className="engineering-review-header-metrics">
            <div><span>Customer</span><b>{projection.customer}</b></div>
            <div><span>Opportunity</span><b>{renderEngineeringPackage?.opportunityId ?? renderDraft.opportunityId}</b></div>
            <div><span>Product</span><b>{String((renderDraft as Record<string, unknown>).productName ?? projection.doctrineIdVersion)}</b></div>
            <div><span>Route</span><b>{String((renderDraft as Record<string, unknown>).routeName ?? "Governed Opportunity Route")}</b></div>
            <div><span>Route Length</span><b>{feet(projection.routeLength)}</b></div>
            <div><span>Engineering Package</span><b>{renderEngineeringPackageId}</b></div>
            <div><span>Revision</span><b>{renderEngineeringRevisionId === "Mirrors Package" ? "R1" : renderEngineeringRevisionId}</b></div>
            <div><span>Review Status</span><b>{humanActionCount ? `${humanActionCount} human action${humanActionCount === 1 ? "" : "s"} required` : systemBlockers.length ? "Blocked by package/system issue" : "Review complete"}</b></div>
            <div><span>Certification</span><b>{certificationReady ? "Ready" : "Blocked"}</b></div>
          </div>
          <label className="engineering-review-package-select">
            Package
            <select value={renderEngineeringPackageId} onChange={(event) => void openPackage(event.currentTarget.value)} disabled={pending}>
              {[renderDraft, ...queue.filter((item) => queueEngineeringPackageId(item) !== renderEngineeringPackageId)].map((item) => (
                <option key={queueEngineeringPackageId(item)} value={queueEngineeringPackageId(item)}>{item.packageName ?? queueEngineeringPackageId(item)}</option>
              ))}
            </select>
          </label>
        </header>

        <section className="engineering-approval-progress" aria-label="Engineering approval progress">
          {[
            ["Package Received", "COMPLETE", true],
            ["Engineering Review", !approvalEligibility ? "CHECKING" : approvalEligibility.reviewComplete ? "COMPLETE" : `${approvalEligibility.blockers.length} GOVERNED BLOCKER${approvalEligibility.blockers.length === 1 ? "" : "S"}`, approvalEligibility?.reviewComplete === true],
            ["Human Approval", humanApprovalProgressState, exactEngineeringApprovalValid],
            ["IOF Certification", certificationReady ? "READY" : "BLOCKED", Boolean(activeCertifiedPackage)],
          ].map(([label, state, complete], index) => (
            <div key={String(label)} className={complete ? "complete" : index === 1 && unresolvedApprovalCount ? "current" : "future"}>
              <span>{index + 1}</span><b>{label}</b><small>{state}</small>
            </div>
          ))}
        </section>

        <section className="engineering-action-inbox" aria-label="Required Engineering Actions">
          <div className="dal-panel-title-row">
            <div><span className="engineering-review-eyebrow">Review &amp; resolve</span><h3>Required Engineering Actions</h3><small>Only decisions that require Engineering judgment appear here.</small></div>
            <b className={`engineering-action-count ${humanActionCount ? "warning" : "pass"}`}>{humanActionCount} HUMAN ACTION{humanActionCount === 1 ? "" : "S"}</b>
          </div>
          <div className="engineering-action-list">
            {requiredApprovals.map((item, index) => (
              <button type="button" key={item.id} className={activeReviewSurface === item.actionTarget ? "active" : undefined} onClick={() => setActiveReviewSurface(item.actionTarget)}>
                <span className="engineering-action-index">{index + 1}</span>
                <span><b>{item.title}</b><small>{item.description}</small></span>
                <span className={`dal-badge ${item.state === "BLOCKED" ? "fail" : "warning"}`}>{item.state}</span>
                <strong>{item.actionLabel} →</strong>
              </button>
            ))}
            {!humanActionCount ? <div className="engineering-action-empty"><b>No Engineering decisions are currently pending</b><span>Derived validations and package issues are tracked separately below.</span></div> : null}
          </div>
          {waitingSystemIssues.length ? <div className="engineering-waiting-system"><b>Waiting on System</b>{waitingSystemIssues.map((issue) => <span key={issue.issueId}>{issue.title} — {issue.resolutionAction}</span>)}</div> : null}
          {systemBlockers.length ? <div className="engineering-package-issues"><b>Package Issue</b><span>Engineering cannot approve until the responsible authority corrects the following issue.</span>{systemBlockers.map((message, index) => <button type="button" key={`system-${index}`} onClick={() => setActiveReviewSurface("FINAL")}><span>{message}</span><strong>Owner: {complianceBlockers[index]?.resolutionOwner ?? "SYSTEM"}</strong></button>)}</div> : null}
        </section>

        {blockerLabels.length ? (
          <div className="engineering-review-blocker-banner" role="alert">
            <b>{blockerLabels.length} certification blocker{blockerLabels.length === 1 ? "" : "s"}</b>
            <span>{blockerLabels.join(" · ")}</span>
          </div>
        ) : null}

        <div className={`engineering-review-workspace ${activeReviewSurface === "MAP" || activeReviewSurface === "CONDITIONS" ? "map-context" : "focused-context"}`}>
          <nav className="engineering-review-navigator engineering-review-toolbar" aria-label="Engineering review navigator">
            <label className="engineering-review-surface-select">
              <span>Review Workspace</span>
              <select value={activeReviewSurface} onChange={(event) => setActiveReviewSurface(event.currentTarget.value as EngineeringReviewSurface)} aria-label="Review workspace">
                <option value="MAP">Opportunity Map · Route context</option>
                <option value="BUDGET">Budget · {engineeringBudgetApproved ? "Approved" : "Action required"}</option>
                <option value="QUANTITIES">Quantities · {quantityReconciliationReady ? "Ready" : "Action required"}</option>
                <option value="COMPLIANCE">Compliance · {complianceBlockers.length ? `${complianceBlockers.length} package issues` : "Ready"}</option>
                <option value="CONDITIONS">Conditions · {openConditions.length ? `${openConditions.length} open` : "Ready"}</option>
                <option value="FINAL">Final Review · {!approvalEligibility ? "Checking" : approvalEligibility.approvalEligible ? "Ready" : `${approvalEligibility.blockers.length} remaining`}</option>
              </select>
            </label>
            <details className="engineering-tools-menu"><summary>Engineering Tools</summary><button type="button" onClick={() => setActiveReviewSurface("MAP")}>Identify Condition</button><button type="button" onClick={() => setActiveReviewSurface("MAP")}>Object Review / Move</button><button type="button" onClick={() => setActiveReviewSurface("MAP")}>Route Review / Redline</button><button type="button" onClick={openStationReview} disabled={!canWrite || pending || !engineeringReadinessReport.readyForStationPlanning}>Station Review</button><button type="button" onClick={() => setActiveReviewSurface("COMPLIANCE")}>Doctrine Exception</button></details>
            <details className="engineering-tools-menu"><summary>More Actions</summary><label>Commercial revision reason<input value={commercialRevisionReason} onChange={(event) => setCommercialRevisionReason(event.currentTarget.value)} /></label><button type="button" onClick={requestCommercialRevision} disabled={!canWrite || pending || !commercialRevisionReason.trim()}>Request Commercial Revision</button><button type="button" onClick={() => { const details = document.querySelector<HTMLDetailsElement>(".engineering-review-diagnostics"); if (details) { details.open = true; details.scrollIntoView({ behavior: "smooth", block: "start" }); } }}>Technical Details</button></details>
          </nav>

          <main className="engineering-review-canvas" id="engineering-route">
            {activeReviewSurface === "BUDGET" ? (
              <section className="engineering-focused-review" aria-label="Focused Engineering Budget Review">
                <div className="dal-panel-title-row"><div><span className="engineering-review-eyebrow">Action item</span><h3>Engineering Budget</h3><small>Approve only the Commercial baseline and changes affected by governed Engineering decisions.</small></div><span className={`dal-badge ${engineeringBudgetApproved ? "pass" : "warning"}`}>{engineeringBudgetApproved ? "APPROVED" : "ACTION REQUIRED"}</span></div>
                <div className="engineering-budget-summary"><span>Commercial Baseline<b>{money(commercialBudgetBaseline)}</b></span><span>Engineering Changes<b>{budgetRowsForReview.length}</b></span><span>Engineering Adjustment<b>{money(engineeringApprovedBudgetTotal - commercialBudgetBaseline)}</b></span><span>Reconciled Engineering Budget<b>{money(engineeringApprovedBudgetTotal)}</b></span></div>
                {budgetRowsForReview.length ? <div className="engineering-certification-budget-table">{budgetRowsForReview.map((row, index) => <div key={`${row.objectId}:${index}`}><b>{row.objectType}</b><small>{row.objectId}</small><small>{row.stationReference || row.stationRange || "Station pending"}</small><span>{money(row.commercialBudget)}</span><input type="number" min="0" value={row.engineeringApprovedBudget} onChange={(event) => updateEngineeringBudgetRow(row.objectId, { engineeringApprovedBudget: numeric(event.currentTarget.value) })} aria-label={`Engineering approved budget for ${row.objectId}`} /><label className="engineering-certification-confirm-row"><input type="checkbox" checked={row.confirmed} onChange={(event) => updateEngineeringBudgetRow(row.objectId, { confirmed: event.currentTarget.checked })} />Confirm</label></div>)}</div> : <div className="dal-status">No Engineering decision changes the Commercial baseline. One package-level approval clears this existing gate.</div>}
                <div className="engineering-focused-next"><b>After approval</b><span>The Engineering budget gate becomes approved; unchanged projected objects do not become individual approvals.</span><button type="button" className="engineering-certification-primary" onClick={approveEngineeringBudget} disabled={!canWrite || pending || !allObjectBudgetsConfirmed || engineeringBudgetApproved}>{engineeringBudgetApproved ? "Engineering Budget Approved" : "Approve Engineering Budget"}</button></div>
              </section>
            ) : null}
            {activeReviewSurface === "QUANTITIES" || activeReviewSurface === "CONSTITUTIONAL" ? (
              <section className="engineering-focused-review flush" aria-label="Focused Quantity Review">
                <div className="dal-panel-title-row"><div><span className="engineering-review-eyebrow">Action item</span><h3>{activeReviewSurface === "CONSTITUTIONAL" ? "Constitutional Quantity Review" : "Quantity Reconciliation"}</h3><small>Use the existing reconciliation disposition authority. Constitutional Assembly recalculates; it is not manually approved.</small></div><span className={`dal-badge ${quantityReconciliationReady && constitutionalQuantityGateReady ? "pass" : "warning"}`}>{quantityReconciliationReady && constitutionalQuantityGateReady ? "RESOLVED" : "ACTION REQUIRED"}</span></div>
                <EngineeringQuantityReconciliationPanel draftPackage={renderDraft as unknown as Record<string, unknown>} reviewer={currentUserName} canWrite={canWrite} constitutionalAssemblyStatus={constitutionalReview.status} engineeringConstraintCount={projection.constraints.length} onChange={bindQuantityReconciliation} onRequestCommercialRevision={(reason) => { setCommercialRevisionReason(reason); setNotice("Quantity disposition recorded. Request Commercial Revision remains available under More Actions."); }} />
              </section>
            ) : null}
            {activeReviewSurface === "COMPLIANCE" ? (
              <section className="engineering-focused-review" aria-label="Focused Compliance Review">
                <div className="dal-panel-title-row"><div><span className="engineering-review-eyebrow">Derived validation</span><h3>Compliance</h3><small>System and package issues are not Engineering decisions and cannot be cleared with an exception.</small></div><span className={`dal-badge ${complianceBlockers.length ? "fail" : "pass"}`}>{complianceBlockers.length ? `${complianceBlockers.length} PACKAGE ISSUE${complianceBlockers.length === 1 ? "" : "S"}` : "PASS"}</span></div>
                <div className="engineering-compliance-action-list">{complianceBlockers.map((issue) => <div key={issue.issueId}><b>{issue.title}</b><span>{issue.humanReadableReason}</span><small>{issue.classification} · Owner: {issue.resolutionOwner}</small><span className="dal-badge fail">BLOCKED</span></div>)}{!complianceBlockers.length ? <div className="dal-status pass">All required compliance validations pass. No doctrine exception is required.</div> : null}</div>
                {projection.constraints.length ? <details className="engineering-context-action"><summary>Record Doctrine Exception for an actual Engineering deviation</summary><label>Rule<input value={exceptionRule} onChange={(event) => setExceptionRule(event.currentTarget.value)} /></label><label>Actual condition<input value={exceptionCondition} onChange={(event) => setExceptionCondition(event.currentTarget.value)} /></label><textarea value={exceptionReason} onChange={(event) => setExceptionReason(event.currentTarget.value)} placeholder="Exception reason" /><textarea value={exceptionImpact} onChange={(event) => setExceptionImpact(event.currentTarget.value)} placeholder="Impact summary" /><button type="button" onClick={recordException} disabled={!canWrite || pending}>Record Doctrine Exception</button></details> : null}
              </section>
            ) : null}
            {activeReviewSurface === "CONDITIONS" ? (
              <section className="engineering-focused-review" aria-label="Focused Engineering Condition Review">
                <div className="dal-panel-title-row"><div><span className="engineering-review-eyebrow">Action item</span><h3>Engineering Conditions</h3><small>Select a governed condition, then determine its disposition in the contextual approval panel.</small></div><span className={`dal-badge ${openConditions.length ? "warning" : "pass"}`}>{openConditions.length ? `${openConditions.length} ACTION REQUIRED` : "RESOLVED"}</span></div>
                <div className="engineering-condition-table" role="table" aria-label="Focused Engineering condition queue">{projection.constraints.map((condition) => <button type="button" role="row" className={reviewSelection?.kind === "Constraint" && reviewSelection.id === condition.constraintId ? "active-toggle" : undefined} key={condition.constraintId} onClick={() => setReviewSelection({ kind: "Constraint", id: condition.constraintId })}><span><b>{condition.conditionTitle}</b><small>{condition.objectReference || "Route-level"}</small></span><span>{condition.station || condition.stationRange || "Route"}</span><span>{condition.humanClassification}</span><span>{condition.humanSeverity}</span><span className={`dal-badge ${["RESOLVED", "ACCEPTED"].includes(condition.status) ? "pass" : condition.humanSeverity === "BLOCKING" ? "fail" : "warning"}`}>{condition.status}</span></button>)}</div>
              </section>
            ) : null}
            {activeReviewSurface === "FINAL" ? (
              <section className="engineering-focused-review engineering-final-approval" aria-label="Final Engineering Review">
                <div className="dal-panel-title-row"><div><span className="engineering-review-eyebrow">Completion</span><h3>{activeCertifiedPackage ? "IOF Package Certified" : "Final Engineering Review"}</h3><small>{activeCertifiedPackage ? "Certification completed through the existing Certification Ledger path." : "One concise interpretation of current governed readiness."}</small></div><span className={`dal-badge ${activeCertifiedPackage || certificationReady ? "pass" : "fail"}`}>{activeCertifiedPackage ? "CERTIFIED" : certificationReady ? "READY FOR CERTIFICATION" : "CERTIFICATION BLOCKED"}</span></div>
                <div className="engineering-final-review-grid"><span>Route Authority<b>{sharedOpportunityMapProjection ? "READY" : "BLOCKED"}</b></span><span>Quantities<b>{quantityReconciliationReady ? "PASS" : "ACTION REQUIRED"}</b></span><span>Engineering Budget<b>{engineeringBudgetApproved ? "APPROVED" : "ACTION REQUIRED"}</b></span><span>Blocking Conditions<b>{openConditions.length}</b></span><span>Compliance<b>{complianceBlockers.length ? `${complianceBlockers.length} PACKAGE ISSUE${complianceBlockers.length === 1 ? "" : "S"}` : "PASS"}</b></span><span>System Integrity<b>{systemBlockers.length ? "BLOCKED" : "PASS"}</b></span></div>
                {blockerLabels.length ? <div className="engineering-final-blockers"><b>{blockerLabels.length} existing gate{blockerLabels.length === 1 ? "" : "s"} remain</b>{blockerLabels.map((blocker) => <span key={blocker}>{blocker}</span>)}</div> : null}
                {!activeCertifiedPackage && !engineeringReviewComplete ? <div className="engineering-authority-gap" role="status"><b>Human Engineering Approval Blocked</b><span>Resolve the governed Engineering actions above. No approval action is available until Engineering Review Complete is derived.</span></div> : null}
                {!activeCertifiedPackage && engineeringReviewComplete && !exactEngineeringApprovalValid && approvalEligibility ? <div className="engineering-human-approval-ready"><b>Human Engineering Approval</b><span>The server-authoritative eligibility contract confirms that this exact Engineering Revision has satisfied every governed review gate.</span><div className="engineering-approval-authority-summary"><span>Engineering Package<b>{approvalEligibility.engineeringPackageId}</b></span><span>Engineering Revision<b>{approvalEligibility.engineeringRevisionId}</b></span><span>Revision Hash<b>{approvalEligibility.engineeringRevisionHash}</b></span><span>Review Summary Hash<b>{approvalEligibility.reviewSummaryHash}</b></span><span>Draft IOF Package<b>{approvalEligibility.draftIofPackageId}</b></span><span>Customer<b>{projection.customer}</b></span><span>Opportunity<b>{approvalEligibility.opportunityId}</b></span><span>Route<b>{sharedOpportunityMapProjection?.routeRepositoryId ?? "Unavailable"}</b></span></div><p>I approve this Engineering Revision as the Engineering basis for IOF Certification.</p><button type="button" className="engineering-certification-primary" onClick={() => { setApprovalFailure(null); setApprovalConfirmOpen(true); }} disabled={!canWrite || pending}>Approve Engineering Revision</button></div> : null}
                {!activeCertifiedPackage && exactEngineeringApprovalValid ? <div className="engineering-human-approved"><b>✓ ENGINEERING APPROVED</b><span>Engineering Revision: {activeEngineeringApproval?.engineeringRevisionId}</span><span>Approved by: {activeEngineeringApproval?.approvedBy}</span><span>Approved at: {activeEngineeringApproval?.approvedAt}</span><span>Approval: {activeEngineeringApproval?.approvalId}</span></div> : null}
                {activeCertifiedPackage ? <div className="engineering-certified-success"><b>✓ IOF PACKAGE CERTIFIED</b><span>Certified IOF Package: {activeCertifiedPackage.certifiedPackageId}</span><span>Engineering Revision: {String(asRecord(activeCertifiedPackage).engineeringRevisionId ?? renderEngineeringRevisionId)}</span><span>Engineering Approval: {String(asRecord(activeCertifiedPackage).engineeringApprovalId ?? "LEGACY / NOT RECORDED")}</span><span>Certification Ledger: {String(asRecord(activeCertifiedPackage).certificationLedgerId ?? "Recorded")}</span><span>Certified by {String(asRecord(activeCertifiedPackage).certifiedBy ?? currentUserName)}</span><span>Certified at {String(asRecord(activeCertifiedPackage).certifiedAt ?? "Recorded in Certification Ledger")}</span><span>Twin: CERTIFIED · Execution: NOT AUTHORIZED</span><span>Service Order: not created · ScopeVersion: not created</span><button type="button" onClick={() => setWorkspace("twin")}>View IOF Twin</button></div> : exactEngineeringApprovalValid ? <><div className="dal-status pass"><b>Ready for IOF Certification</b><span>Exact Human Engineering Approval and all existing certification gates are valid.</span></div><label>Certification notes<textarea value={certificationNotes} onChange={(event) => setCertificationNotes(event.currentTarget.value)} /></label><button type="button" className="engineering-certification-primary" onClick={certifyPackage} disabled={!canWrite || pending || !certificationReady}>Certify IOF Package</button></> : null}
                {approvalConfirmOpen ? <div className="engineering-approval-confirm-backdrop" role="presentation"><section className={`engineering-approval-confirm ${approvalFailure ? "failed" : ""}`} role="dialog" aria-modal="true" aria-labelledby="engineering-approval-confirm-title"><span className="engineering-review-eyebrow">Human authority</span><h3 id="engineering-approval-confirm-title">{approvalFailure ? "Approval Cannot Be Completed" : "Approve Engineering Revision"}</h3>{approvalFailure ? <><p>Engineering state changed or a governed requirement is unresolved.</p><div className="engineering-approval-failure"><b>{approvalFailure.failedPredicate}</b><span>{approvalFailure.message}</span><dl><div><dt>Expected</dt><dd>{String(approvalFailure.expectedValue)}</dd></div><div><dt>Resolved</dt><dd>{String(approvalFailure.actualValue)}</dd></div></dl><details><summary>Technical Details</summary><span>Error code: {approvalFailure.code}</span><span>Source authority: {approvalFailure.sourceAuthority}</span></details></div><div><button type="button" onClick={() => { setApprovalConfirmOpen(false); setApprovalFailure(null); setActiveReviewSurface("MAP"); }} disabled={pending}>Return to Review</button><button type="button" className="engineering-certification-primary" onClick={() => { setPending(true); void refreshApprovalEligibility().then(() => { setApprovalFailure(null); setNotice("Engineering Approval eligibility refreshed from governed server authority."); }).catch((error) => setNotice(`Refresh Package State failed: ${error instanceof Error ? error.message : String(error)}`)).finally(() => setPending(false)); }} disabled={pending}>Refresh Package State</button></div></> : <><dl><div><dt>Revision</dt><dd>{approvalEligibility?.engineeringRevisionId}</dd></div><div><dt>Revision hash</dt><dd>{approvalEligibility?.engineeringRevisionHash}</dd></div><div><dt>Review hash</dt><dd>{approvalEligibility?.reviewSummaryHash}</dd></div><div><dt>Package</dt><dd>{approvalEligibility?.engineeringPackageId}</dd></div></dl><p>This approval confirms that the Engineering review is complete and that this exact Engineering Revision is accepted for IOF certification.</p><div><button type="button" onClick={() => setApprovalConfirmOpen(false)} disabled={pending}>Cancel</button><button type="button" className="engineering-certification-primary" onClick={approveCurrentEngineeringRevision} disabled={!canWrite || pending || !engineeringReviewComplete || !approvalEligibility}>Approve Engineering Revision</button></div></>}</section></div> : null}
              </section>
            ) : null}
            <div hidden={activeReviewSurface !== "MAP"}>
            <div className="engineering-review-canvas-toolbar">
              <div>
                <h3>Opportunity Map</h3>
                <span>{sharedOpportunityMapProjection ? `Commercial Route Repository · revision ${sharedOpportunityMapProjection.routeRevision} · ${sharedOpportunityMapProjection.orientation}` : "Governed route projection unavailable"}</span>
              </div>
            </div>
            <div className="engineering-review-lenses" aria-label="Discipline view context">
              {DISCIPLINE_LENSES.map((lens) => (
                <button type="button" key={lens.key} className={disciplineLens === lens.key ? "active-toggle" : undefined} onClick={() => setDisciplineLens(lens.key)}>{lens.label}</button>
              ))}
              <span>View context only · {activeLens.detail}</span>
            </div>
            {engineeringMapSpecs.length ? (
              <MapKernel
                specs={engineeringMapSpecs}
                initialMode="geographic"
                initialBaseLayer="hybrid"
                stationDensityFeet={0}
                showStationLabels
                height={620}
                presentationProfile="engineeringReview"
                presentationContext="ENGINEERING_REVIEW"
                selectedFeatureId={reviewSelection?.id ?? selectedObjectId}
                focusFeatureId={focusFeatureId}
                onSelectionChange={(selection) => {
                  const id = selection?.featureRef.objectId ?? selection?.featureRef.stationId ?? selection?.featureRef.id ?? "";
                  const kind = selection?.featureRef.kind ?? "";
                  setReviewSelection(id ? { kind, id } : null);
                  setFocusFeatureId("");
                  if (projection.objects.some((object) => object.objectId === id)) setSelectedObjectId(id);
                }}
              />
            ) : <div className="dal-status warning">The map is blocked until the governed Commercial Route Repository projection is available. Engineering overlays were not rendered against fallback geometry.</div>}
            </div>
          </main>

          <aside className="engineering-review-inspector" aria-label="Selection inspector" hidden={activeReviewSurface !== "MAP" && activeReviewSurface !== "CONDITIONS"}>
            <div className="dal-panel-title-row">
              <div><h3>Inspector</h3><span>Select the route, a station, object, or constraint.</span></div>
              <span className="dal-badge warning">{reviewSelection?.kind ?? (selectedObject ? "Object" : "None")}</span>
            </div>
            {selectedStationForReview ? (
              <div className="engineering-certification-kv">
                <span>station</span><b>{selectedStationForReview.label}</b>
                <span>measure</span><b>{feet(selectedStationForReview.stationFeet)}</b>
                <span>coordinate</span><b>{coordinateLabel(selectedStationForReview.coordinate)}</b>
              </div>
            ) : selectedConstraintForReview ? (
              <>
                <div className="engineering-inspector-identity"><span>Engineering condition</span><h4>{selectedConstraintForReview.conditionTitle}</h4><b className={`dal-badge ${["RESOLVED", "ACCEPTED"].includes(selectedConstraintForReview.status) ? "pass" : selectedConstraintForReview.humanSeverity === "BLOCKING" ? "fail" : "warning"}`}>{selectedConstraintForReview.status}</b></div>
                <div className="engineering-certification-kv">
                  <span>classification</span><b>{selectedConstraintForReview.humanClassification}</b>
                  <span>severity</span><b>{selectedConstraintForReview.humanSeverity}</b>
                  <span>station</span><b>{selectedConstraintForReview.station || selectedConstraintForReview.stationRange || "Route-level"}</b>
                  <span>object</span><b>{selectedConstraintForReview.objectReference || "None"}</b>
                  <span>disposition</span><b>{selectedConstraintForReview.engineeringDisposition.replaceAll("_", " ")}</b>
                  <span>notes</span><b>{selectedConstraintForReview.notesEvidence || "None"}</b>
                </div>
              </>
            ) : reviewSelection?.kind === "Route" ? (
              <div className="engineering-certification-kv">
                <span>route repository</span><b>{sharedOpportunityMapProjection?.routeRepositoryId}</b>
                <span>geometry id</span><b>{sharedOpportunityMapProjection?.routeGeometryId}</b>
                <span>geometry hash</span><b>{sharedOpportunityMapProjection?.geometryHash}</b>
                <span>orientation</span><b>{sharedOpportunityMapProjection?.orientation}</b>
              </div>
            ) : selectedObject ? (
              <>
                <select value={selectedObject.objectId} onChange={(event) => { setSelectedObjectId(event.currentTarget.value); setReviewSelection({ kind: "Object", id: event.currentTarget.value }); }} aria-label="Selected object">
                  {projection.objects.map((object) => <option key={object.objectId} value={object.objectId}>{object.objectType} / {object.objectId}</option>)}
                </select>
                <div className="engineering-inspector-identity"><span>Selected object</span><h4>{selectedObject.objectType.replaceAll("_", " ")}</h4><b className="dal-badge warning">PROPOSED</b></div>
                <div className="engineering-certification-kv">
                  <span>station</span><b>{selectedObject.station || selectedObject.stationRange || "n/a"}</b>
                  <span>coordinate</span><b>{coordinateLabel(selectedObject.coordinate)}</b>
                  <span>status</span><b>Proposed / not excepted</b>
                  <span>doctrine</span><b>{projection.doctrineIdVersion}</b>
                  <span>construction</span><b>{selectedObject.constructionMethod}</b>
                  <span>budget</span><b>{money(selectedObjectBudget?.engineeringApprovedBudget ?? selectedObjectBudget?.commercialBudget ?? 0)}</b>
                  <span>conditions</span><b>{selectedObjectOpenConditionCount} open</b>
                </div>
                <details className="engineering-technical-details"><summary>View technical details</summary><div className="engineering-certification-kv"><span>object ID</span><b>{selectedObject.objectId}</b><span>parent reference</span><b>{selectedObject.parentReference || "n/a"}</b><span>dependencies</span><b>{stringList(selectedObject.dependencies).join(", ") || "n/a"}</b><span>quantity impact</span><b>{selectedObject.quantityImpact}</b><span>current authority</span><b>{selectedObject.currentAuthority || "Commercial"}</b><span>audit status</span><b>{selectedObject.auditStatus || "Open"}</b></div></details>
              </>
            ) : <div className="dal-status">Nothing selected.</div>}

            <details className="engineering-context-action engineering-identify-condition">
              <summary>Identify Condition</summary>
              <div className="engineering-condition-context"><span>{conditionSelectionContext?.selectionKind} · {conditionSelectionContext?.station || conditionSelectionContext?.endpointRole || "Route context"}</span>{conditionSelectionContext?.objectId ? <b>{conditionSelectionContext.objectType} / {conditionSelectionContext.objectId}</b> : null}</div>
              <label>Condition<input value={conditionTitle} onChange={(event) => setConditionTitle(event.currentTarget.value)} placeholder="Short human-readable condition" /></label>
              <label>Classification<select value={conditionClassification} onChange={(event) => setConditionClassification(event.currentTarget.value as EngineeringConditionClassification)}>{ENGINEERING_CONDITION_CLASSIFICATIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Severity<select value={conditionSeverity} onChange={(event) => setConditionSeverity(event.currentTarget.value as EngineeringConditionHumanSeverity)}><option>INFO</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>BLOCKING</option></select></label>
              <textarea value={constraintNotes} onChange={(event) => setConstraintNotes(event.currentTarget.value)} placeholder="Observation / evidence" />
              <button type="button" onClick={addConstraint} disabled={!canWrite || pending || !conditionSelectionContext}>Add Engineering Condition</button>
            </details>

            {selectedConstraintForReview && !["RESOLVED", "ACCEPTED"].includes(selectedConstraintForReview.status) ? (
              <section className="engineering-condition-disposition">
                <h4>Determine Disposition</h4>
                <textarea value={conditionDispositionReason} onChange={(event) => setConditionDispositionReason(event.currentTarget.value)} placeholder="Engineering decision reason" />
                <textarea value={conditionImpactSummary} onChange={(event) => setConditionImpactSummary(event.currentTarget.value)} placeholder="Impact summary" />
                <button type="button" onClick={() => void dispositionCondition("ACCEPTED", "ACCEPT")} disabled={!canWrite || pending}>Accept Proposed Design</button>
                <button type="button" onClick={() => void dispositionCondition("RESOLVED", "ENGINEERING_CHANGE")} disabled={!canWrite || pending}>Resolve After Engineering Change</button>
                <button type="button" onClick={() => void dispositionCondition("RESOLVED", "DOCTRINE_EXCEPTION")} disabled={!canWrite || pending}>Resolve With Doctrine Exception</button>
                <button type="button" className="secondary" onClick={() => { const context = selectedConstraintForReview.conditionContext; setCommercialRevisionReason([selectedConstraintForReview.conditionTitle, conditionDispositionReason || selectedConstraintForReview.notesEvidence, `Engineering Package ${firstText(context.engineeringPackageId, renderEngineeringPackageId)}`, `Engineering Revision ${firstText(context.engineeringRevisionId, renderEngineeringRevisionId)}`, `Condition ${selectedConstraintForReview.constraintId}`, `Station ${selectedConstraintForReview.station || "route-level"}`, `Object ${selectedConstraintForReview.objectReference || "none"}`, conditionImpactSummary ? `Impact ${conditionImpactSummary}` : ""].filter(Boolean).join(" · ")); setNotice("Condition context prepared for the existing Request Commercial Revision path."); }}>Commercial Revision Required</button>
              </section>
            ) : null}

            <details className="engineering-context-action" open={reviewSelection?.kind === "Object"}>
              <summary>Move selected object</summary>
              <label>New station<select value={moveStation} onChange={(event) => setMoveStation(event.currentTarget.value)}>{projection.stations.map((station) => <option key={station.stationId} value={station.stationId}>{station.label}</option>)}</select></label>
              <label>Reason<input value={moveReason} onChange={(event) => setMoveReason(event.currentTarget.value)} /></label>
              <label>Authority<input value={moveAuthority} onChange={(event) => setMoveAuthority(event.currentTarget.value)} /></label>
              <button type="button" onClick={moveObject} disabled={!canWrite || pending || !selectedObject?.movable}>Move Object</button>
            </details>
            <details className="engineering-context-action" open={reviewSelection?.kind === "Route"}>
              <summary>Route redline</summary>
              <label>Reason<input value={redlineReason} onChange={(event) => setRedlineReason(event.currentTarget.value)} /></label>
              <textarea value={redlineDescription} onChange={(event) => setRedlineDescription(event.currentTarget.value)} placeholder="Route redline description" />
              <button type="button" onClick={createRedline} disabled={!canWrite || pending}>Create Route Redline</button>
            </details>
            <details className="engineering-context-action">
              <summary>Doctrine exception</summary>
              <label>Rule<input value={exceptionRule} onChange={(event) => setExceptionRule(event.currentTarget.value)} /></label>
              <label>Actual condition<input value={exceptionCondition} onChange={(event) => setExceptionCondition(event.currentTarget.value)} /></label>
              <textarea value={exceptionReason} onChange={(event) => setExceptionReason(event.currentTarget.value)} placeholder="Exception reason" />
              <textarea value={exceptionImpact} onChange={(event) => setExceptionImpact(event.currentTarget.value)} placeholder="Impact summary" />
              <button type="button" onClick={recordException} disabled={!canWrite || pending}>Record Doctrine Exception</button>
            </details>
          </aside>
        </div>

        <section className="engineering-review-section" id="engineering-conditions">
          <div className="dal-panel-title-row"><div><h3>Condition Queue</h3><span>One synchronized view of governed Engineering constraints requiring human attention.</span></div><span className={`dal-badge ${openConditions.length ? "warning" : "pass"}`}>{openConditions.length} OPEN</span></div>
          <div className="engineering-condition-table" role="table" aria-label="Engineering condition queue">
            <div className="engineering-condition-table-head" role="row"><b>Condition</b><b>Station</b><b>Category</b><b>Severity</b><b>Status</b></div>
            {projection.constraints.map((condition) => (
              <button type="button" role="row" className={reviewSelection?.kind === "Constraint" && reviewSelection.id === condition.constraintId ? "active-toggle" : undefined} key={condition.constraintId} onClick={() => setReviewSelection({ kind: "Constraint", id: condition.constraintId })}>
                <span><b>{condition.conditionTitle}</b><small>{condition.objectReference || "Route-level"}</small></span><span>{condition.station || condition.stationRange || "Route"}</span><span>{condition.humanClassification}</span><span>{condition.humanSeverity}</span><span className={`dal-badge ${["RESOLVED", "ACCEPTED"].includes(condition.status) ? "pass" : condition.humanSeverity === "BLOCKING" ? "fail" : "warning"}`}>{condition.status}</span>
              </button>
            ))}
            {!projection.constraints.length ? <div className="dal-status">No human-identified Engineering conditions. Proposed objects remain proposed and do not require individual approval.</div> : null}
          </div>
        </section>

        <section className="engineering-review-section" id="engineering-stations">
          <div className="dal-panel-title-row"><div><h3>Stations</h3><span>Review the persisted station graph and object assignments.</span></div><span className={`dal-badge ${manualStationPlan ? "pass" : "warning"}`}>{manualStationPlan ? "OPEN" : "LOCKED"}</span></div>
          <div className="engineering-review-card-grid">
            {projection.stations.filter((_, index) => index === 0 || index === projection.stations.length - 1 || index % Math.max(1, Math.floor(projection.stations.length / 12)) === 0).map((station) => (
              <button type="button" key={station.stationId} onClick={() => { setReviewSelection({ kind: "Station", id: station.stationId }); setFocusFeatureId(station.stationId); document.getElementById("engineering-route")?.scrollIntoView({ behavior: "smooth" }); }}><b>{station.label}</b><span>{coordinateLabel(station.coordinate)}</span></button>
            ))}
          </div>
        </section>

        <section id="engineering-quantities" className="engineering-review-section flush">
          <EngineeringQuantityReconciliationPanel
            draftPackage={renderDraft as unknown as Record<string, unknown>}
            reviewer={currentUserName}
            canWrite={canWrite}
            constitutionalAssemblyStatus={evaluateConstitutionalAssemblyReview(renderDraft).status}
            engineeringConstraintCount={projection.constraints.length}
            onChange={bindQuantityReconciliation}
            onRequestCommercialRevision={(reason) => { setCommercialRevisionReason(reason); setNotice("Quantity disposition recorded. Use Request Commercial Revision to return the governed Draft IOF Package with this reason."); }}
          />
        </section>

        <section className="engineering-review-section" id="engineering-budget">
          <div className="dal-panel-title-row"><div><h3>Engineering Budget</h3><span>Review financial consequences of Engineering decisions; unchanged proposed objects require no individual acknowledgement.</span></div><span className={`dal-badge ${engineeringBudgetApproved ? "pass" : "warning"}`}>{engineeringBudgetApproved ? "APPROVED" : "PENDING"}</span></div>
          <div className="engineering-budget-summary">
            <span>Commercial Baseline<b>{money(commercialBudgetBaseline)}</b></span><span>Engineering Changes<b>{budgetRowsForReview.length}</b></span><span>Engineering Adjustment<b>{money(engineeringApprovedBudgetTotal - commercialBudgetBaseline)}</b></span><span>Reconciled Engineering Budget<b>{money(engineeringApprovedBudgetTotal)}</b></span>
          </div>
          {budgetRowsForReview.length ? <div className="engineering-certification-budget-table">
            {budgetRowsForReview.map((row, index) => (
              <div key={`${row.objectId}:${index}`}><b>{row.objectType}</b><small>{row.objectId}</small><small>{row.stationReference || row.stationRange || "Station pending"}</small><span>{money(row.commercialBudget)}</span><input type="number" min="0" value={row.engineeringApprovedBudget} onChange={(event) => updateEngineeringBudgetRow(row.objectId, { engineeringApprovedBudget: numeric(event.currentTarget.value) })} aria-label={`Engineering approved budget for ${row.objectId}`} /><label className="engineering-certification-confirm-row"><input type="checkbox" checked={row.confirmed} onChange={(event) => updateEngineeringBudgetRow(row.objectId, { confirmed: event.currentTarget.checked })} />Confirm</label></div>
            ))}
          </div> : <div className="dal-status">No Engineering decision currently changes the Commercial budget baseline.</div>}
          <textarea value={engineeringBudgetRows.find((row) => row.objectId === selectedObjectId)?.notes ?? ""} onChange={(event) => updateEngineeringBudgetRow(selectedObjectId, { notes: event.currentTarget.value })} placeholder="Selected object budget notes" disabled={!selectedObjectId} />
          <div className="dal-actions"><button type="button" onClick={approveEngineeringBudget} disabled={!canWrite || pending || !allObjectBudgetsConfirmed}>Approve Engineering Budget</button></div>
        </section>

        <section className="engineering-review-section" id="engineering-final">
          <div className="dal-panel-title-row"><div><h3>Engineering Final Review</h3><span>Concise package-level human certification summary from existing governed state.</span></div><span className={`dal-badge ${readyForHumanCertification ? "pass" : "fail"}`}>{readyForHumanCertification ? "READY FOR HUMAN CERTIFICATION" : "CERTIFICATION BLOCKED"}</span></div>
          <div className="engineering-final-review-grid">
            <span>Route<b className={`dal-badge ${sharedOpportunityMapProjection ? "pass" : "fail"}`}>{sharedOpportunityMapProjection ? "PASS" : "FAIL"}</b></span>
            <span>Open Conditions<b>{openConditions.length}</b></span>
            <span>Engineering Changes<b>{engineeringRevisionProjection.diagnostics.activePatchCount}</b></span>
            <span>Doctrine Exceptions<b>{doctrineExceptionCount} accepted</b></span>
            <span>Quantity Differences<b>{quantityDifferenceCount} unresolved</b></span>
            <span>Engineering Budget<b>{engineeringBudgetApproved ? "Approved" : "Pending"}</b></span>
            <span>Repository Integrity<b>{engineeringReadinessReport.status}</b></span>
            <span>Certification Readiness<b>{readyForHumanCertification ? "READY" : "BLOCKED"}</b></span>
          </div>
          {blockerLabels.length ? <div className="engineering-final-blockers"><b>{blockerLabels.length} item{blockerLabels.length === 1 ? "" : "s"} require resolution</b>{blockerLabels.map((blocker) => <span key={blocker}>{blocker}</span>)}</div> : null}
          <label>Certification notes<textarea value={certificationNotes} onChange={(event) => setCertificationNotes(event.currentTarget.value)} /></label>
          <label>Restore certified package<select value={activeCertifiedPackage?.certifiedPackageId ?? ""} onChange={(event) => void openCertifiedPackage(event.currentTarget.value)} disabled={pending}><option value="">Select package</option>{certifiedPackages.map((item) => <option key={item.certifiedPackageId} value={item.certifiedPackageId}>{item.certifiedPackageId}</option>)}</select></label>
          <div className="engineering-review-final-summary"><span>Certified IOF <b>{String(activeCertifiedPackage?.certifiedPackageId ?? "Pending")}</b></span><span>Service Order <b>{serviceOrderReadyStatus.replaceAll("_", " ")}</b></span><span>ScopeVersion <b>Future after signed Service Order</b></span></div>
        </section>

        <details className="engineering-review-diagnostics">
          <summary><span>Diagnostics / Package Integrity</span><b className={`dal-badge ${statusClass(engineeringReadinessReport.status)}`}>{engineeringReadinessReport.status}</b></summary>
          <div className="engineering-review-diagnostic-summary">
            <span>Baseline <b>{renderEngineeringBaselineId}</b></span><span>Baseline hash <b>{renderEngineeringBaselineHash}</b></span><span>Revision <b>{renderEngineeringRevisionId}</b></span><span>Revision hash <b>{renderEngineeringRevisionHash}</b></span><span>Patches <b>{engineeringRevisionProjection.diagnostics.activePatchCount}</b></span><span>Projection <b>{engineeringRevisionProjection.diagnostics.projectionTimeMs} ms</b></span><span>Map authority <b>{sharedOpportunityMapProjection?.authority ?? "MISSING"}</b></span><span>Reasoning <b>Advisory / offline-safe</b></span>
          </div>
          <EngineeringReadinessReportPanel report={engineeringReadinessReport} projectionWarnings={projectionWarnings} projectionFailure={projectionFailure} />
          <GeometryAuthorityDiagnosticsPanel projection={projection} />
          <DoctrineProjectionDiagnosticsPanel projection={projection} />
          <SpineObjectCatalogPanel draftPackage={renderDraft} />
          <ConstitutionalAssemblyReviewPanel draftPackage={renderDraft} onFocusSpineObject={focusConstitutionalAssemblyObject} />
          <div className="dal-status">{engineeringChangeSetNotice} Runtime/cache instrumentation remains available in the global Runtime Diagnostics surface.</div>
        </details>

        <footer className="engineering-review-footer">
          <div><b>Blockers</b><span>{blockerLabels.length ? blockerLabels.join(" · ") : "All certification gates satisfied."}</span></div>
          <label>Commercial revision reason<input value={commercialRevisionReason} onChange={(event) => setCommercialRevisionReason(event.currentTarget.value)} /></label>
          <button type="button" className="secondary" onClick={requestCommercialRevision} disabled={!canWrite || pending}>Request Commercial Revision</button>
          <button type="button" className="engineering-certification-primary" onClick={certifyPackage} disabled={!canWrite || pending || !readyForHumanCertification}>Certify IOF Package</button>
        </footer>
        <div className="dal-status engineering-review-notice">{notice}</div>
      </EngineeringProjectionErrorBoundary>
    </section>
  );
}
