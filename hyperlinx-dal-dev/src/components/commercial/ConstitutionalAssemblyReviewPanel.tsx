import type { DraftIofPackageRuntime } from "../../api/teralinxRuntime";

type JsonObject = Record<string, unknown>;
type ReviewStatus = "PASS" | "WARNING" | "FAIL";
type DraftReadiness = "READY" | "BLOCKED";

export type ConstitutionalAssemblyFocus = {
  blockerId?: string;
  spineObjectId?: string;
  stationRef?: string;
  nodeId?: string;
};

type ReadinessCheck = {
  key: string;
  label: string;
  status: ReviewStatus;
  detail: string;
};

type AssemblyBlocker = {
  blockerId: string;
  spineObjectId: string;
  stationRef: string;
  doctrine: string;
  reason: string;
  requiredResolution: string;
};

export type ConstitutionalAssemblyReviewState = {
  status: ReviewStatus;
  draftIofReadiness: DraftReadiness;
  draftIofGateBlocked: boolean;
  draftIofGateReason: string;
  readinessChecks: ReadinessCheck[];
  blockers: AssemblyBlocker[];
  summary: {
    routeLengthFeet: number;
    routeLengthMiles: number;
    stationCount: number;
    spineObjectCount: number;
    engineeringObjectCount: number;
    executionZoneCount: number;
    paymentSegmentCount: number;
    closureExpectationCount: number;
  };
  objectGroups: Array<{ group: string; count: number }>;
  dependencySummary: {
    status: ReviewStatus;
    concurrentExecutionZones: number;
    blockedObjects: number;
    readyObjects: number;
    missingDependencies: number;
  };
  closeSequenceSummary: {
    legalSequences: number;
    missingSequences: number;
    sequenceConflicts: number;
    blockedTransitions: number;
    nextDeterministicClose: string;
  };
  evidenceSummary: Array<{ label: string; count: number }>;
  segmentSummary: {
    paymentSegments: number;
    blockedSegments: number;
    validatedSegments: number;
    futurePaymentEligibleSegments: number;
  };
};

type ConstitutionalAssemblyReviewPanelProps = {
  draftPackage: DraftIofPackageRuntime | null;
  onFocusSpineObject?: (focus: ConstitutionalAssemblyFocus) => void;
};

function asRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
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

function statusClass(status: unknown) {
  const text = String(status ?? "").toUpperCase();
  if (text === "PASS" || text === "READY") return "pass";
  if (text === "FAIL" || text === "BLOCKED") return "fail";
  return "warning";
}

