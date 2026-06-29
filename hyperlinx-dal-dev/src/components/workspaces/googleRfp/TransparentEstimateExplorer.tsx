import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  TransparentCorridorEstimate,
  TransparentEstimateControls,
  TransparentEstimateFinancialControls,
  TransparentEstimateLineItem,
  TransparentEstimateProductionControls,
  TransparentEstimateSection,
} from "../../../commercial/TransparentEstimatingEngine";
import type {
  IlaFacilityProfileId,
  IlaPlacementMethod,
  IlaPlanningControls,
} from "../../../commercial/IlaPlanningEngine";
import {
  authorityModeConfidence,
  authorityModeCostIncluded,
  type ConstraintAuthorityMode,
  type ConstraintValue,
} from "../../../commercial/ConstraintAuthority";

type ProductionKey = keyof TransparentEstimateProductionControls;
type FinancialKey = keyof TransparentEstimateFinancialControls;

const PRODUCTION_CONTROLS: Array<{ key: ProductionKey; label: string; unit: string }> = [
  { key: "directionalBoreDirtFeetPerDay", label: "Directional Bore Dirt", unit: "ft/day" },
  { key: "directionalBoreRockFeetPerDay", label: "Directional Bore Rock", unit: "ft/day" },
  { key: "openTrenchDirtFeetPerDay", label: "Open Trench Dirt", unit: "ft/day" },
  { key: "openTrenchRockFeetPerDay", label: "Open Trench Rock", unit: "ft/day" },
  { key: "plowFeetPerDay", label: "Plow", unit: "ft/day" },
  { key: "fiberBlowingFeetPerDay", label: "Fiber Blowing", unit: "ft/day" },
  { key: "fiberPullingFeetPerDay", label: "Fiber Pulling", unit: "ft/day" },
  { key: "splicingTerminationsPerDay", label: "Splicing", unit: "terms/day" },
  { key: "testingFeetPerDay", label: "Testing", unit: "ft/day" },
  { key: "restorationFeetPerDay", label: "Restoration", unit: "ft/day" },
];

const FINANCIAL_CONTROLS: Array<{ key: FinancialKey; label: string; unit: string }> = [
  { key: "overheadPercent", label: "Overhead", unit: "%" },
  { key: "markupPercent", label: "Markup", unit: "%" },
  { key: "monthlyOmPerRouteMile", label: "Monthly O&M", unit: "$/mi" },
];

const AUTHORITY_CONTROL_GROUPS: Array<{ label: string; keys: string[] }> = [
  {
    label: "Civil Mix",
    keys: [
      "civil.plowPercent",
      "civil.directionalBoreDirtPercent",
      "civil.directionalBoreRockPercent",
      "civil.openTrenchPercent",
      "civil.rockAdderPerFoot",
    ],
  },
  {
    label: "Production Rates",
    keys: [
      "production.directionalBoreDirtFeetPerDay",
      "production.directionalBoreRockFeetPerDay",
      "production.plowFeetPerDay",
      "production.openTrenchDirtFeetPerDay",
      "production.openTrenchRockFeetPerDay",
      "production.fiberBlowingFeetPerDay",
      "production.fiberPullingFeetPerDay",
      "production.splicingTerminationsPerDay",
      "production.testing",
      "production.restoration",
      "production.hydrovac",
    ],
  },
  {
    label: "Crew / Material Rates",
    keys: [
      "labor.plowLaborPerFoot",
      "labor.dirtBoreLaborPerFoot",
      "labor.openTrenchLaborPerFoot",
      "labor.fiberBlowLaborPerFoot",
      "labor.splicingLaborPerTermination",
      "labor.projectManagerAnnualLoadedCost",
      "material.conduitPerFoot",
      "material.futurePathPerFoot",
      "material.fiber864PerFoot",
      "material.handholeLaborEach",
      "material.handholeMaterialEach",
      "material.spliceCaseEach",
      "ila.facilityCost",
    ],
  },
  {
    label: "Contingency Categories",
    keys: [
      "contingency.projectAdministration",
      "contingency.projectManagement",
      "contingency.materialHandling",
      "contingency.shipping",
      "contingency.storage",
      "contingency.smallToolsConsumables",
      "contingency.insuranceBonding",
      "contingency.generalConditions",
      "contingency.overheadRecovery",
      "contingency.cogsBuffer",
      "contingency.estimatingRisk",
      "contingency.unknownConditions",
    ],
  },
  {
    label: "O&M / Crossings",
    keys: [
      "financial.omCostPerRouteMile",
      "om.layer1Monitoring",
      "om.preventiveMaintenance",
      "om.locateSupport",
      "om.emergencyResponse",
      "om.annualInspection",
      "om.documentation",
      "om.assetRegistry",
      "om.slaReporting",
      "crossing.riverMethod",
      "crossing.rail",
      "crossing.water",
      "crossing.dot",
      "utility.conflicts",
      "environmental.impacts",
      "bridge.attachments",
      "permit.jurisdictionFees",
    ],
  },
];

const CIVIL_MIX_KEYS = new Set([
  "civil.plowPercent",
  "civil.directionalBoreDirtPercent",
  "civil.directionalBoreRockPercent",
  "civil.openTrenchPercent",
]);

const LIFECYCLE_MONTHS = 36;
const ILA_PROFILE_IDS: IlaFacilityProfileId[] = [
  "ILA_36_RACK_DOUBLE_WIDE",
  "ILA_72_RACK_COMPOUND",
  "ILA_144_RACK_COMPOUND",
  "ILA_CUSTOM",
];
const ILA_PLACEMENT_METHODS: Array<{ value: IlaPlacementMethod; label: string }> = [
  { value: "MAX_SPAN", label: "Maximum span" },
  { value: "MAX_OPTICAL_LOSS", label: "Maximum optical loss" },
  { value: "MAX_ATTENUATION", label: "Maximum attenuation" },
  { value: "INTERMEDIATE_COUNT", label: "Desired intermediate ILAs" },
];

function fieldValue(value: number | null) {
  return value === null ? "" : String(value);
}

