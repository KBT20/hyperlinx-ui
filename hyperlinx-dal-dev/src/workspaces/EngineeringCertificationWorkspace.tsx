import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addEngineeringCertificationConstraint,
  certifyDraftIofPackage,
  certifyIofUnit,
  createEngineeringCertificationRouteRedline,
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
  type EngineeringReviewQueueItem,
} from "../api/teralinxRuntime";
import { useDALState } from "../dal/DALState";
import {
  ENGINEERING_CERTIFICATION_WORKFLOW,
  ENGINEERING_CONSTRAINT_CATEGORIES,
  buildEngineeringCertificationChecklist,
  canMoveEngineeringObjectToStation,
  engineeringCertificationReady,
  type EngineeringConstraintCategory,
  type EngineeringConstraintSeverity,
} from "../engineering/EngineeringCertificationProjection";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import { MapKernel } from "../mapkernel";
import ConstitutionalAssemblyReviewPanel, { type ConstitutionalAssemblyFocus } from "../components/commercial/ConstitutionalAssemblyReviewPanel";
import { SpineObjectCatalogPanel } from "../components/engineering/SpineObjectCatalogPanel";
import { scheduleEngineeringProjection } from "../runtime/ConstitutionalAssemblyScheduler";

type StationLabelMode = "hidden" | "major" | "engineering";
type EngineeringDisciplineLens = "SALES_ENGINEER" | "OSP" | "FIBER" | "SUPPLY_CHAIN" | "FINAL_ENGINEERING";

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