function titleCase(value: unknown) {
  return String(value ?? "n/a")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function feet(value: unknown) {
  const numeric = asNumber(value, Number.NaN);
  return Number.isFinite(numeric) ? `${Math.round(numeric).toLocaleString()} ft` : "n/a";
}

function miles(value: unknown) {
  const numeric = asNumber(value, Number.NaN);
  return Number.isFinite(numeric) ? `${numeric.toLocaleString(undefined, { maximumFractionDigits: 3 })} mi` : "n/a";
}

function expectationSpineObjectId(expectation: JsonObject, index: number) {
  return asString(
    expectation.spineObjectId ?? expectation.executionObjectId ?? expectation.sourceArtifactId ?? expectation.nodeId,
    `SPINE-OBJECT-${String(index + 1).padStart(4, "0")}`,
  );
}

function persistedArray(draft: JsonObject, graph: JsonObject, key: string) {
  const direct = asArray<JsonObject>(draft[key]);
  if (direct.length) return direct;
  return asArray<JsonObject>(graph[key]);
}

function nodeById(nodes: JsonObject[]) {
  const entries: Array<[string, JsonObject]> = [];
  nodes.forEach((node) => {
    const nodeId = asString(node.nodeId);
    if (nodeId) entries.push([nodeId, node]);
  });
  return new Map(entries);
}

function objectGroup(nodeType: string) {
  const type = nodeType.toUpperCase();
  if (["STATION_RANGE"].includes(type)) return "Civil";
  if (["HANDHOLE", "VAULT", "SPLICE_CASE", "MARKER", "PULL_POINT"].includes(type)) return "Structures";
  if (["CONDUIT_SEGMENT"].includes(type)) return "Linear Infrastructure";
  if (["FIBER_SEGMENT"].includes(type)) return "Fiber";
  if (["ILA", "REGEN"].includes(type)) return "Facilities";
  if (["COMMERCIAL_REVIEW_OBJECT", "AUDIT_REVIEW_OBJECT"].includes(type)) return "Crossings / Constraints";
  return "Administrative";
}

function readiness(label: string, ready: boolean, detail: string, key = label.toLowerCase().replace(/\s+/g, "-")): ReadinessCheck {
  return {
    key,
    label,
    status: ready ? "PASS" : "FAIL",
    detail,
  };
}

function includesToken(values: unknown[], token: string) {
  const upper = token.toUpperCase();
  return values.some((value) => String(value ?? "").toUpperCase().includes(upper));
}

function blockerObjectId(issue: string) {
  const colon = issue.split(":").pop()?.trim();
  return colon && colon !== issue ? colon : "";
}

function blockerResolution(issue: string) {
  const lower = issue.toLowerCase();
  if (lower.includes("doctrine")) return "Attach Product or Engineering Object Doctrine before Draft IOF approval.";
  if (lower.includes("dependency")) return "Resolve the Spine Object dependency graph before Draft IOF approval.";
  if (lower.includes("close sequence")) return "Assign a legal constitutional Close sequence before Draft IOF approval.";
  if (lower.includes("evidence")) return "Attach required evidence requirements before Draft IOF approval.";
  if (lower.includes("payment")) return "Attach the no-close/no-validation/no-payment rule before Draft IOF approval.";
  return "Resolve the Constitutional Assembly blocker before Draft IOF approval.";
}

function normalizeAssemblyBlockers(args: {
  issues: string[];
  expectations: JsonObject[];
  nodes: JsonObject[];
  checks: ReadinessCheck[];
}) {
  const byObjectId = new Map(args.expectations.map((expectation, index) => [expectationSpineObjectId(expectation, index), expectation]));
  const byNodeId = nodeById(args.nodes);
  const blockers = args.issues.map((issue, index): AssemblyBlocker => {
    const objectId = blockerObjectId(issue);
    const expectation = byObjectId.get(objectId) ?? args.expectations[index % Math.max(1, args.expectations.length)] ?? {};
    const node: JsonObject = byNodeId.get(asString(expectation.nodeId)) ?? {};
    return {
      blockerId: `CONSTITUTIONAL-ASSEMBLY-BLOCKER-${String(index + 1).padStart(3, "0")}`,
      spineObjectId: objectId || expectationSpineObjectId(expectation, index),
      stationRef: asString(expectation.stationId ?? expectation.stationLabel ?? node.stationId ?? node.stationLabel),
      doctrine: asString(asArray<JsonObject>(expectation.expectedDoctrine)[0]?.doctrineId, "Missing"),
      reason: issue,
      requiredResolution: blockerResolution(issue),
    };
  });
  args.checks
    .filter((check) => check.status === "FAIL")
    .forEach((check) => {
      blockers.push({
        blockerId: `CONSTITUTIONAL-READINESS-${check.key}`,
        spineObjectId: "PACKAGE",
        stationRef: "",
        doctrine: check.label,
        reason: check.detail,
        requiredResolution: "Correct the missing persisted constitutional artifact before Draft IOF approval.",
      });
    });
  return blockers;
}

export function evaluateConstitutionalAssemblyReview(draftPackage: DraftIofPackageRuntime | null): ConstitutionalAssemblyReviewState {
  const draft = asRecord(draftPackage);
  const constitutionalAssembly = asRecord(draft.constitutionalAssembly);
  const kernelExecutionGraph = asRecord(draft.kernelExecutionGraph);
  const measuredSpine = asRecord(draft.measuredSpine);
  const stationAuthority = asRecord(draft.stationAuthority);
  const auditProjection = asRecord(draft.spineAuditProjection);
  const executionNodes = persistedArray(draft, kernelExecutionGraph, "executionNodes").length
    ? persistedArray(draft, kernelExecutionGraph, "executionNodes")
    : asArray<JsonObject>(kernelExecutionGraph.nodes);
  const executionExpectations = persistedArray(draft, kernelExecutionGraph, "executionExpectations");
  const spineObjectDependencies = asArray<JsonObject>(draft.spineObjectDependencies).length
    ? asArray<JsonObject>(draft.spineObjectDependencies)
    : executionExpectations.map((expectation, index) => ({
      spineObjectId: expectationSpineObjectId(expectation, index),
      nodeId: expectation.nodeId,
      dependencies: asArray(expectation.expectedDependencies),
      dependencyGraphNotSchedule: expectation.dependencyGraphNotSchedule,
    }));
  const spineObjectCloseSequences = asArray<JsonObject>(draft.spineObjectCloseSequences).length
    ? asArray<JsonObject>(draft.spineObjectCloseSequences)
    : executionExpectations.map((expectation, index) => ({
      spineObjectId: expectationSpineObjectId(expectation, index),
      nodeId: expectation.nodeId,
      legalCloseSequence: asArray(expectation.legalCloseSequence),
      nextDeterministicClose: asArray(expectation.legalCloseSequence)[0],
    }));
  const spineObjectEvidenceRequirements = asArray<JsonObject>(draft.spineObjectEvidenceRequirements).length
    ? asArray<JsonObject>(draft.spineObjectEvidenceRequirements)
    : executionExpectations.map((expectation, index) => ({
      spineObjectId: expectationSpineObjectId(expectation, index),
      nodeId: expectation.nodeId,
      requiredEvidence: asArray(expectation.expectedEvidence),
      requiredMeasurements: asArray(expectation.expectedMeasurements),
    }));
  const segmentValidationRules = asArray<JsonObject>(draft.segmentValidationRules).length
    ? asArray<JsonObject>(draft.segmentValidationRules)
    : asArray<JsonObject>(draft.stationRangeExpectations).map((range, index) => ({
      ruleId: asString(range.expectationId, `SEGMENT-VALIDATION-${index + 1}`),
      spineObjectId: asString(range.expectationId, `STATION-RANGE-${index + 1}`),
      fromStationId: range.fromStationId,
      toStationId: range.toStationId,
      validationRule: "NO_CLOSE_NO_VALIDATION_NO_PAYMENT",
    }));
  const paymentEligibilityRules = asArray<JsonObject>(draft.paymentEligibilityRules).length
    ? asArray<JsonObject>(draft.paymentEligibilityRules)
    : executionExpectations.map((expectation, index) => ({
      ruleId: `${expectationSpineObjectId(expectation, index)}:PAYMENT-ELIGIBILITY`,
      spineObjectId: expectationSpineObjectId(expectation, index),
      paymentEligibilityRule: expectation.paymentEligibilityRule,
    }));
  const closureExpectations = asArray(draft.closureExpectations).length
    ? asArray(draft.closureExpectations)
    : asArray(auditProjection.closureExpectations);
  const engineeringObjects = asArray(draft.engineeringObjects).length
    ? asArray(draft.engineeringObjects)
    : executionNodes.filter((node) => asString(node.sourceArtifact) === "engineeringObjects");
  const quantityReconciliationRecord = asRecord(draft.quantityReconciliation);
  const formalQuantityReconciliation = Array.isArray(quantityReconciliationRecord.items)
    ? quantityReconciliationRecord
    : null;
  const quantityReconciliation = asArray<JsonObject>(draft.quantityReconciliation);

  const productDoctrineReady = Boolean(draft.productDoctrine || draft.doctrineId);
  const objectDoctrineReady = Boolean(draft.engineeringObjectDoctrine || engineeringObjects.length);
  const auditProjectionReady = Boolean(auditProjection.projectionId || draft.auditProjectionSummary);
  const legacyQuantitiesReady = Boolean(draft.quantitySummary || asRecord(draft.commercialSummary).quantitySummary || asNumber(asRecord(draft.commercialSummary).routeFeet) > 0);
  const quantitiesReady = formalQuantityReconciliation
    ? asString(formalQuantityReconciliation.status).toUpperCase() === "PASS"
    : quantityReconciliation.length
      ? quantityReconciliation.every((item) => ["MATCH", "RESOLVED", "SUPERSEDED"].includes(asString(item.status).toUpperCase()))
      : legacyQuantitiesReady;
  const dependenciesReady = Boolean(spineObjectDependencies.length) && spineObjectDependencies.every((item) => asArray(item.dependencies).length > 0 || item.dependencyGraphNotSchedule === true);
  const closeSequencesReady = Boolean(spineObjectCloseSequences.length) && spineObjectCloseSequences.every((item) => asArray(item.legalCloseSequence).length > 0);
  const evidenceReady = Boolean(spineObjectEvidenceRequirements.length) && spineObjectEvidenceRequirements.every((item) => asArray(item.requiredEvidence).length > 0);
  const segmentValidationReady = Boolean(segmentValidationRules.length);
  const paymentRulesReady = Boolean(paymentEligibilityRules.length) && paymentEligibilityRules.every((item) => asString(item.paymentEligibilityRule) === "NO_CLOSE_NO_VALIDATION_NO_PAYMENT");
  const kernelGraphReady = Boolean(kernelExecutionGraph.graphId) && asString(asRecord(draft.executionGraphValidation).status, asString(asRecord(kernelExecutionGraph.validation).status, "FAIL")) !== "FAIL";

  const readinessChecks = [
    readiness("Product Doctrine", productDoctrineReady, productDoctrineReady ? "Product Doctrine is persisted." : "Product Doctrine is missing.", "product-doctrine"),
    readiness("Object Doctrine", objectDoctrineReady, objectDoctrineReady ? "Engineering Object Doctrine is persisted." : "Engineering Object Doctrine is missing.", "object-doctrine"),
    readiness("Audit Projection", auditProjectionReady, auditProjectionReady ? "Commercial Audit Projection is persisted." : "Commercial Audit Projection is missing.", "audit-projection"),
    readiness(
      "Quantity Reconciliation",
      quantitiesReady,
      formalQuantityReconciliation
        ? quantitiesReady
          ? `${asNumber(formalQuantityReconciliation.resolvedCount).toLocaleString()} of ${asNumber(formalQuantityReconciliation.requiredCount).toLocaleString()} required quantities are constitutionally resolved.`
          : "Formal quantity reconciliation requires attributable Engineering disposition."
        : quantityReconciliation.length
        ? quantitiesReady
          ? "Source quantities match doctrine-derived quantities."
          : "Source and doctrine quantities require an authority disposition."
        : quantitiesReady
          ? "Commercial quantities are persisted; formal source reconciliation is not attached."
          : "Commercial quantities are missing.",
      "quantity-reconciliation",
    ),
    readiness("Dependencies", dependenciesReady, dependenciesReady ? "Spine Object dependencies are persisted." : "Spine Object dependencies are missing.", "dependencies"),
    readiness("Close Sequences", closeSequencesReady, closeSequencesReady ? "Legal Close sequences are persisted." : "Legal Close sequences are missing.", "close-sequences"),
    readiness("Evidence Requirements", evidenceReady, evidenceReady ? "Evidence requirements are persisted." : "Evidence requirements are missing.", "evidence-requirements"),
    readiness("Segment Validation", segmentValidationReady, segmentValidationReady ? "Segment validation rules are persisted." : "Segment validation rules are missing.", "segment-validation"),
    readiness("Payment Rules", paymentRulesReady, paymentRulesReady ? "Payment eligibility rules are persisted." : "Payment eligibility rules are missing.", "payment-rules"),
    readiness("Kernel Execution Graph", kernelGraphReady, kernelGraphReady ? "Kernel Execution Graph is persisted and valid." : "Kernel Execution Graph is missing or failed.", "kernel-execution-graph"),
  ];

  const failedReadiness = readinessChecks.some((check) => check.status === "FAIL");
  const persistedAssemblyIssues = asArray<string>(constitutionalAssembly.blockingIssues);
  const assemblyIssues = formalQuantityReconciliation
    ? persistedAssemblyIssues.filter((issue) => !issue.toLowerCase().includes("quantity"))
    : persistedAssemblyIssues;
  const calculatedConstitutionalStatus = !failedReadiness && assemblyIssues.length === 0 ? "PASS" : "FAIL";
  const calculatedDraftIofReadiness: DraftReadiness = calculatedConstitutionalStatus === "PASS" ? "READY" : "BLOCKED";
  const draftIofReadiness = calculatedDraftIofReadiness;
  readinessChecks.push(readiness("Draft IOF Readiness", draftIofReadiness === "READY", `Draft IOF readiness is ${draftIofReadiness}.`, "draft-iof-readiness"));

  const blockers = normalizeAssemblyBlockers({
    issues: assemblyIssues,
    expectations: executionExpectations,
    nodes: executionNodes,
    checks: readinessChecks,
  });
  const draftIofGateBlocked = calculatedConstitutionalStatus !== "PASS" || draftIofReadiness !== "READY" || blockers.length > 0;
  const status: ReviewStatus = draftIofGateBlocked ? "FAIL" : "PASS";

  const groupCounts = new Map<string, number>();
  executionNodes
    .filter((node) => asString(node.nodeType) !== "STATION" && asString(node.nodeType) !== "MEASURED_SPINE")
    .forEach((node) => {
      const group = objectGroup(asString(node.nodeType));
      groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
    });
  const objectGroups = [
    "Civil",
    "Structures",
    "Linear Infrastructure",
    "Fiber",
    "Facilities",
    "Crossings / Constraints",
    "Administrative",
  ].map((group) => ({ group, count: groupCounts.get(group) ?? 0 }));

  const missingDependencies = spineObjectDependencies.filter((item) => !asArray(item.dependencies).length && item.dependencyGraphNotSchedule !== true).length;
  const blockedTransitionCount = executionNodes.filter((node) => asArray(asRecord(node.nextExpectedClose).blockingIssues).length > 0).length;
  const firstNextClose = executionNodes.map((node) => asRecord(node.nextExpectedClose)).find((next) => asString(next.expectedClose));
  const evidenceValues = spineObjectEvidenceRequirements.flatMap((requirement) => [
    ...asArray(requirement.requiredEvidence),
    ...asArray<JsonObject>(requirement.requiredMeasurements).map((measurement) => measurement.label),
  ]);

  return {
    status,
    draftIofReadiness,
    draftIofGateBlocked,
    draftIofGateReason: draftIofGateBlocked
      ? "Draft IOF approval prohibited until Constitutional Assembly succeeds."
      : "Constitutional Assembly passed. Draft IOF is ready for Engineering handoff.",
    readinessChecks,
    blockers,
    summary: {
      routeLengthFeet: asNumber(measuredSpine.routeLengthFeet ?? asRecord(draft.commercialSummary).routeFeet),
      routeLengthMiles: asNumber(measuredSpine.routeLengthMiles ?? asRecord(draft.commercialSummary).routeMiles),
      stationCount: asNumber(stationAuthority.stationCount, asArray(stationAuthority.stations).length),
      spineObjectCount: asNumber(constitutionalAssembly.spineObjectCount, executionExpectations.length),
      engineeringObjectCount: engineeringObjects.length,
      executionZoneCount: asArray(draft.stationRangeExpectations).length || executionNodes.filter((node) => asString(node.nodeType) === "STATION_RANGE").length,
      paymentSegmentCount: segmentValidationRules.length,
      closureExpectationCount: closureExpectations.length,
    },
    objectGroups,
    dependencySummary: {
      status: missingDependencies ? "FAIL" : "PASS",
      concurrentExecutionZones: executionNodes.filter((node) => !asArray(node.dependencies).length && asString(node.nodeType) !== "STATION").length,
      blockedObjects: blockers.length,
      readyObjects: Math.max(0, executionExpectations.length - blockers.length),
      missingDependencies,
    },
    closeSequenceSummary: {
      legalSequences: spineObjectCloseSequences.length,
      missingSequences: spineObjectCloseSequences.filter((item) => !asArray(item.legalCloseSequence).length).length,
      sequenceConflicts: executionExpectations.filter((expectation) => JSON.stringify(asArray(expectation.legalCloseSequence)) !== JSON.stringify(asArray(expectation.expectedCloseSequence))).length,
      blockedTransitions: blockedTransitionCount,
      nextDeterministicClose: asString(firstNextClose?.expectedClose, asString(spineObjectCloseSequences[0]?.nextDeterministicClose, "n/a")),
    },
    evidenceSummary: [
      { label: "GPS", count: includesToken(evidenceValues, "GPS") ? spineObjectEvidenceRequirements.length : 0 },
      { label: "Photos", count: includesToken(evidenceValues, "PHOTO") ? spineObjectEvidenceRequirements.length : 0 },
      { label: "Depth", count: evidenceValues.filter((value) => String(value ?? "").toUpperCase().includes("DEPTH")).length },
      { label: "OTDR", count: evidenceValues.filter((value) => String(value ?? "").toUpperCase().includes("OTDR") || String(value ?? "").toUpperCase().includes("TEST")).length },
      { label: "Inspection", count: spineObjectCloseSequences.filter((sequence) => asArray(sequence.legalCloseSequence).includes("INSPECTION_CLOSE")).length },
      { label: "Acceptance", count: spineObjectCloseSequences.filter((sequence) => asArray(sequence.legalCloseSequence).includes("ACCEPTANCE_CLOSE")).length },
    ],
    segmentSummary: {
      paymentSegments: segmentValidationRules.length,
      blockedSegments: segmentValidationRules.filter((rule) => asString(rule.status).toUpperCase() === "FAIL" || asArray(rule.blockingIssues).length > 0).length,
      validatedSegments: executionNodes.filter((node) => asString(asRecord(node.currentTruth).status) === "PROVEN").length,
      futurePaymentEligibleSegments: paymentEligibilityRules.length,
    },
  };
}

export default function ConstitutionalAssemblyReviewPanel({
  draftPackage,
  onFocusSpineObject,
}: ConstitutionalAssemblyReviewPanelProps) {
  const review = evaluateConstitutionalAssemblyReview(draftPackage);
  const draft = asRecord(draftPackage);
  const constitutionalAssembly = asRecord(draft.constitutionalAssembly);
  const measuredSpine = asRecord(draft.measuredSpine);
  const stationAuthority = asRecord(draft.stationAuthority);
  const kernelExecutionGraph = asRecord(draft.kernelExecutionGraph);
  const draftIofReadiness = review.draftIofReadiness;

  return (
    <section className="dal-panel constitutional-assembly-review-panel" aria-label="Constitutional Assembly Review">
      <div className="dal-panel-title-row">
        <div>
          <h3>Constitutional Assembly Review</h3>
          <span>Commercial Review - Constitutional Assembly Review - Station Aware Object Review</span>
        </div>
        <span className={`dal-badge ${statusClass(review.status)}`}>{review.status}</span>
      </div>

      <div className="dal-status">
        This panel is read-only. It renders the persisted Draft IOF constitutional model and does not regenerate Commercial, Engineering, ScopeVersion, Service Orders, Marketplace, Control, Field, or Operational Twin state.
      </div>

      <section className="constitutional-review-section">
        <div className="dal-panel-title-row">
          <div>
            <h3>Executive Status</h3>
            <span>{review.draftIofGateReason}</span>
          </div>
          <span className={`dal-badge ${statusClass(draftIofReadiness)}`}>{draftIofReadiness}</span>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Draft IOF Ready</span><b>{draftIofReadiness}</b></div>
          <div><span>Authority</span><b>{asString(constitutionalAssembly.authority, "CONSTITUTIONAL_ASSEMBLY_AUTHORITY")}</b></div>
          <div><span>Package Revision</span><b>{asString(draft.packageRevision, "0")}</b></div>
          <div><span>Product</span><b>{asString(draft.productName, "n/a")}</b></div>
          <div><span>Doctrine</span><b>{`${asString(draft.doctrineId, "PD-001")} ${asString(draft.productDoctrineVersion)}`.trim()}</b></div>
          <div><span>Configurator</span><b>{asString(draft.productConfigurator ?? draft.configuratorVersion, "n/a")}</b></div>
          <div><span>Assembly</span><b>{asString(constitutionalAssembly.status, "Missing")}</b></div>
          <div><span>Kernel Graph</span><b>{asString(kernelExecutionGraph.graphId, "Missing")}</b></div>
        </div>
      </section>

      <section className="constitutional-review-section">
        <h3>Spine Summary</h3>
        <div className="teralinx-summary-grid">
          <div><span>Route Length</span><b>{feet(review.summary.routeLengthFeet)} / {miles(review.summary.routeLengthMiles)}</b></div>
          <div><span>Station Count</span><b>{review.summary.stationCount.toLocaleString()}</b></div>
          <div><span>Spine Object Count</span><b>{review.summary.spineObjectCount.toLocaleString()}</b></div>
          <div><span>Engineering Object Count</span><b>{review.summary.engineeringObjectCount.toLocaleString()}</b></div>
          <div><span>Execution Zone Count</span><b>{review.summary.executionZoneCount.toLocaleString()}</b></div>
          <div><span>Payment Segment Count</span><b>{review.summary.paymentSegmentCount.toLocaleString()}</b></div>
          <div><span>Closure Expectation Count</span><b>{review.summary.closureExpectationCount.toLocaleString()}</b></div>
          <div><span>Measured Spine</span><b>{asString(measuredSpine.geometryHash, "Missing")}</b></div>
          <div><span>Station Authority</span><b>{asString(stationAuthority.authorityId, "Missing")}</b></div>
        </div>
      </section>

      <section className="constitutional-review-section">
        <h3>Constitutional Readiness</h3>
        <div className="dal-list constitutional-readiness-list">
          {review.readinessChecks.map((check) => (
            <div className="dal-list-row teralinx-list-row" key={check.key}>
              <b>{check.label}</b>
              <span className={`dal-badge ${statusClass(check.status)}`}>{check.status}</span>
              <small>{check.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="constitutional-review-section">
        <h3>Spine Object Summary</h3>
        <div className="teralinx-summary-grid">
          {review.objectGroups.map((group) => (
            <div key={group.group}><span>{group.group}</span><b>{group.count.toLocaleString()}</b></div>
          ))}
        </div>
      </section>

      <section className="constitutional-review-section">
        <div className="dal-panel-title-row">
          <div>
            <h3>Dependency Summary</h3>
            <span>Dependencies are not schedules. Independent Spine Objects may advance concurrently when their prerequisite Closes are satisfied.</span>
          </div>
          <span className={`dal-badge ${statusClass(review.dependencySummary.status)}`}>{review.dependencySummary.status}</span>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Concurrent Execution Zones</span><b>{review.dependencySummary.concurrentExecutionZones.toLocaleString()}</b></div>
          <div><span>Blocked Objects</span><b>{review.dependencySummary.blockedObjects.toLocaleString()}</b></div>
          <div><span>Ready Objects</span><b>{review.dependencySummary.readyObjects.toLocaleString()}</b></div>
          <div><span>Missing Dependencies</span><b>{review.dependencySummary.missingDependencies.toLocaleString()}</b></div>
        </div>
      </section>

      <section className="constitutional-review-section">
        <h3>Close Sequence Validation</h3>
        <div className="teralinx-summary-grid">
          <div><span>Legal Sequences</span><b>{review.closeSequenceSummary.legalSequences.toLocaleString()}</b></div>
          <div><span>Missing Sequences</span><b>{review.closeSequenceSummary.missingSequences.toLocaleString()}</b></div>
          <div><span>Sequence Conflicts</span><b>{review.closeSequenceSummary.sequenceConflicts.toLocaleString()}</b></div>
          <div><span>Blocked Transitions</span><b>{review.closeSequenceSummary.blockedTransitions.toLocaleString()}</b></div>
          <div><span>Next Deterministic Close</span><b>{titleCase(review.closeSequenceSummary.nextDeterministicClose)}</b></div>
        </div>
      </section>

      <section className="constitutional-review-section">
        <h3>Evidence Summary</h3>
        <div className="teralinx-summary-grid">
          {review.evidenceSummary.map((item) => (
            <div key={item.label}><span>{item.label}</span><b>{item.count.toLocaleString()}</b></div>
          ))}
        </div>
      </section>

      <section className="constitutional-review-section">
        <div className="dal-panel-title-row">
          <div>
            <h3>Segment Validation</h3>
            <span>NO CLOSE -&gt; NO VALIDATION -&gt; NO PAYMENT</span>
          </div>
          <span className={`dal-badge ${statusClass(review.segmentSummary.blockedSegments ? "FAIL" : "PASS")}`}>{review.segmentSummary.blockedSegments ? "BLOCKED" : "READY"}</span>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Payment Segments</span><b>{review.segmentSummary.paymentSegments.toLocaleString()}</b></div>
          <div><span>Blocked Segments</span><b>{review.segmentSummary.blockedSegments.toLocaleString()}</b></div>
          <div><span>Validated Segments</span><b>{review.segmentSummary.validatedSegments.toLocaleString()}</b></div>
          <div><span>Future Payment Eligible Segments</span><b>{review.segmentSummary.futurePaymentEligibleSegments.toLocaleString()}</b></div>
        </div>
      </section>

      <section className="constitutional-review-section">
        <div className="dal-panel-title-row">
          <div>
            <h3>Blocking Issues</h3>
            <span>{review.blockers.length ? "Select a blocker to sync Station Aware Object Review." : "No constitutional assembly blockers."}</span>
          </div>
          <span className={`dal-badge ${statusClass(review.blockers.length ? "FAIL" : "PASS")}`}>{review.blockers.length.toLocaleString()}</span>
        </div>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Spine Object</th>
                <th>Station</th>
                <th>Doctrine</th>
                <th>Reason</th>
                <th>Required Resolution</th>
                <th>Station Review Sync</th>
              </tr>
            </thead>
            <tbody>
              {review.blockers.length ? review.blockers.map((blocker) => (
                <tr key={blocker.blockerId}>
                  <td><b>{blocker.spineObjectId}</b></td>
                  <td>{blocker.stationRef || "n/a"}</td>
                  <td>{blocker.doctrine}</td>
                  <td>{blocker.reason}</td>
                  <td>{blocker.requiredResolution}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onFocusSpineObject?.({
                        blockerId: blocker.blockerId,
                        spineObjectId: blocker.spineObjectId,
                        stationRef: blocker.stationRef,
                      })}
                    >
                      Station Aware Object Review
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6}>Constitutional Assembly has no blocking issues.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {review.draftIofGateBlocked ? (
        <div className="dal-status fail">Draft IOF approval prohibited until Constitutional Assembly succeeds.</div>
      ) : (
        <div className="dal-status pass">Constitutional Assembly succeeds. Draft IOF approval is available for Engineering handoff.</div>
      )}
    </section>
  );
}