function numberFromInput(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function shortTimestamp(value: string | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sumCrewCount(estimate: TransparentCorridorEstimate) {
  return estimate.laborLineItems.reduce((total, line) => total + (line.crewCount.value ?? 0), 0);
}

function calculatedDurationDays(estimate: TransparentCorridorEstimate) {
  return Math.round(estimate.laborLineItems.reduce((max, line) => Math.max(max, line.durationDays.value ?? 0), 0));
}

function authorityBadgeClass(mode: ConstraintAuthorityMode) {
  if (mode === "HUMAN_APPROVED" || mode === "APPROVED" || mode === "HUMAN" || mode === "API") return "pass";
  if (mode === "PENDING_HUMAN") return "warning";
  if (mode === "ALGORITHM" || mode === "SYNTHESIS") return "warning";
  return "fail";
}

function isHumanApproved(mode: ConstraintAuthorityMode) {
  return mode === "HUMAN_APPROVED" || mode === "APPROVED";
}

function isPendingHuman(mode: ConstraintAuthorityMode) {
  return mode === "PENDING_HUMAN" || mode === "HUMAN";
}

function isCivilMixConstraint(key: string) {
  return CIVIL_MIX_KEYS.has(key);
}

function authorityLabel(mode: ConstraintAuthorityMode) {
  return mode.replaceAll("_", " ");
}

function constraintInputValue(constraint: ConstraintValue) {
  if (constraint.value === null) return "";
  return String(constraint.value);
}

function constraintIsNumeric(constraint: ConstraintValue) {
  return typeof constraint.value === "number" || Boolean(constraint.unit);
}

function parseConstraintInput(constraint: ConstraintValue, input: string): ConstraintValue["value"] {
  if (!input.trim()) return null;
  if (constraintIsNumeric(constraint)) {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : constraint.value;
  }
  return input;
}

function costImpactLabel(constraint: ConstraintValue) {
  if (authorityModeCostIncluded(constraint)) return "Included";
  if (constraint.affectsCost) return "No automatic cost";
  return "Confidence only";
}

function scheduleImpactLabel(constraint: ConstraintValue) {
  return constraint.affectsSchedule ? "Schedule" : "No schedule";
}

function constraintDisplay(constraint: ConstraintValue) {
  if (constraint.value === null) return "UNKNOWN";
  return `${constraint.value.toLocaleString()}${constraint.unit ? ` ${constraint.unit}` : ""}`;
}

function updateConstraint(
  constraint: ConstraintValue,
  patch: Partial<ConstraintValue>,
  onConstraintChange?: (value: ConstraintValue) => void,
  onEditStart?: (label: string, affectedSections: string[]) => void,
) {
  if (!onConstraintChange) return;
  onEditStart?.(constraint.label, affectedSectionsForConstraint(constraint.key));
  const valueEdited = Object.prototype.hasOwnProperty.call(patch, "value");
  const modeEdited = Object.prototype.hasOwnProperty.call(patch, "authorityMode");
  const nextMode = patch.authorityMode ?? (valueEdited ? "PENDING_HUMAN" : constraint.authorityMode);
  const resetApproval = valueEdited || (modeEdited && !isHumanApproved(nextMode));
  onConstraintChange({
    ...constraint,
    ...patch,
    authorityMode: nextMode,
    confidence: patch.confidence ?? ((modeEdited || valueEdited) ? authorityModeConfidence(nextMode) : constraint.confidence),
    source: patch.source ?? (valueEdited ? "Ryan estimate calibration" : constraint.source),
    approvedBy: resetApproval ? undefined : (patch.approvedBy ?? constraint.approvedBy),
    approvedAt: resetApproval ? undefined : (patch.approvedAt ?? constraint.approvedAt),
    lastUpdated: new Date().toISOString(),
  });
}

function affectedSectionsForConstraint(key: string) {
  if (key.startsWith("civil.")) return ["Labor", "OSP construction", "Schedule", "Contingency", "Margin"];
  if (key.startsWith("production.")) return ["Duration", "Crew requirements", "Labor", "Schedule"];
  if (key.startsWith("labor.")) return ["Labor", "Construction cost", "Contingency", "Margin"];
  if (key.startsWith("material.")) return ["Materials", "Construction cost", "Contingency", "Margin"];
  if (key.startsWith("contingency.")) return ["Contingency", "Sell price", "Margin"];
  if (key.startsWith("om.") || key === "financial.omCostPerRouteMile") return ["MRC", "Layer 1 lifecycle", "Financial summary"];
  if (key.startsWith("crossing.")) return ["Confidence", "Schedule review", "Commercial readiness"];
  if (key.startsWith("ila.")) return ["ILA facilities", "Equipment cost", "Margin"];
  return ["Estimate", "Financial model"];
}

function moneyDelta(value: number) {
  const rounded = Math.round(value);
  if (rounded === 0) return "$0";
  return `${rounded > 0 ? "+" : "-"}$${Math.abs(rounded).toLocaleString()}`;
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function moneyPrecise(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  });
}

function numberDelta(value: number, suffix = "") {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return `0${suffix}`;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}${suffix}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function ilaProfileIdFromValue(value: string): IlaFacilityProfileId {
  return ILA_PROFILE_IDS.includes(value as IlaFacilityProfileId) ? value as IlaFacilityProfileId : "ILA_36_RACK_DOUBLE_WIDE";
}

function ilaPlacementMethodFromValue(value: string): IlaPlacementMethod {
  return ILA_PLACEMENT_METHODS.some((method) => method.value === value) ? value as IlaPlacementMethod : "MAX_SPAN";
}

function AuthorityControls({
  estimate,
  onConstraintChange,
  onEditStart,
}: {
  estimate: TransparentCorridorEstimate;
  onConstraintChange?: (value: ConstraintValue) => void;
  onEditStart?: (label: string, affectedSections: string[]) => void;
}) {
  return (
    <div className="transparent-authority-controls">
      {AUTHORITY_CONTROL_GROUPS.map((group) => (
        <details className="transparent-authority-group" key={group.label} open={group.label !== "O&M / Crossings"}>
          <summary>
            <span>{group.label}</span>
            <b>{group.keys.filter((key) => estimate.constraintValues[key]).length.toLocaleString()} constraints</b>
          </summary>
          <div className="transparent-authority-grid">
            {group.keys.map((key) => {
              const constraint = estimate.constraintValues[key];
              if (!constraint) return null;
              const algorithmConstraint = estimate.controls.algorithmConstraints?.[constraint.key];
              const civilMixConstraint = isCivilMixConstraint(constraint.key);
              const pendingHuman = isPendingHuman(constraint.authorityMode);
              const humanApproved = isHumanApproved(constraint.authorityMode);
              const valueEditable = Boolean(onConstraintChange) && (civilMixConstraint || pendingHuman || humanApproved);
              const reasonEditable = Boolean(onConstraintChange) && (pendingHuman || humanApproved);
              const canUseAlgorithm = Boolean(
                algorithmConstraint &&
                algorithmConstraint.authorityMode === "ALGORITHM" &&
                (constraint.authorityMode !== "ALGORITHM" || !Object.is(constraint.value, algorithmConstraint.value)),
              );
              const canApprove = pendingHuman && constraint.value !== null;
              return (
                <div className="transparent-authority-row" key={constraint.key}>
                  <div className="transparent-authority-main">
                    <b>{constraint.label}</b>
                    <span>{constraintDisplay(constraint)}</span>
                    <small>{constraint.sourceDetail ?? constraint.source}</small>
                  </div>
                  <label>
                    <span>Value</span>
                    <input
                      type={constraintIsNumeric(constraint) ? "number" : "text"}
                      min={constraintIsNumeric(constraint) ? "0" : undefined}
                      value={constraintInputValue(constraint)}
                      placeholder="UNKNOWN"
                      disabled={!valueEditable}
                      onChange={(event) => updateConstraint(
                        constraint,
                        { value: parseConstraintInput(constraint, event.currentTarget.value) },
                        onConstraintChange,
                        onEditStart,
                      )}
                    />
                  </label>
                  <label>
                    <span>Reason</span>
                    <input
                      type="text"
                      value={constraint.notes ?? ""}
                      placeholder="Optional"
                      disabled={!reasonEditable}
                      onChange={(event) => updateConstraint(
                        constraint,
                        { notes: event.currentTarget.value },
                        onConstraintChange,
                        onEditStart,
                      )}
                    />
                  </label>
                  <label>
                    <span>Confidence</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={constraint.confidence}
                      disabled={!valueEditable}
                      onChange={(event) => updateConstraint(
                        constraint,
                        { confidence: Math.max(0, Math.min(100, Math.round(Number(event.currentTarget.value) || 0))) },
                        onConstraintChange,
                        onEditStart,
                      )}
                    />
                  </label>
                  <div className="transparent-authority-flags">
                    <span className={`dal-badge ${authorityBadgeClass(constraint.authorityMode)}`}>{authorityLabel(constraint.authorityMode)}</span>
                    <small>{costImpactLabel(constraint)}</small>
                    <small>{scheduleImpactLabel(constraint)}</small>
                  </div>
                  <div className="transparent-authority-actions">
                    {canUseAlgorithm && algorithmConstraint ? (
                      <button
                        type="button"
                        onClick={() => updateConstraint(
                          constraint,
                          {
                            ...algorithmConstraint,
                            authorityMode: "ALGORITHM",
                            confidence: authorityModeConfidence("ALGORITHM"),
                            approvedBy: undefined,
                            approvedAt: undefined,
                            notes: undefined,
                          },
                          onConstraintChange,
                          onEditStart,
                        )}
                      >
                        Use Algorithm
                      </button>
                    ) : null}
                    {constraint.authorityMode === "UNKNOWN" ? (
                      <span className="transparent-authority-status warning">Needs Human Value</span>
                    ) : null}
                    {humanApproved ? (
                      <span className="transparent-authority-status pass">✔ Human Approved</span>
                    ) : null}
                    {pendingHuman && canApprove ? (
                      <button
                        type="button"
                        onClick={() => updateConstraint(
                          constraint,
                          {
                            authorityMode: "HUMAN_APPROVED",
                            confidence: authorityModeConfidence("HUMAN_APPROVED"),
                            source: "Ryan",
                            approvedBy: "Ryan",
                            approvedAt: new Date().toISOString(),
                          },
                          onConstraintChange,
                          onEditStart,
                        )}
                      >
                        Approve
                      </button>
                    ) : null}
                    {pendingHuman && !canApprove ? (
                      <span className="transparent-authority-status warning">Enter a value to approve</span>
                    ) : null}
                    {!pendingHuman && !humanApproved ? (
                      <button
                        type="button"
                        onClick={() => updateConstraint(
                          constraint,
                          {
                            authorityMode: "PENDING_HUMAN",
                            confidence: authorityModeConfidence("PENDING_HUMAN"),
                            source: "Ryan estimate calibration",
                            approvedBy: undefined,
                            approvedAt: undefined,
                          },
                          onConstraintChange,
                          onEditStart,
                        )}
                      >
                        Enter Human Value
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

function AuthorityTransparencySummary({ estimate }: { estimate: TransparentCorridorEstimate }) {
  const constraints = Object.values(estimate.constraintValues);
  const approvedCount = constraints.filter((constraint) => isHumanApproved(constraint.authorityMode)).length;
  const pendingCount = constraints.filter((constraint) => isPendingHuman(constraint.authorityMode)).length;
  const apiCount = constraints.filter((constraint) => constraint.authorityMode === "API").length;
  const algorithmCount = constraints.filter((constraint) => constraint.authorityMode === "ALGORITHM").length;
  const synthesisCount = constraints.filter((constraint) => constraint.authorityMode === "SYNTHESIS").length;
  const unknownCount = constraints.filter((constraint) => constraint.authorityMode === "UNKNOWN").length;
  const costIncludedCount = constraints.filter((constraint) => authorityModeCostIncluded(constraint)).length;
  return (
    <div className="transparent-authority-summary">
      <div><span>Human Approved</span><b>{approvedCount.toLocaleString()}</b></div>
      <div><span>Pending Human</span><b>{pendingCount.toLocaleString()}</b></div>
      <div><span>API</span><b>{apiCount.toLocaleString()}</b></div>
      <div><span>Algorithm</span><b>{algorithmCount.toLocaleString()}</b></div>
      <div><span>Synthesis</span><b>{synthesisCount.toLocaleString()}</b></div>
      <div><span>Unknowns</span><b>{unknownCount.toLocaleString()}</b></div>
      <div><span>Cost Included</span><b>{costIncludedCount.toLocaleString()}</b></div>
    </div>
  );
}

function CommercialReadinessPanel({ estimate }: { estimate: TransparentCorridorEstimate }) {
  return (
    <div className="transparent-calibration-panel">
      <div className="transparent-calibration-heading">
        <div>
          <b>Commercial Readiness</b>
          <span>Separate from estimate confidence</span>
        </div>
        <span className={`dal-badge ${estimate.commercialReadiness.level === "READY" ? "pass" : estimate.commercialReadiness.level === "BLOCKED" ? "fail" : "warning"}`}>
          {estimate.commercialReadiness.score}% {estimate.commercialReadiness.level}
        </span>
      </div>
      <div className="transparent-readiness-grid">
        {estimate.commercialReadiness.drivers.map((driver) => (
          <div key={driver.label}>
            <b>{driver.label}</b>
            <span>{driver.status}</span>
            <small>{driver.impact ? `-${driver.impact}` : "No deduction"} / {driver.reason}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function CivilMixStatusPanel({
  estimate,
  onCivilMixModeChange,
}: {
  estimate: TransparentCorridorEstimate;
  onCivilMixModeChange: (mode: TransparentEstimateControls["civilMixMode"]) => void;
}) {
  const balanced = Math.abs(estimate.civilMix.totalPercent - 100) <= 0.01;
  return (
    <div className="transparent-calibration-panel">
      <div className="transparent-calibration-heading">
        <div>
          <b>Civil Mix</b>
          <span>Plow, dirt bore, rock bore, and open trench must total 100%</span>
        </div>
        <select
          aria-label="Civil mix balancing mode"
          value={estimate.civilMix.mode}
          onChange={(event) => onCivilMixModeChange(event.currentTarget.value as TransparentEstimateControls["civilMixMode"])}
        >
          <option value="AUTOMATIC">Automatic (Maintain 100%)</option>
          <option value="MANUAL">Manual (Engineer Controlled)</option>
        </select>
      </div>
      <div className="transparent-estimate-metrics">
        <div><span>Plow</span><b>{estimate.civilMix.plowPercent}%</b></div>
        <div><span>Dirt Bore</span><b>{estimate.civilMix.directionalBoreDirtPercent}%</b></div>
        <div><span>Rock Bore</span><b>{estimate.civilMix.directionalBoreRockPercent}%</b></div>
        <div><span>Open Trench</span><b>{estimate.civilMix.openTrenchPercent}%</b></div>
        <div><span>Total</span><b className={`transparent-civil-total ${balanced ? "pass" : "warning"}`}>{estimate.civilMix.totalPercent}%</b></div>
        <div><span>Mode</span><b>{estimate.civilMix.mode === "AUTOMATIC" ? "Automatic" : "Manual"}</b></div>
      </div>
      {estimate.civilMix.warning ? <div className="dal-status">{estimate.civilMix.warning}</div> : null}
    </div>
  );
}

function CalibrationPanel({
  estimate,
  impact,
}: {
  estimate: TransparentCorridorEstimate;
  impact: {
    label: string;
    budgetDelta: number;
    durationDelta: number;
    confidenceDelta: number;
    affectedSections: string[];
  } | null;
}) {
  return (
    <div className="transparent-calibration-panel">
      <div className="transparent-calibration-heading">
        <div>
          <b>Estimate Calibration</b>
          <span>Production, rates, civil mix, contingencies, O&M, and authority changes recalculate immediately</span>
        </div>
        <span className="dal-badge pass">{estimate.estimateStatus.replaceAll("_", " ")}</span>
      </div>
      <div className="transparent-estimate-metrics">
        <div><span>Duration</span><b>{calculatedDurationDays(estimate).toLocaleString()} days</b></div>
        <div><span>Cost</span><b>{money(estimate.totalKnownCost)}</b></div>
        <div><span>Sell Price</span><b>{estimate.financialModel.sellPrice.display}</b></div>
        <div><span>Margin</span><b>{estimate.grossMarginPercent}%</b></div>
        <div><span>Confidence</span><b>{estimate.confidence.score}%</b></div>
        <div><span>MRC</span><b>{estimate.financialModel.mrc.display}</b></div>
      </div>
      {impact ? (
        <div className="transparent-impact-panel">
          <b>{impact.label}</b>
          <span>Budget: {moneyDelta(impact.budgetDelta)}</span>
          <span>Duration: {numberDelta(impact.durationDelta, " days")}</span>
          <span>Confidence: {numberDelta(impact.confidenceDelta, " pts")}</span>
          <small>Affects: {impact.affectedSections.join(", ")}</small>
        </div>
      ) : (
        <div className="transparent-impact-panel">
          <b>Ready for calibration</b>
          <span>Local estimate inputs recalculate without a manual refresh.</span>
          <small>Manual refresh remains reserved for OSRM, API, synthesis, customer inventory, and geometry changes.</small>
        </div>
      )}
    </div>
  );
}

function LineTable({ lineItems }: { lineItems: TransparentEstimateLineItem[] }) {
  if (!lineItems.length) return null;
  return (
    <div className="dal-table-wrap transparent-estimate-table">
      <table className="dal-table">
        <thead>
          <tr>
            <th>Line</th>
            <th>Quantity</th>
            <th>Production</th>
            <th>Required</th>
            <th>Crew</th>
            <th>Duration</th>
            <th>Unit Cost</th>
            <th>Cost</th>
            <th>Authority</th>
            <th>Confidence</th>
            <th>Cost Impact</th>
            <th>Schedule Impact</th>
            <th>Dependencies</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((line) => (
            <tr key={line.lineItemId}>
              <td>{line.description}</td>
              <td>{line.quantity.display}</td>
              <td>{line.production.display}</td>
              <td>{line.requiredProduction.display}</td>
              <td>{line.crewCount.display}</td>
              <td>{line.durationDays.display}</td>
              <td>{line.unitCost.display}</td>
              <td>{line.extendedCost.display}</td>
              <td><span className={`dal-badge ${authorityBadgeClass(line.authority.authorityMode)}`}>{authorityLabel(line.authority.authorityMode)}</span></td>
              <td>{line.authority.confidence}%</td>
              <td>{costImpactLabel(line.authority)}</td>
              <td>{scheduleImpactLabel(line.authority)}</td>
              <td>{line.dependencies.join(", ")}</td>
              <td>
                <span>{line.source}</span>
                {line.workbook ? <small>{line.workbook}</small> : null}
                {line.authority.approvedBy ? <small>Approved by {line.authority.approvedBy}</small> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IlaPlanningPanel({
  estimate,
  onIlaPlanningChange,
  onEditStart,
}: {
  estimate: TransparentCorridorEstimate;
  onIlaPlanningChange: (next: IlaPlanningControls) => void;
  onEditStart?: (label: string, affectedSections: string[]) => void;
}) {
  const plan = estimate.ilaPlan;
  const controls = plan.controls;
  const graphRef = useRef<SVGSVGElement | null>(null);
  const [draggingStationId, setDraggingStationId] = useState<string | null>(null);
  const intermediateStations = plan.stationObjects.filter((station) => station.stationType === "INTERMEDIATE");
  const selectedStation = plan.stationObjects.find((station) => station.stationId === controls.selectedStationId)
    ?? intermediateStations[0]
    ?? plan.stationObjects[0]
    ?? null;
  const selectedStationId = selectedStation?.stationId ?? null;
  const selectedIntermediate = selectedStation?.stationType === "INTERMEDIATE" ? selectedStation : null;
  const routeMiles = Math.max(plan.routeMiles, 0.01);
  const profileOptions = plan.availableProfiles;
  const costPerMile = plan.totalCost / routeMiles;

  function updatePlanning(patch: Partial<IlaPlanningControls>, label: string) {
    onEditStart?.(label, ["ILA facilities", "Optical engineering", "Equipment", "Financial model", "Margin"]);
    onIlaPlanningChange({
      ...controls,
      ...patch,
      stationOverrides: patch.stationOverrides ? { ...patch.stationOverrides } : { ...(controls.stationOverrides ?? {}) },
    });
  }

  function updateStationOverride(
    stationId: string,
    patch: NonNullable<IlaPlanningControls["stationOverrides"]>[string],
    label: string,
  ) {
    updatePlanning({
      selectedStationId: stationId,
      stationOverrides: {
        ...(controls.stationOverrides ?? {}),
        [stationId]: {
          ...(controls.stationOverrides?.[stationId] ?? {}),
          ...patch,
        },
      },
    }, label);
  }

  function milepostFromPointer(clientX: number) {
    const rect = graphRef.current?.getBoundingClientRect();
    if (!rect?.width) return 0;
    const ratio = clampNumber((clientX - rect.left) / rect.width, 0, 1);
    return roundTwo(ratio * plan.routeMiles);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draggingStationId) return;
    updateStationOverride(draggingStationId, { milepost: milepostFromPointer(event.clientX) }, "Moved ILA station");
  }

  function addIntermediateStation() {
    updatePlanning({
      placementMethod: "INTERMEDIATE_COUNT",
      desiredIntermediateIlas: intermediateStations.length + 1,
    }, "Added intermediate ILA");
  }

  function removeIntermediateStation(stationId: string) {
    const remaining = intermediateStations
      .filter((station) => station.stationId !== stationId)
      .sort((a, b) => a.milepost - b.milepost);
    const nextOverrides = { ...(controls.stationOverrides ?? {}) };
    Object.keys(nextOverrides).forEach((key) => {
      if (key.startsWith("ILA-INT-")) delete nextOverrides[key];
    });
    remaining.forEach((station, index) => {
      const nextId = `ILA-INT-${String(index + 1).padStart(3, "0")}`;
      nextOverrides[nextId] = {
        milepost: station.milepost,
        facilityProfileId: station.facilityProfileId,
      };
    });
    updatePlanning({
      placementMethod: "INTERMEDIATE_COUNT",
      desiredIntermediateIlas: remaining.length,
      selectedStationId: null,
      stationOverrides: nextOverrides,
    }, "Removed intermediate ILA");
  }

  function applyRecommendation() {
    const nextOverrides = { ...(controls.stationOverrides ?? {}) };
    Object.keys(nextOverrides).forEach((key) => {
      if (!key.startsWith("ILA-INT-")) return;
      const existing = nextOverrides[key];
      const ordinal = Number(key.replace("ILA-INT-", ""));
      if (ordinal > plan.recommendedIntermediateIlas) {
        delete nextOverrides[key];
        return;
      }
      nextOverrides[key] = existing?.facilityProfileId ? { facilityProfileId: existing.facilityProfileId } : {};
    });
    updatePlanning({
      placementMethod: "INTERMEDIATE_COUNT",
      desiredIntermediateIlas: plan.recommendedIntermediateIlas,
      selectedStationId,
      stationOverrides: nextOverrides,
    }, "Applied ILA recommendation");
  }

  const hasRecommendationAction = plan.recommendation.requiresApproval;

  return (
    <section className="ila-planning-panel" aria-label="ILA planning">
      <div className="ila-planning-header">
        <div>
          <h4>ILA Planning</h4>
          <span>{plan.routeId}</span>
        </div>
        <div className="ila-planning-header-metrics">
          <div><span>Stations</span><b>{plan.graphObjectCount.toLocaleString()}</b></div>
          <div><span>Route Total</span><b>{money(plan.totalCost)}</b></div>
          <div><span>Cost/Mile</span><b>{money(costPerMile)}</b></div>
          <div><span>Max Span</span><b>{plan.maxSpanMiles.toLocaleString()} mi</b></div>
          <div><span>Max Loss</span><b>{plan.maxSpanLossDb.toLocaleString()} dB</b></div>
        </div>
      </div>

      <div className="ila-planning-controls">
        <label className="ila-toggle-control">
          <span>Use Bookend ILAs</span>
          <button
            type="button"
            className={controls.useBookendIlas ? "active" : ""}
            onClick={() => updatePlanning({ useBookendIlas: !controls.useBookendIlas }, "Bookend ILA control")}
          >
            {controls.useBookendIlas ? "ON" : "OFF"}
          </button>
        </label>
        <label>
          <span>Placement</span>
          <select
            value={controls.placementMethod}
            onChange={(event) => updatePlanning({ placementMethod: ilaPlacementMethodFromValue(event.currentTarget.value) }, "ILA placement method")}
          >
            {ILA_PLACEMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Maximum span</span>
          <input
            type="number"
            min="1"
            value={controls.maxSpanMiles}
            onChange={(event) => updatePlanning({ maxSpanMiles: Math.max(1, Number(event.currentTarget.value) || 1) }, "ILA maximum span")}
          />
          <small>mi</small>
        </label>
        <label>
          <span>Maximum optical loss</span>
          <input
            type="number"
            min="1"
            step="0.1"
            value={controls.maxOpticalLossDb}
            onChange={(event) => updatePlanning({ maxOpticalLossDb: Math.max(1, Number(event.currentTarget.value) || 1) }, "ILA optical loss")}
          />
          <small>dB</small>
        </label>
        <label>
          <span>Maximum attenuation</span>
          <input
            type="number"
            min="1"
            step="0.1"
            value={controls.maxAttenuationDb}
            onChange={(event) => updatePlanning({ maxAttenuationDb: Math.max(1, Number(event.currentTarget.value) || 1) }, "ILA attenuation")}
          />
          <small>dB</small>
        </label>
        <label>
          <span>Intermediate ILAs</span>
          <input
            type="number"
            min="0"
            value={intermediateStations.length}
            onChange={(event) => updatePlanning({
              placementMethod: "INTERMEDIATE_COUNT",
              desiredIntermediateIlas: Math.max(0, Math.round(Number(event.currentTarget.value) || 0)),
            }, "Intermediate ILA count")}
          />
        </label>
        <label>
          <span>Default Facility</span>
          <select
            value={controls.defaultFacilityProfileId}
            onChange={(event) => updatePlanning({ defaultFacilityProfileId: ilaProfileIdFromValue(event.currentTarget.value) }, "Default ILA facility profile")}
          >
            {profileOptions.map((profile) => (
              <option key={profile.profileId} value={profile.profileId}>{profile.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Custom Profile Cost</span>
          <input
            type="number"
            min="0"
            value={controls.customFacilityCost}
            onChange={(event) => updatePlanning({ customFacilityCost: Math.max(0, Math.round(Number(event.currentTarget.value) || 0)) }, "Custom ILA facility cost")}
          />
        </label>
      </div>

      <div className="ila-action-row">
        <button type="button" onClick={addIntermediateStation}>Add Intermediate</button>
        {selectedIntermediate ? (
          <button type="button" onClick={() => removeIntermediateStation(selectedIntermediate.stationId)}>Remove Selected</button>
        ) : (
          <span className="transparent-authority-status">Select an intermediate station to remove</span>
        )}
        {hasRecommendationAction ? (
          <button type="button" onClick={applyRecommendation}>Apply Recommendation</button>
        ) : (
          <span className="transparent-authority-status pass">Recommendation Applied</span>
        )}
      </div>

      <div className="ila-route-graph">
        <svg
          ref={graphRef}
          viewBox="0 0 1000 190"
          role="img"
          aria-label="Station-based ILA route graph"
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDraggingStationId(null)}
          onPointerLeave={() => setDraggingStationId(null)}
        >
          <line className="ila-route-line" x1="24" y1="92" x2="976" y2="92" />
          {plan.spans.map((span) => {
            const fromStation = plan.stationObjects.find((station) => station.stationId === span.fromStationId);
            const toStation = plan.stationObjects.find((station) => station.stationId === span.toStationId);
            const x1 = fromStation ? 24 + fromStation.ratio * 952 : 24;
            const x2 = toStation ? 24 + toStation.ratio * 952 : 976;
            const x = (x1 + x2) / 2;
            return (
              <g key={span.spanId}>
                <line className={span.recommendedRegen ? "ila-span-line warning" : "ila-span-line"} x1={x1} y1="92" x2={x2} y2="92" />
                <text className="ila-span-label" x={x} y="126" textAnchor="middle">{roundOne(span.segmentLengthMiles)} mi / {span.spanLossDb} dB</text>
              </g>
            );
          })}
          {plan.stationObjects.map((station) => {
            const x = 24 + station.ratio * 952;
            const selected = station.stationId === selectedStationId;
            return (
              <g
                key={station.stationId}
                className={`ila-station-marker ${station.canMove ? "movable" : ""} ${selected ? "selected" : ""}`}
                transform={`translate(${x} 92)`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  updatePlanning({ selectedStationId: station.stationId }, "Selected ILA station");
                  if (station.canMove) setDraggingStationId(station.stationId);
                }}
              >
                <circle r={selected ? 13 : 10} />
                <text x="0" y="-22" textAnchor="middle">{station.stationType === "INTERMEDIATE" ? `ILA ${station.ordinal}` : station.stationType === "START_BOOKEND" ? "Start" : "End"}</text>
                <text x="0" y="34" textAnchor="middle">{roundOne(station.milepost)} mi</text>
                <title>{`${station.label} / ${station.gps} / ${station.facilityType} / ${money(station.totalCost)}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="ila-planning-grid">
        <div className="dal-table-wrap transparent-estimate-table ila-station-table">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Station Object</th>
                <th>Station</th>
                <th>GPS</th>
                <th>Milepost</th>
                <th>Facility Type</th>
                <th>Power</th>
                <th>HVAC</th>
                <th>Generator</th>
                <th>Racks</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {plan.stationObjects.map((station) => (
                <tr
                  key={station.stationId}
                  className={station.stationId === selectedStationId ? "selected" : ""}
                  onClick={() => updatePlanning({ selectedStationId: station.stationId }, "Selected ILA station")}
                >
                  <td>
                    <b>{station.label}</b>
                    <small>{station.graphNodeId}</small>
                    <small>{station.scopeVersionLineage}</small>
                  </td>
                  <td>{station.station}</td>
                  <td>{station.gps}</td>
                  <td>
                    {station.canMove ? (
                      <input
                        type="number"
                        min="0"
                        max={plan.routeMiles}
                        step="0.1"
                        value={station.milepost}
                        onChange={(event) => updateStationOverride(
                          station.stationId,
                          { milepost: clampNumber(Number(event.currentTarget.value) || 0, 0, plan.routeMiles) },
                          "Moved ILA station",
                        )}
                      />
                    ) : (
                      station.milepost.toLocaleString()
                    )}
                  </td>
                  <td>
                    <select
                      value={station.facilityProfileId}
                      onChange={(event) => updateStationOverride(
                        station.stationId,
                        { facilityProfileId: ilaProfileIdFromValue(event.currentTarget.value) },
                        "ILA station facility profile",
                      )}
                    >
                      {profileOptions.map((profile) => (
                        <option key={profile.profileId} value={profile.profileId}>{profile.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>{station.powerProfile}</td>
                  <td>{station.hvacProfile}</td>
                  <td>{station.generatorProfile}</td>
                  <td>{station.rackProfile}</td>
                  <td>{money(station.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ila-side-panel">
          <div className="ila-selected-card">
            <span>Selected Station</span>
            <b>{selectedStation?.label ?? "None"}</b>
            <small>{selectedStation ? `${selectedStation.station} / ${selectedStation.gps}` : "No station selected"}</small>
            <small>{selectedStation ? `${selectedStation.facilityType} / ${money(selectedStation.totalCost)}` : ""}</small>
          </div>
          <div className={`ila-recommendation-card ${plan.recommendation.requiresApproval ? "warning" : ""}`}>
            <span>Engineering Recommendation</span>
            <b>{plan.recommendedIntermediateIlas.toLocaleString()} intermediate ILAs</b>
            <small>{plan.recommendation.reason}</small>
            <div>
              <span>Added</span><b>{plan.recommendation.addedStations.toLocaleString()}</b>
              <span>Removed</span><b>{plan.recommendation.removedStations.toLocaleString()}</b>
              <span>Moved</span><b>{plan.recommendation.movedStations.toLocaleString()}</b>
              <span>Cost</span><b>{moneyDelta(plan.recommendation.costDifference)}</b>
              <span>Optical</span><b>{numberDelta(plan.recommendation.opticalDifferenceDb, " dB")}</b>
              <span>Lifecycle</span><b>{moneyDelta(plan.recommendation.lifecycleDifference)}</b>
              <span>Construction</span><b>{moneyDelta(plan.recommendation.constructionDifference)}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="dal-table-wrap transparent-estimate-table ila-optical-table">
        <table className="dal-table">
          <thead>
            <tr>
              <th>Segment</th>
              <th>Segment Length</th>
              <th>Span Loss</th>
              <th>Connector Loss</th>
              <th>Splice Loss</th>
              <th>Remaining Budget</th>
              <th>Recommended Regen</th>
            </tr>
          </thead>
          <tbody>
            {plan.spans.map((span) => (
              <tr key={span.spanId}>
                <td>{span.fromLabel} {"->"} {span.toLabel}</td>
                <td>{span.segmentLengthMiles.toLocaleString()} mi</td>
                <td>{span.spanLossDb.toLocaleString()} dB</td>
                <td>{span.connectorLossDb.toLocaleString()} dB</td>
                <td>{span.spliceLossDb.toLocaleString()} dB</td>
                <td>{span.remainingBudgetDb.toLocaleString()} dB</td>
                <td><span className={`dal-badge ${span.recommendedRegen ? "warning" : "pass"}`}>{span.recommendedRegen ? "Recommended" : "Clear"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SectionDetails({
  section,
  estimate,
  open,
  onToggle,
}: {
  section: TransparentEstimateSection;
  estimate: TransparentCorridorEstimate;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <details className="transparent-estimate-section" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <span>{section.label}</span>
        <b>{section.total?.display ?? section.summary}</b>
      </summary>
      {section.metrics.length ? (
        <div className="transparent-estimate-metrics">
          {section.metrics.map((metric) => (
            <div key={metric.metricId}>
              <span>{metric.label}</span>
              <b>{metric.value.display}</b>
              <small>{metric.value.source}</small>
            </div>
          ))}
        </div>
      ) : null}
      <LineTable lineItems={section.lineItems} />
      {section.sectionId === "ESTIMATE_CONFIDENCE" ? (
        <>
          <AuthorityTransparencySummary estimate={estimate} />
          <div className="transparent-confidence-list">
            {estimate.confidence.drivers.map((driver) => (
              <div key={driver.label}>
                <b>{driver.label}</b>
                <span>{driver.status}</span>
                <small>{driver.impact ? `-${driver.impact} confidence` : "No confidence reduction"} / {driver.reason}</small>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {section.sectionId === "ESTIMATE_AUDIT" ? (
        <>
          {estimate.humanAuditTrail.length ? (
            <div className="dal-table-wrap transparent-estimate-table">
              <table className="dal-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Item</th>
                    <th>Previous Value</th>
                    <th>New Value</th>
                    <th>Previous Authority</th>
                    <th>New Authority</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[...estimate.humanAuditTrail].reverse().map((entry) => (
                    <tr key={entry.auditId}>
                      <td>{new Date(entry.timestamp).toLocaleString()}</td>
                      <td>{entry.user}</td>
                      <td>{entry.label}</td>
                      <td>{entry.previousValue}</td>
                      <td>{entry.newValue}</td>
                      <td><span className={`dal-badge ${authorityBadgeClass(entry.previousAuthority)}`}>{authorityLabel(entry.previousAuthority)}</span></td>
                      <td><span className={`dal-badge ${authorityBadgeClass(entry.newAuthority)}`}>{authorityLabel(entry.newAuthority)}</span></td>
                      <td>{entry.reason ?? "None"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="dal-table-wrap transparent-estimate-table">
            <table className="dal-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Authority Mode</th>
                  <th>Source</th>
                  <th>Confidence</th>
                  <th>Cost Impact</th>
                  <th>Schedule Impact</th>
                  <th>Formula</th>
                  <th>Approved By</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {estimate.auditTrail.map((entry) => (
                  <tr key={entry.auditId}>
                    <td>{entry.label}</td>
                    <td>{entry.value}</td>
                    <td>{entry.unit}</td>
                    <td><span className={`dal-badge ${authorityBadgeClass(entry.authorityMode)}`}>{authorityLabel(entry.authorityMode)}</span></td>
                    <td>
                      <span>{entry.source}</span>
                      {entry.workbook ? <small>{entry.workbook}</small> : null}
                    </td>
                    <td>{entry.confidence}%</td>
                    <td>{entry.costImpact}</td>
                    <td>{entry.scheduleImpact}</td>
                    <td>{entry.formula}</td>
                    <td>{entry.approvedBy ?? "None"}</td>
                    <td>{entry.notes ?? entry.userOverride ?? (entry.calculated ? "Calculated" : "Pending")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {section.sectionId === "LAYER_1_LIFECYCLE" ? (
        <div className="transparent-opportunity-grid">
          {estimate.layer1RecurringOpportunities.map((opportunity) => (
            <div key={opportunity.opportunityId}>
              <b>{opportunity.label}</b>
              <span>Optional proposal line item</span>
              <small>{opportunity.description}</small>
            </div>
          ))}
        </div>
      ) : null}
    </details>
  );
}

export default function TransparentEstimateExplorer({
  estimate,
  controls,
  lastRecalculatedAt,
  vendorPreview,
  onTargetDurationChange,
  onProductionChange,
  onFinancialChange,
  onConstraintChange,
  onCivilMixModeChange,
  onIlaPlanningChange,
}: {
  estimate: TransparentCorridorEstimate;
  controls: TransparentEstimateControls;
  lastRecalculatedAt?: string | null;
  vendorPreview?: string[];
  onTargetDurationChange: (days: number) => void;
  onProductionChange: (key: ProductionKey, value: number | null) => void;
  onFinancialChange: (key: FinancialKey, value: number) => void;
  onConstraintChange?: (value: ConstraintValue) => void;
  onCivilMixModeChange: (mode: TransparentEstimateControls["civilMixMode"]) => void;
  onIlaPlanningChange: (next: IlaPlanningControls) => void;
}) {
  const storageKey = `hyperlinx:transparent-estimate:sections:${estimate.estimateId}`;
  const versionStorageKey = `hyperlinx:transparent-estimate:versions:${estimate.estimateId}`;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openVersions, setOpenVersions] = useState<Record<string, boolean>>({});
  const [lastImpact, setLastImpact] = useState<{
    label: string;
    budgetDelta: number;
    durationDelta: number;
    confidenceDelta: number;
    affectedSections: string[];
  } | null>(null);
  const pendingEditRef = useRef<{ label: string; affectedSections: string[] } | null>(null);
  const previousMetricsRef = useRef<{ budget: number; duration: number; confidence: number } | null>(null);
  useEffect(() => {
    try {
      setOpenSections(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<string, boolean>);
      setOpenVersions(JSON.parse(window.localStorage.getItem(versionStorageKey) ?? "{}") as Record<string, boolean>);
    } catch {
      setOpenSections({});
      setOpenVersions({});
    }
  }, [storageKey, versionStorageKey]);
  const currentDurationDays = calculatedDurationDays(estimate);
  const routeMiles = Math.max(estimate.physicalQuantities.routeMiles, 0.01);
  const routeFeet = Math.max(estimate.physicalQuantities.routeFeet, 1);
  const marginDollars = estimate.sellPrice - estimate.totalKnownCost;
  const lifecycleRevenue = estimate.nrc + estimate.mrc * LIFECYCLE_MONTHS;
  const costPerMile = estimate.totalKnownCost / routeMiles;
  const costPerFoot = estimate.totalKnownCost / routeFeet;
  const revenuePerMile = estimate.nrc / routeMiles;
  const marginPerMile = marginDollars / routeMiles;
  useEffect(() => {
    const current = {
      budget: estimate.sellPrice,
      duration: currentDurationDays,
      confidence: estimate.confidence.score,
    };
    const previous = previousMetricsRef.current;
    const pending = pendingEditRef.current;
    if (previous && pending) {
      setLastImpact({
        label: pending.label,
        budgetDelta: current.budget - previous.budget,
        durationDelta: current.duration - previous.duration,
        confidenceDelta: current.confidence - previous.confidence,
        affectedSections: pending.affectedSections,
      });
      pendingEditRef.current = null;
    }
    previousMetricsRef.current = current;
  }, [currentDurationDays, estimate.confidence.score, estimate.sellPrice]);
  const versionComparisons = useMemo(() => [
    {
      id: "BASE_ESTIMATE",
      label: "Base Estimate",
      status: "Current engine output",
      cost: "$0",
      duration: "0 days",
      labor: "$0",
      materials: "$0",
      margin: "0%",
      confidence: "0%",
    },
    {
      id: "RYAN_CALIBRATION",
      label: "Ryan Calibration",
      status: "Current editable assumptions",
      cost: "$0",
      duration: "0 days",
      labor: "$0",
      materials: "$0",
      margin: "0%",
      confidence: "0%",
    },
    {
      id: "CUSTOMER_REQUESTED",
      label: "Customer Requested",
      status: "Not captured",
      cost: "n/a",
      duration: "n/a",
      labor: "n/a",
      materials: "n/a",
      margin: "n/a",
      confidence: "n/a",
    },
    {
      id: "ENGINEERING_REVIEW",
      label: "Engineering Review",
      status: "Not captured",
      cost: "n/a",
      duration: "n/a",
      labor: "n/a",
      materials: "n/a",
      margin: "n/a",
      confidence: "n/a",
    },
    {
      id: "COMMERCIAL_REVIEW",
      label: "Commercial Review",
      status: "Not captured",
      cost: "n/a",
      duration: "n/a",
      labor: "n/a",
      materials: "n/a",
      margin: "n/a",
      confidence: "n/a",
    },
  ], []);
  function setSectionOpen(sectionId: string, open: boolean) {
    setOpenSections((prev) => {
      const next = { ...prev, [sectionId]: open };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }
  function setVersionOpen(versionId: string, open: boolean) {
    setOpenVersions((prev) => {
      const next = { ...prev, [versionId]: open };
      window.localStorage.setItem(versionStorageKey, JSON.stringify(next));
      return next;
    });
  }
  function noteLocalEdit(label: string, affectedSections: string[]) {
    pendingEditRef.current = { label, affectedSections };
  }
  const requiredCrews = sumCrewCount(estimate);
  return (
    <div className="transparent-estimate-explorer">
      <div className="transparent-estimate-pinned-summary">
        <div><span>Route Miles</span><b>{estimate.physicalQuantities.routeMiles.toLocaleString()}</b></div>
        <div><span>Construction Cost</span><b>{money(estimate.totalKnownCost)}</b></div>
        <div><span>Direct Cost</span><b>{estimate.financialModel.constructionCost.display}</b></div>
        <div><span>Labor</span><b>{estimate.financialModel.labor.display}</b></div>
        <div><span>Materials</span><b>{estimate.financialModel.materials.display}</b></div>
        <div><span>Equipment</span><b>{estimate.financialModel.equipment.display}</b></div>
        <div><span>Contingency</span><b>{estimate.financialModel.contingency.display}</b></div>
        <div><span>Sell Price</span><b>{estimate.financialModel.sellPrice.display}</b></div>
        <div><span>Margin $</span><b>{money(marginDollars)}</b></div>
        <div><span>Margin %</span><b>{estimate.grossMarginPercent}%</b></div>
        <div><span>NRC</span><b>{estimate.financialModel.nrc.display}</b></div>
        <div><span>MRC</span><b>{estimate.financialModel.mrc.display}</b></div>
        <div><span>Lifecycle Revenue</span><b>{money(lifecycleRevenue)}</b></div>
        <div><span>Production</span><b>{requiredCrews.toLocaleString()} crews</b></div>
        <div><span>Schedule</span><b>{currentDurationDays.toLocaleString()} days</b></div>
        <div><span>Confidence</span><b>{estimate.confidence.score}% {estimate.confidence.level}</b></div>
        <div><span>Commercial Readiness</span><b>{estimate.commercialReadiness.score}% {estimate.commercialReadiness.level}</b></div>
        <div><span>Unknown Constraints</span><b>{estimate.unknownQuantities.length.toLocaleString()}</b></div>
        <div><span>Last Recalculated</span><b>{shortTimestamp(lastRecalculatedAt)}</b></div>
      </div>

      <div className="transparent-estimate-controls">
        <label>
          <span>Customer Duration</span>
          <input
            type="number"
            min="1"
            value={controls.targetDurationDays}
            onChange={(event) => {
              noteLocalEdit("Customer Duration", ["Duration", "Crew requirements", "Project management", "Margin"]);
              onTargetDurationChange(Math.max(1, Number(event.currentTarget.value) || 1));
            }}
          />
        </label>
        {PRODUCTION_CONTROLS.map((control) => (
          <label key={control.key}>
            <span>{control.label}</span>
            <input
              type="number"
              min="0"
              value={fieldValue(controls.production[control.key])}
              placeholder="Synthesis pending"
              onChange={(event) => {
                noteLocalEdit(control.label, affectedSectionsForConstraint(`production.${control.key}`));
                onProductionChange(control.key, numberFromInput(event.currentTarget.value));
              }}
            />
            <small>{control.unit}</small>
          </label>
        ))}
        {FINANCIAL_CONTROLS.map((control) => (
          <label key={control.key}>
            <span>{control.label}</span>
            <input
              type="number"
              min="0"
              value={controls.financial[control.key]}
              onChange={(event) => {
                noteLocalEdit(control.label, control.key === "monthlyOmPerRouteMile" ? ["MRC", "Layer 1 lifecycle", "Financial summary"] : ["Financial model", "Sell price", "Margin"]);
                onFinancialChange(control.key, Math.max(0, Number(event.currentTarget.value) || 0));
              }}
            />
            <small>{control.unit}</small>
          </label>
        ))}
      </div>

      <div className="transparent-estimate-summary">
        <div><span>Known Cost</span><b>{money(estimate.totalKnownCost)}</b></div>
        <div><span>Direct Cost</span><b>{estimate.financialModel.constructionCost.display}</b></div>
        <div><span>Cost/Mile</span><b>{money(costPerMile)}</b></div>
        <div><span>Cost/Foot</span><b>{moneyPrecise(costPerFoot)}</b></div>
        <div><span>Sell Price</span><b>{estimate.financialModel.sellPrice.display}</b></div>
        <div><span>Revenue/Mile</span><b>{money(revenuePerMile)}</b></div>
        <div><span>Margin/Mile</span><b>{money(marginPerMile)}</b></div>
        <div><span>NRC</span><b>{estimate.financialModel.nrc.display}</b></div>
        <div><span>MRC</span><b>{estimate.financialModel.mrc.display}</b></div>
        <div><span>Lifecycle Revenue</span><b>{money(lifecycleRevenue)}</b></div>
        <div><span>Confidence</span><b>{estimate.confidence.score}% {estimate.confidence.level}</b></div>
        <div><span>Commercial Readiness</span><b>{estimate.commercialReadiness.score}% {estimate.commercialReadiness.level}</b></div>
        <div><span>Unknowns</span><b>{estimate.unknownQuantities.length.toLocaleString()}</b></div>
      </div>

      <CalibrationPanel estimate={estimate} impact={lastImpact} />
      <CommercialReadinessPanel estimate={estimate} />
      <CivilMixStatusPanel estimate={estimate} onCivilMixModeChange={(mode) => {
        noteLocalEdit("Civil Mix Mode", ["Civil mix", "Labor", "Schedule", "Margin"]);
        onCivilMixModeChange(mode);
      }} />
      <IlaPlanningPanel estimate={estimate} onIlaPlanningChange={onIlaPlanningChange} onEditStart={noteLocalEdit} />
      <AuthorityTransparencySummary estimate={estimate} />
      <AuthorityControls estimate={estimate} onConstraintChange={onConstraintChange} onEditStart={noteLocalEdit} />

      <div className="transparent-estimate-versions">
        {versionComparisons.map((version) => (
          <details
            key={version.id}
            className="transparent-estimate-version"
            open={Boolean(openVersions[version.id])}
            onToggle={(event) => setVersionOpen(version.id, event.currentTarget.open)}
          >
            <summary>
              <span>{version.label}</span>
              <b>{version.status}</b>
            </summary>
            <div className="transparent-estimate-metrics">
              <div><span>Cost Delta</span><b>{version.cost}</b></div>
              <div><span>Duration Delta</span><b>{version.duration}</b></div>
              <div><span>Labor Delta</span><b>{version.labor}</b></div>
              <div><span>Materials Delta</span><b>{version.materials}</b></div>
              <div><span>Margin Delta</span><b>{version.margin}</b></div>
              <div><span>Confidence Delta</span><b>{version.confidence}</b></div>
            </div>
          </details>
        ))}
      </div>

      <div className="transparent-estimate-sections">
        {estimate.sections.map((section) => (
          <SectionDetails
            key={section.sectionId}
            section={section}
            estimate={estimate}
            open={Boolean(openSections[section.sectionId])}
            onToggle={(open) => setSectionOpen(section.sectionId, open)}
          />
        ))}
        {vendorPreview?.length ? (
          <details
            className="transparent-estimate-section"
            open={Boolean(openSections.VENDOR_PREVIEW)}
            onToggle={(event) => setSectionOpen("VENDOR_PREVIEW", event.currentTarget.open)}
          >
            <summary>
              <span>Vendor Preview</span>
              <b>{vendorPreview.length.toLocaleString()} lines</b>
            </summary>
            <div className="transparent-confidence-list">
              {vendorPreview.map((line) => (
                <div key={line}>
                  <b>{line}</b>
                  <span>Commercial Draft output</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
