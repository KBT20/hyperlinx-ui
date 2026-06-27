import { useEffect, useMemo, useState } from "react";
import type {
  TransparentCorridorEstimate,
  TransparentEstimateControls,
  TransparentEstimateFinancialControls,
  TransparentEstimateLineItem,
  TransparentEstimateProductionControls,
  TransparentEstimateSection,
} from "../../../commercial/TransparentEstimatingEngine";
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
  { key: "contingencyPercent", label: "Contingency", unit: "%" },
  { key: "overheadPercent", label: "Overhead", unit: "%" },
  { key: "markupPercent", label: "Markup", unit: "%" },
  { key: "monthlyOmPerRouteMile", label: "Monthly O&M", unit: "$/mi" },
];

const AUTHORITY_MODES: ConstraintAuthorityMode[] = ["UNKNOWN", "ALGORITHM", "HUMAN", "API", "SYNTHESIS", "APPROVED"];

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
    label: "O&M / Crossings",
    keys: [
      "financial.omCostPerRouteMile",
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

function authorityBadgeClass(mode: ConstraintAuthorityMode) {
  if (mode === "APPROVED" || mode === "HUMAN" || mode === "API") return "pass";
  if (mode === "ALGORITHM" || mode === "SYNTHESIS") return "warning";
  return "fail";
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
) {
  if (!onConstraintChange) return;
  const nextMode = patch.authorityMode ?? constraint.authorityMode;
  onConstraintChange({
    ...constraint,
    ...patch,
    confidence: patch.confidence ?? (patch.authorityMode ? authorityModeConfidence(nextMode) : constraint.confidence),
    lastUpdated: new Date().toISOString(),
  });
}

function AuthorityControls({
  estimate,
  onConstraintChange,
}: {
  estimate: TransparentCorridorEstimate;
  onConstraintChange?: (value: ConstraintValue) => void;
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
              return (
                <div className="transparent-authority-row" key={constraint.key}>
                  <div className="transparent-authority-main">
                    <b>{constraint.label}</b>
                    <span>{constraintDisplay(constraint)}</span>
                    <small>{constraint.sourceDetail ?? constraint.source}</small>
                  </div>
                  <label>
                    <span>Mode</span>
                    <select
                      value={constraint.authorityMode}
                      onChange={(event) => updateConstraint(
                        constraint,
                        {
                          authorityMode: event.currentTarget.value as ConstraintAuthorityMode,
                          approvedBy: undefined,
                          approvedAt: undefined,
                        },
                        onConstraintChange,
                      )}
                    >
                      {AUTHORITY_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Value</span>
                    <input
                      type={constraintIsNumeric(constraint) ? "number" : "text"}
                      min={constraintIsNumeric(constraint) ? "0" : undefined}
                      value={constraintInputValue(constraint)}
                      placeholder="UNKNOWN"
                      onChange={(event) => updateConstraint(
                        constraint,
                        { value: parseConstraintInput(constraint, event.currentTarget.value) },
                        onConstraintChange,
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
                      onChange={(event) => updateConstraint(
                        constraint,
                        { confidence: Math.max(0, Math.min(100, Math.round(Number(event.currentTarget.value) || 0))) },
                        onConstraintChange,
                      )}
                    />
                  </label>
                  <div className="transparent-authority-flags">
                    <span className={`dal-badge ${authorityBadgeClass(constraint.authorityMode)}`}>{constraint.authorityMode}</span>
                    <small>{costImpactLabel(constraint)}</small>
                    <small>{scheduleImpactLabel(constraint)}</small>
                  </div>
                  <div className="transparent-authority-actions">
                    <button
                      type="button"
                      onClick={() => updateConstraint(
                        constraint,
                        { authorityMode: "ALGORITHM", confidence: authorityModeConfidence("ALGORITHM"), approvedBy: undefined, approvedAt: undefined },
                        onConstraintChange,
                      )}
                    >
                      Use Algorithm
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConstraint(
                        constraint,
                        { authorityMode: "HUMAN", confidence: authorityModeConfidence("HUMAN"), source: "Ryan", approvedBy: undefined, approvedAt: undefined },
                        onConstraintChange,
                      )}
                    >
                      Enter Human Value
                    </button>
                    <button
                      type="button"
                      disabled={constraint.value === null}
                      onClick={() => updateConstraint(
                        constraint,
                        {
                          authorityMode: "APPROVED",
                          confidence: authorityModeConfidence("APPROVED"),
                          approvedBy: "Ryan",
                          approvedAt: new Date().toISOString(),
                        },
                        onConstraintChange,
                      )}
                    >
                      Approve
                    </button>
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
  const approvedCount = constraints.filter((constraint) => constraint.authorityMode === "APPROVED").length;
  const humanApiCount = constraints.filter((constraint) => constraint.authorityMode === "HUMAN" || constraint.authorityMode === "API").length;
  const algorithmCount = constraints.filter((constraint) => constraint.authorityMode === "ALGORITHM").length;
  const synthesisCount = constraints.filter((constraint) => constraint.authorityMode === "SYNTHESIS").length;
  const unknownCount = constraints.filter((constraint) => constraint.authorityMode === "UNKNOWN").length;
  const costIncludedCount = constraints.filter((constraint) => authorityModeCostIncluded(constraint)).length;
  return (
    <div className="transparent-authority-summary">
      <div><span>Approved</span><b>{approvedCount.toLocaleString()}</b></div>
      <div><span>Human / API</span><b>{humanApiCount.toLocaleString()}</b></div>
      <div><span>Algorithm</span><b>{algorithmCount.toLocaleString()}</b></div>
      <div><span>Synthesis</span><b>{synthesisCount.toLocaleString()}</b></div>
      <div><span>Unknowns</span><b>{unknownCount.toLocaleString()}</b></div>
      <div><span>Cost Included</span><b>{costIncludedCount.toLocaleString()}</b></div>
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
              <td><span className={`dal-badge ${authorityBadgeClass(line.authority.authorityMode)}`}>{line.authority.authorityMode}</span></td>
              <td>{line.authority.confidence}%</td>
              <td>{costImpactLabel(line.authority)}</td>
              <td>{scheduleImpactLabel(line.authority)}</td>
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
      {section.sectionId === "ILA_FACILITIES" ? (
        <div className="dal-table-wrap transparent-estimate-table">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>GPS</th>
                <th>Milepost</th>
                <th>Facility</th>
                <th>Power</th>
                <th>Generator</th>
                <th>HVAC</th>
                <th>Racks</th>
                <th>Material</th>
                <th>Labor</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {estimate.ilaFacilities.map((facility) => (
                <tr key={facility.facilityId}>
                  <td>{facility.location}</td>
                  <td>{facility.gps}</td>
                  <td>{facility.milepost.toLocaleString()}</td>
                  <td>{facility.facilityType}</td>
                  <td>{facility.power}</td>
                  <td>{facility.generator}</td>
                  <td>{facility.hvac}</td>
                  <td>{facility.racks.toLocaleString()}</td>
                  <td>{facility.materialCost.display}</td>
                  <td>{facility.laborCost.display}</td>
                  <td>{facility.total.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
                  <td><span className={`dal-badge ${authorityBadgeClass(entry.authorityMode)}`}>{entry.authorityMode}</span></td>
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
}: {
  estimate: TransparentCorridorEstimate;
  controls: TransparentEstimateControls;
  lastRecalculatedAt?: string | null;
  vendorPreview?: string[];
  onTargetDurationChange: (days: number) => void;
  onProductionChange: (key: ProductionKey, value: number | null) => void;
  onFinancialChange: (key: FinancialKey, value: number) => void;
  onConstraintChange?: (value: ConstraintValue) => void;
}) {
  const storageKey = `hyperlinx:transparent-estimate:sections:${estimate.estimateId}`;
  const versionStorageKey = `hyperlinx:transparent-estimate:versions:${estimate.estimateId}`;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openVersions, setOpenVersions] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setOpenSections(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<string, boolean>);
      setOpenVersions(JSON.parse(window.localStorage.getItem(versionStorageKey) ?? "{}") as Record<string, boolean>);
    } catch {
      setOpenSections({});
      setOpenVersions({});
    }
  }, [storageKey, versionStorageKey]);
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
  const requiredCrews = sumCrewCount(estimate);
  return (
    <div className="transparent-estimate-explorer">
      <div className="transparent-estimate-pinned-summary">
        <div><span>Route Miles</span><b>{estimate.physicalQuantities.routeMiles.toLocaleString()}</b></div>
        <div><span>Construction Cost</span><b>{estimate.financialModel.constructionCost.display}</b></div>
        <div><span>Sell Price</span><b>{estimate.financialModel.sellPrice.display}</b></div>
        <div><span>Gross Margin</span><b>{estimate.grossMarginPercent}%</b></div>
        <div><span>Duration</span><b>{controls.targetDurationDays.toLocaleString()} days</b></div>
        <div><span>Required Crews</span><b>{requiredCrews.toLocaleString()}</b></div>
        <div><span>Confidence</span><b>{estimate.confidence.score}% {estimate.confidence.level}</b></div>
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
            onChange={(event) => onTargetDurationChange(Math.max(1, Number(event.currentTarget.value) || 1))}
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
              onChange={(event) => onProductionChange(control.key, numberFromInput(event.currentTarget.value))}
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
              onChange={(event) => onFinancialChange(control.key, Math.max(0, Number(event.currentTarget.value) || 0))}
            />
            <small>{control.unit}</small>
          </label>
        ))}
      </div>

      <div className="transparent-estimate-summary">
        <div><span>Known Cost</span><b>{estimate.financialModel.constructionCost.display}</b></div>
        <div><span>Sell Price</span><b>{estimate.financialModel.sellPrice.display}</b></div>
        <div><span>NRC</span><b>{estimate.financialModel.nrc.display}</b></div>
        <div><span>MRC</span><b>{estimate.financialModel.mrc.display}</b></div>
        <div><span>Confidence</span><b>{estimate.confidence.score}% {estimate.confidence.level}</b></div>
        <div><span>Unknowns</span><b>{estimate.unknownQuantities.length.toLocaleString()}</b></div>
      </div>

      <AuthorityTransparencySummary estimate={estimate} />
      <AuthorityControls estimate={estimate} onConstraintChange={onConstraintChange} />

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