function stationDensity(mode: StationLabelMode) {
  if (mode === "engineering") return 500;
  if (mode === "major") return 5280;
  return 5280;
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
  const [stationLabelMode, setStationLabelMode] = useState<StationLabelMode>("major");
  const [disciplineLens, setDisciplineLens] = useState<EngineeringDisciplineLens>("FINAL_ENGINEERING");
  const [notice, setNotice] = useState("Engineering Certification consumes a Commercial Draft IOF Package.");
  const [pending, setPending] = useState(false);
  const [certifiedPackages, setCertifiedPackages] = useState<CertifiedIofPackageRuntime[]>([]);
  const [activeCertifiedPackage, setActiveCertifiedPackage] = useState<CertifiedIofPackageRuntime | null>(null);
  const [manualStationPlan, setManualStationPlan] = useState<ManualStationPlan | null>(null);
  const [engineeringBudgetRows, setEngineeringBudgetRows] = useState<EngineeringBudgetRow[]>([]);
  const [engineeringBudgetApproved, setEngineeringBudgetApproved] = useState(false);

  const [constraintCategory, setConstraintCategory] = useState<EngineeringConstraintCategory>("ROW");
  const [constraintSeverity, setConstraintSeverity] = useState<EngineeringConstraintSeverity>("MEDIUM");
  const [constraintNotes, setConstraintNotes] = useState("");
  const [constraintDisposition, setConstraintDisposition] = useState("PENDING_ENGINEERING_DISPOSITION");

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
  const allObjectBudgetsConfirmed = Boolean(engineeringBudgetRows.length && engineeringBudgetRows.every((row) => row.confirmed));
  const manualCertificationReady = Boolean(manualStationPlan && allObjectBudgetsConfirmed && engineeringBudgetApproved);
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

  useEffect(() => {
    setActiveDraft(selectedEngineeringDraftIofPackage);
    setActiveEngineeringPackage(engineeringPackageForDraft(selectedEngineeringDraftIofPackage));
  }, [selectedEngineeringDraftIofPackage]);

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
          const draft = await openDraftIofPackageForCertification(preferredPackageId, session);
          if (cancelled) return;
          const engineeringPackage = engineeringPackageForDraft(draft);
          setActiveDraft(draft);
          setActiveEngineeringPackage(engineeringPackage);
          setSelectedEngineeringDraftIofPackage(draft);
          setSelectedEngineeringDraftIofPackageId(engineeringPackage?.engineeringPackageId ?? draft.engineeringPackageId ?? draft.packageId);
          setNotice(`${engineeringPackage?.engineeringPackageId ?? draft.engineeringPackageId ?? draft.packageId} restored from the Engineering Repository.`);
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
      setNotice(`${engineeringPackage?.engineeringPackageId ?? draft.engineeringPackageId ?? draft.packageId} opened. Draft IOF, route, workbook, estimate, and proposal resolved without regeneration.`);
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

  function updateEngineeringBudgetRow(objectId: string, patch: Partial<EngineeringBudgetRow>) {
    setEngineeringBudgetRows((rows) => rows.map((row) => row.objectId === objectId ? { ...row, ...patch } : row));
    setEngineeringBudgetApproved(false);
  }

  function approveEngineeringBudget() {
    if (!allObjectBudgetsConfirmed) {
      setNotice("Confirm every object budget before approving the Engineering budget.");
      return;
    }
    setEngineeringBudgetApproved(true);
    setNotice(`Engineering-approved object budget locked at ${money(engineeringApprovedBudgetTotal)}.`);
  }

  async function addConstraint() {
    if (!activeDraft || !selectedObject) return;
    setPending(true);
    try {
      const draft = await addEngineeringCertificationConstraint(activeDraft.packageId, {
        category: constraintCategory,
        station: selectedObject.station,
        objectReference: selectedObject.objectId,
        severity: constraintSeverity,
        status: "OPEN",
        engineeringDisposition: constraintDisposition,
        notesEvidence: constraintNotes,
      }, session);
      setConstraintNotes("");
      syncDraft(draft, "Constraint added to the Engineering Certification queue.");
      await refreshQueue();
    } catch (error) {
      setNotice(`Add Constraint failed: ${error instanceof Error ? error.message : String(error)}`);
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

  async function certifyPackage() {
    if (!activeDraft || !projection) return;
    if (!manualStationPlan) {
      setNotice("Certification blocked until Engineering generates the station plan.");
      return;
    }
    if (!allObjectBudgetsConfirmed || !engineeringBudgetApproved) {
      setNotice("Certification blocked until every object budget is confirmed and the Engineering budget is approved.");
      return;
    }
    if (!engineeringCertificationReady(projection)) {
      setNotice("Certification blocked until compliance failures are excepted and constraints are resolved or accepted.");
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
      const result = await certifyDraftIofPackage(draft.packageId, {
        checklist: buildEngineeringCertificationChecklist(refreshedProjection, certificationNotes, 94),
        stationPlan: {
          ...manualStationPlan,
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
          objectBudgets: engineeringBudgetRows,
          allObjectsConfirmed: true,
          noScopeVersionCreation: true,
        },
        engineeringApprovedBudget: engineeringApprovedBudgetTotal,
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
      syncDraft(result.draftPackage, `${result.certifiedIofPackage.certifiedDraftIofPackageId ?? result.draftPackage.packageId} certified. Certified Draft IOF Package ready for customer commitment; ScopeVersion not created.`, result.engineeringPackage ?? null);
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
  const rawEngineeringPackageStatus = String(renderEngineeringPackage?.engineeringStatus ?? renderEngineeringPackage?.status ?? renderDraft.engineeringStatus ?? "STATION_REVIEW");
  const engineeringPackageStatus = rawEngineeringPackageStatus === "STATION_PLANNING" ? "STATION_REVIEW" : rawEngineeringPackageStatus;
  const serviceOrderReadyStatus = String(renderEngineeringPackage?.serviceOrderState ?? renderEngineeringPackage?.serviceOrderStatus ?? activeCertifiedPackage?.serviceOrderStatus ?? "Service Order Ready");

  return (
    <section className="engineering-certification-shell">
      <div className="engineering-certification-workflow" aria-label="Engineering certification workflow">
        {ENGINEERING_CERTIFICATION_WORKFLOW.map((step) => (
          <div className={step.status} key={step.key}>
            <span>{step.label}</span>
            <b>{step.status}</b>
          </div>
        ))}
      </div>

      <EngineeringProjectionErrorBoundary resetKey={renderEngineeringPackageId}>
      <section className="dal-panel engineering-certification-package-header">
        <div className="dal-panel-title-row">
          <div>
            <h3>Engineering Package</h3>
            <span>{renderEngineeringPackageId}</span>
          </div>
          <span className={`dal-badge ${statusClass(engineeringPackageStatus)}`}>{engineeringPackageStatus.replaceAll("_", " ")}</span>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Customer</span><b>{projection.customer}</b></div>
          <div><span>Opportunity</span><b>{renderEngineeringPackage?.opportunityId ?? renderDraft.opportunityId}</b></div>
          <div><span>Draft IOF Package</span><b>{renderEngineeringPackage?.draftIOFPackageId ?? renderEngineeringPackage?.draftIofPackageId ?? renderDraft.packageId}</b></div>
          <div><span>Commercial Status</span><b>{String(renderEngineeringPackage?.commercialStatus ?? projection.commercialStatus).replaceAll("_", " ")}</b></div>
          <div><span>Submitted Date</span><b>{renderEngineeringPackage?.submittedAt || renderEngineeringPackage?.submittedDate ? new Date(String(renderEngineeringPackage.submittedAt ?? renderEngineeringPackage.submittedDate)).toLocaleString() : "Pending"}</b></div>
          <div><span>Engineering Status</span><b>{engineeringPackageStatus.replaceAll("_", " ")}</b></div>
          <div><span>Route Length</span><b>{feet(projection.routeLength)}</b></div>
          <div><span>Estimated Cost</span><b>{money(draftEstimatedCost(renderDraft))}</b></div>
          <div><span>Revenue</span><b>{money(draftRevenue(renderDraft))}</b></div>
          <div><span>Margin</span><b>{money(draftMargin(renderDraft))}</b></div>
          <div><span>Engineering Confidence</span><b>{percent(renderDraft.engineeringConfidence ?? renderDraft.assemblyConfidence ?? 0)}</b></div>
          <div><span>Station Review</span><b>{engineeringReadinessReport.readyForStationPlanning ? "Ready" : "Locked"}</b></div>
          <div><span>Certified IOF Package</span><b>{activeCertifiedPackage?.certifiedPackageId ?? renderEngineeringPackage?.certifiedIOFPackageId ?? renderEngineeringPackage?.certifiedIofPackageId ?? "Pending"}</b></div>
          <div><span>Service Order</span><b>{serviceOrderReadyStatus.replaceAll("_", " ")}</b></div>
          <div><span>ScopeVersion</span><b>Future</b></div>
        </div>
        <div className="dal-actions">
          <button type="button" onClick={openStationReview} disabled={!canWrite || pending || !engineeringReadinessReport.readyForStationPlanning}>
            Open Station Review
          </button>
        </div>
      </section>

      <EngineeringReadinessReportPanel
        report={engineeringReadinessReport}
        projectionWarnings={projectionWarnings}
        projectionFailure={projectionFailure}
      />

      <div className="dal-panel engineering-certification-package-header">
        <div className="dal-panel-title-row">
          <div>
            <h3>Engineering Certification</h3>
            <span>{renderDraft.packageName ?? renderDraft.packageId}</span>
          </div>
          <span className="dal-badge warning">{String(renderDraft.status ?? "UNDER_ENGINEERING_REVIEW").replaceAll("_", " ")}</span>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Package</span><b>{renderDraft.packageId}</b></div>
          <div><span>Customer</span><b>{projection.customer}</b></div>
          <div><span>Revision</span><b>{renderDraft.packageRevision ?? 0}</b></div>
          <div><span>Authority</span><b>Engineering</b></div>
          <div><span>Engineering Status</span><b>{String(renderDraft.engineeringStatus ?? "Under Review").replaceAll("_", " ")}</b></div>
          <div><span>Doctrine</span><b>{String(renderDraft.doctrineId ?? "PD-001")}</b></div>
        </div>
      </div>

      <section className="dal-panel engineering-certification-discipline-lenses">
        <div className="dal-panel-title-row">
          <div>
            <h3>Engineering Discipline Lenses</h3>
            <span>Filters over the same Certified Draft IOF candidate. No duplicate engineering truth is created.</span>
          </div>
          <span className="dal-badge pass">Single Draft IOF</span>
        </div>
        <div className="engineering-certification-segments">
          {DISCIPLINE_LENSES.map((lens) => (
            <button
              type="button"
              key={lens.key}
              className={disciplineLens === lens.key ? "active-toggle" : undefined}
              onClick={() => setDisciplineLens(lens.key)}
            >
              {lens.label}
            </button>
          ))}
        </div>
        <div className="dal-status">{activeLens.detail}</div>
      </section>

      <div className="engineering-certification-grid">
        <aside className="dal-panel engineering-certification-summary">
          <div className="dal-panel-title-row">
            <h3>Draft IOF Package Summary</h3>
            <span className={`dal-badge ${statusClass(projection.commercialStatus)}`}>{projection.commercialStatus}</span>
          </div>
          <div className="engineering-certification-kv">
            <span>customer</span><b>{projection.customer}</b>
            <span>account</span><b>{projection.account}</b>
            <span>opportunity/package id</span><b>{projection.opportunityPackageId}</b>
            <span>product id/name</span><b>{projection.productIdName}</b>
            <span>doctrine id/version</span><b>{projection.doctrineIdVersion}</b>
            <span>draft package revision</span><b>{projection.draftPackageRevision}</b>
            <span>route length</span><b>{feet(projection.routeLength)}</b>
            <span>station count</span><b>{projection.stationCount.toLocaleString()}</b>
            <span>object count</span><b>{projection.objectCount.toLocaleString()}</b>
            <span>ILA / regen / facility count</span><b>{projection.facilityCount.toLocaleString()}</b>
            <span>commercial status</span><b>{projection.commercialStatus}</b>
            <span>engineering status</span><b>{projection.engineeringStatus}</b>
            <span>validation/readiness status</span><b>{projection.validationReadinessStatus}</b>
          </div>
          <label>
            Engineering package queue
            <select value={renderEngineeringPackageId} onChange={(event) => void openPackage(event.currentTarget.value)} disabled={pending}>
              {[renderDraft, ...queue.filter((item) => queueEngineeringPackageId(item) !== renderEngineeringPackageId)].map((item) => (
                <option key={queueEngineeringPackageId(item)} value={queueEngineeringPackageId(item)}>{item.packageName ?? queueEngineeringPackageId(item)}</option>
              ))}
            </select>
          </label>
          <div className="dal-status">{notice}</div>
        </aside>

        <main className="dal-panel engineering-certification-canvas">
          <div className="dal-panel-title-row">
            <div>
              <h3>Engineering Canvas</h3>
              <div className="dal-status">Rendered from Draft IOF Package artifacts. No intake route regeneration or ScopeVersion creation is invoked here.</div>
            </div>
            <div className="engineering-certification-segments">
              <button type="button" className={stationLabelMode === "hidden" ? "active-toggle" : undefined} onClick={() => setStationLabelMode("hidden")}>Labels Off</button>
              <button type="button" className={stationLabelMode === "major" ? "active-toggle" : undefined} onClick={() => setStationLabelMode("major")}>Major Stations</button>
              <button type="button" className={stationLabelMode === "engineering" ? "active-toggle" : undefined} onClick={() => setStationLabelMode("engineering")}>Engineering Labels</button>
            </div>
          </div>
          <MapKernel
            specs={[projection.mapSpec]}
            initialMode="geographic"
            initialBaseLayer="hybrid"
            stationDensityFeet={stationDensity(stationLabelMode)}
            showStationLabels={stationLabelMode !== "hidden"}
            height={620}
            onSelectionChange={(selection) => {
              const id = selection?.featureRef.objectId ?? selection?.featureRef.id ?? "";
              if (projection.objects.some((object) => object.objectId === id)) setSelectedObjectId(id);
            }}
          />
        </main>

        <aside className="dal-panel engineering-certification-compliance">
          <div className="dal-panel-title-row">
            <h3>PD-001 Compliance</h3>
            <span className={`dal-badge ${engineeringCertificationReady(projection) ? "pass" : "warning"}`}>{percent(renderDraft.packageCompleteness)}</span>
          </div>
          <div className="engineering-certification-compliance-list">
            {projection.compliance.map((row) => (
              <div key={row.key}>
                <span>{row.label}</span>
                <b className={`dal-badge ${statusClass(row.status)}`}>{row.status}</b>
                <small>{row.detail}</small>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="engineering-certification-bottom">
        <SpineObjectCatalogPanel draftPackage={renderDraft} />

        <ConstitutionalAssemblyReviewPanel
          draftPackage={renderDraft}
          onFocusSpineObject={focusConstitutionalAssemblyObject}
        />

        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Constraint Queue</h3>
            <span className="dal-badge warning">{projection.constraints.length.toLocaleString()}</span>
          </div>
          <div className="engineering-certification-form-grid">
            <label>
              Category
              <select value={constraintCategory} onChange={(event) => setConstraintCategory(event.currentTarget.value as EngineeringConstraintCategory)}>
                {ENGINEERING_CONSTRAINT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Severity
              <select value={constraintSeverity} onChange={(event) => setConstraintSeverity(event.currentTarget.value as EngineeringConstraintSeverity)}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </label>
            <label>
              Disposition
              <input value={constraintDisposition} onChange={(event) => setConstraintDisposition(event.currentTarget.value)} />
            </label>
          </div>
          <textarea value={constraintNotes} onChange={(event) => setConstraintNotes(event.currentTarget.value)} placeholder="Notes / evidence" />
          <div className="engineering-certification-list">
            {projection.constraints.map((constraint) => (
              <div key={constraint.constraintId}>
                <b>{constraint.constraintId}</b>
                <span className={`dal-badge ${statusClass(constraint.status)}`}>{constraint.status}</span>
                <small>{constraint.category} / {constraint.severity} / {constraint.station || constraint.stationRange || "station pending"} / {constraint.objectReference || "no object"}</small>
                <small>{constraint.engineeringDisposition}. {constraint.notesEvidence}</small>
              </div>
            ))}
            {!projection.constraints.length ? <div className="dal-status">No constraints recorded on this Draft IOF Package.</div> : null}
          </div>
        </section>

        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <div>
              <h3>Station-Aware Object Review</h3>
              <span>Engineering-owned object review, station movement, addressing, dependencies, close sequence, evidence, and segment blockers.</span>
            </div>
            <span className={`dal-badge ${selectedObject?.movable ? "pass" : "warning"}`}>{selectedObject?.objectType ?? "NO_OBJECT"}</span>
          </div>
          {selectedObject ? (
            <>
              <select value={selectedObject.objectId} onChange={(event) => setSelectedObjectId(event.currentTarget.value)} aria-label="Selected object">
                {projection.objects.map((object) => <option key={object.objectId} value={object.objectId}>{object.objectType} / {object.objectId}</option>)}
              </select>
              <div className="engineering-certification-kv">
                <span>object id</span><b>{selectedObject.objectId}</b>
                <span>object type</span><b>{selectedObject.objectType}</b>
                <span>station</span><b>{selectedObject.station || "n/a"}</b>
                <span>station range</span><b>{selectedObject.stationRange || "n/a"}</b>
                <span>coordinates</span><b>{coordinateLabel(selectedObject.coordinate)}</b>
                <span>parent spine/graph reference</span><b>{selectedObject.parentReference || "n/a"}</b>
                <span>package source</span><b>{selectedObject.packageSource}</b>
                <span>construction method</span><b>{selectedObject.constructionMethod}</b>
                <span>dependencies</span><b>{stringList(selectedObject.dependencies).join(", ") || "n/a"}</b>
                <span>quantity impact</span><b>{selectedObject.quantityImpact}</b>
                <span>commercial assumption</span><b>{selectedObject.commercialAssumption}</b>
                <span>engineering notes</span><b>{selectedObject.engineeringNotes || "n/a"}</b>
                <span>constraint links</span><b>{stringList(selectedObject.constraintLinks).join(", ") || "n/a"}</b>
                <span>current review status</span><b>{selectedObject.currentReviewStatus}</b>
              </div>
            </>
          ) : <div className="dal-status">No package object selected.</div>}
        </section>

        <section className="dal-panel engineering-certification-manual-handoff">
          <div className="dal-panel-title-row">
            <div>
              <h3>Station Review</h3>
              <span>Restored from the persisted station graph and station object manifest. Engineering reviews and moves objects by station authority.</span>
            </div>
            <span className={`dal-badge ${manualStationPlan ? "pass" : "warning"}`}>{manualStationPlan ? "OPEN" : "LOCKED"}</span>
          </div>
          <div className="teralinx-summary-grid compact">
            <div><span>Station Review ID</span><b>{manualStationPlan?.stationPlanId ?? "Pending"}</b></div>
            <div><span>Route Repository</span><b>{routeRepositoryIdForDraft(renderDraft) || "Referenced by Draft IOF"}</b></div>
            <div><span>Stations</span><b>{(manualStationPlan?.stations.length ?? projection.stations.length).toLocaleString()}</b></div>
            <div><span>Assignments</span><b>{(manualStationPlan?.objectAssignments.length ?? projection.objects.length).toLocaleString()}</b></div>
          </div>
          <div className="engineering-certification-list">
            {(manualStationPlan?.objectAssignments ?? []).slice(0, 24).map((assignment, index) => (
              <div key={`${assignment.objectId}:${assignment.stationId}:${index}`}>
                <b>{assignment.objectType} / {assignment.objectId}</b>
                <small>{assignment.stationLabel || assignment.stationId || "Station pending"} {assignment.stationRange ? `/ ${assignment.stationRange}` : ""}</small>
              </div>
            ))}
            {!manualStationPlan ? <div className="dal-status">Station projection must restore before budget approval and package certification.</div> : null}
          </div>
        </section>

        <section className="dal-panel engineering-certification-budget-review">
          <div className="dal-panel-title-row">
            <div>
              <h3>Engineering Budget Review</h3>
              <span>Confirm object-level costs and approve the Engineering budget for the Certified IOF Package.</span>
            </div>
            <span className={`dal-badge ${engineeringBudgetApproved ? "pass" : "warning"}`}>{money(engineeringApprovedBudgetTotal)}</span>
          </div>
          <div className="engineering-certification-budget-table">
            {engineeringBudgetRows.map((row, index) => (
              <div key={`${row.objectId}:${index}`}>
                <b>{row.objectType}</b>
                <small>{row.objectId}</small>
                <small>{row.stationReference || row.stationRange || "Station pending"}</small>
                <span>{money(row.commercialBudget)}</span>
                <input
                  type="number"
                  min="0"
                  value={row.engineeringApprovedBudget}
                  onChange={(event) => updateEngineeringBudgetRow(row.objectId, { engineeringApprovedBudget: numeric(event.currentTarget.value) })}
                  aria-label={`Engineering approved budget for ${row.objectId}`}
                />
                <label className="engineering-certification-confirm-row">
                  <input
                    type="checkbox"
                    checked={row.confirmed}
                    onChange={(event) => updateEngineeringBudgetRow(row.objectId, { confirmed: event.currentTarget.checked })}
                  />
                  Confirm
                </label>
              </div>
            ))}
          </div>
          <textarea
            value={engineeringBudgetRows.find((row) => row.objectId === selectedObjectId)?.notes ?? ""}
            onChange={(event) => updateEngineeringBudgetRow(selectedObjectId, { notes: event.currentTarget.value })}
            placeholder="Selected object budget notes"
            disabled={!selectedObjectId}
          />
          <div className="dal-actions">
            <button type="button" onClick={approveEngineeringBudget} disabled={!canWrite || pending || !allObjectBudgetsConfirmed}>Approve Engineering Budget</button>
          </div>
          <div className="dal-status">
            {allObjectBudgetsConfirmed ? "All object budgets confirmed." : "Every object budget must be confirmed before certification."}
          </div>
        </section>

        <section className="dal-panel engineering-certification-certified-restore">
          <div className="dal-panel-title-row">
            <div>
              <h3>Certified IOF Package</h3>
              <span>Repository restore and Service Order readiness. Signature gates ScopeVersion creation later.</span>
            </div>
            <span className={`dal-badge ${activeCertifiedPackage ? "pass" : "warning"}`}>{activeCertifiedPackage ? "RESTORED" : "PENDING"}</span>
          </div>
          <div className="engineering-certification-kv">
            <span>certified package id</span><b>{String(activeCertifiedPackage?.certifiedPackageId ?? renderDraft.certifiedPackageId ?? "Pending")}</b>
            <span>revision</span><b>{String(activeCertifiedPackage?.certificationRevision ?? renderDraft.packageRevision ?? "Pending")}</b>
            <span>hash</span><b>{String(activeCertifiedPackage?.certificationHash ?? "Pending")}</b>
            <span>reviewer</span><b>{String(activeCertifiedPackage?.engineeringReviewer ?? activeCertifiedPackage?.certifiedBy ?? currentUserName)}</b>
            <span>certified at</span><b>{String(activeCertifiedPackage?.certificationTimestamp ?? activeCertifiedPackage?.certifiedAt ?? "Pending")}</b>
            <span>service order</span><b>{String(activeCertifiedPackage?.serviceOrderStatus ?? (activeCertifiedPackage ? "SERVICE_ORDER_READY" : "Pending"))}</b>
            <span>signature</span><b>{String(activeCertifiedPackage?.signatureStatus ?? (activeCertifiedPackage ? "AWAITING_CUSTOMER_SIGNATURE" : "Pending"))}</b>
            <span>ScopeVersion</span><b>{String(activeCertifiedPackage?.scopeVersionStatus ?? "FUTURE_AFTER_SIGNED_SERVICE_ORDER")}</b>
          </div>
          <label>
            Restore certified package
            <select value={activeCertifiedPackage?.certifiedPackageId ?? ""} onChange={(event) => void openCertifiedPackage(event.currentTarget.value)} disabled={pending}>
              <option value="">Select package</option>
              {certifiedPackages.map((item) => (
                <option key={item.certifiedPackageId} value={item.certifiedPackageId}>{item.certifiedPackageId}</option>
              ))}
            </select>
          </label>
          <div className="dal-status">Service Order Ready. Await Signature. ScopeVersion Future.</div>
        </section>

        <section className="dal-panel engineering-certification-actions">
          <div className="dal-panel-title-row">
            <h3>Engineering Actions</h3>
            <span className={`dal-badge ${canWrite ? "pass" : "warning"}`}>{canWrite ? "WRITE" : "READ ONLY"}</span>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={addConstraint} disabled={!canWrite || pending || !selectedObject}>Add Constraint</button>
          </div>
          <div className="engineering-certification-form-grid">
            <label>
              New station
              <select value={moveStation} onChange={(event) => setMoveStation(event.currentTarget.value)}>
                {projection.stations.map((station) => <option key={station.stationId} value={station.stationId}>{station.label}</option>)}
              </select>
            </label>
            <label>
              Reason
              <input value={moveReason} onChange={(event) => setMoveReason(event.currentTarget.value)} />
            </label>
            <label>
              Authority
              <input value={moveAuthority} onChange={(event) => setMoveAuthority(event.currentTarget.value)} />
            </label>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={moveObject} disabled={!canWrite || pending || !selectedObject?.movable}>Move Object</button>
          </div>
          <label>
            Redline reason
            <input value={redlineReason} onChange={(event) => setRedlineReason(event.currentTarget.value)} />
          </label>
          <textarea value={redlineDescription} onChange={(event) => setRedlineDescription(event.currentTarget.value)} placeholder="Route redline description" />
          <div className="dal-actions">
            <button type="button" onClick={createRedline} disabled={!canWrite || pending}>Create Route Redline</button>
          </div>
          <div className="engineering-certification-form-grid">
            <label>
              Doctrine rule
              <input value={exceptionRule} onChange={(event) => setExceptionRule(event.currentTarget.value)} />
            </label>
            <label>
              Actual condition
              <input value={exceptionCondition} onChange={(event) => setExceptionCondition(event.currentTarget.value)} />
            </label>
          </div>
          <textarea value={exceptionReason} onChange={(event) => setExceptionReason(event.currentTarget.value)} placeholder="Exception reason" />
          <textarea value={exceptionImpact} onChange={(event) => setExceptionImpact(event.currentTarget.value)} placeholder="Impact summary" />
          <div className="dal-actions">
            <button type="button" onClick={recordException} disabled={!canWrite || pending}>Record Doctrine Exception</button>
          </div>
          <textarea value={certificationNotes} onChange={(event) => setCertificationNotes(event.currentTarget.value)} placeholder="Certification notes" />
          <div className="dal-actions">
            <button type="button" className="engineering-certification-primary" onClick={certifyPackage} disabled={!canWrite || pending || !manualCertificationReady}>CERTIFY IOF PACKAGE</button>
          </div>
          <div className="dal-status">
            {manualCertificationReady ? "Manual handoff complete. Certification will produce Service Order readiness only." : "Open Station Review, confirm object budgets, and approve the Engineering budget before certification."}
          </div>
          <textarea value={commercialRevisionReason} onChange={(event) => setCommercialRevisionReason(event.currentTarget.value)} placeholder="Commercial revision reason" />
          <div className="dal-actions">
            <button type="button" className="secondary" onClick={requestCommercialRevision} disabled={!canWrite || pending}>Reject / Request Commercial Revision</button>
          </div>
        </section>
      </div>
      </EngineeringProjectionErrorBoundary>
    </section>
  );
}
