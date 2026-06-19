import type { ScopeVersion } from "../types/dal";
import { deriveScopeVersionLifecycleState } from "../scopeversion/ClosureAuthorityEngine";

const RIBBON_STATES = [
  { key: "ANALYZED", label: "ANALYZED" },
  { key: "PROVISIONALLY_CERTIFIED", label: "CERTIFIED" },
  { key: "QUOTED", label: "QUOTED" },
  { key: "APPROVED", label: "APPROVED" },
  { key: "RELEASED_TO_CONTROL", label: "CONTROL" },
  { key: "IN_FIELD", label: "FIELD" },
  { key: "COMPLETE", label: "COMPLETE" },
  { key: "OPERATIONAL", label: "OPERATIONAL" },
] as const;

function normalizedState(scopeVersion?: ScopeVersion | null) {
  if (!scopeVersion) return "";
  const state = deriveScopeVersionLifecycleState(scopeVersion);
  if (state === "PARTIALLY_COMPLETE") return "IN_FIELD";
  if (state === "VERIFIED") return "COMPLETE";
  if (state === "BLOCKED" || state === "REJECTED") return state;
  if (scopeVersion.status === "ACTIVATED" || scopeVersion.status === "IN_CONSTRUCTION") return "IN_FIELD";
  return state;
}

export default function ScopeVersionLifecycleRibbon({ scopeVersion }: { scopeVersion?: ScopeVersion | null }) {
  const activeState = normalizedState(scopeVersion);
  if (!scopeVersion) {
    return (
      <div className="dal-panel">
        <h3>ScopeVersion Lifecycle</h3>
        <div className="dal-status">No ScopeVersion selected.</div>
      </div>
    );
  }
  const activeIndex = RIBBON_STATES.findIndex((item) => item.key === activeState);
  return (
    <div className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>ScopeVersion Lifecycle</h3>
        <span className="dal-status">{scopeVersion.scopeVersionId}</span>
      </div>
      <div className="dal-actions">
        {RIBBON_STATES.map((item, index) => (
          <span key={item.key} className={activeState === item.key || (activeIndex >= 0 && index < activeIndex) ? "dal-badge pass" : "dal-badge"}>
            {item.label}
          </span>
        ))}
        {activeState === "BLOCKED" ? <span className="dal-badge warning">BLOCKED</span> : null}
        {activeState === "REJECTED" ? <span className="dal-badge fail">REJECTED</span> : null}
      </div>
    </div>
  );
}

