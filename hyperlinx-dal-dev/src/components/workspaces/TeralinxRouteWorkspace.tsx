import { useMemo, useState } from "react";
import { buildDesignLaunchRequestFromRouteRequest, createDesignLaunchSession } from "../../design/DesignLaunchEngine";
import { formatProtectionClass } from "../../designDoctrine/ProtectionClass";
import type { DesignLaunchResult } from "../../design/DesignLaunchResult";
import { useDALState } from "../../dal/DALState";
import { createProposedGraphWithCenterline } from "../../proposedGraph/ProposedGraphEngine";
import { teralinxRouteFixtures, googleTexasAiTeralinxRoute } from "../../teralinx/fixtures/teralinxRouteFixtures";
import type { TeralinxRouteIntake } from "../../teralinx/TeralinxRouteIntake";
import CustomerPanel from "./teralinx/CustomerPanel";
import NetworkIntentPanel from "./teralinx/NetworkIntentPanel";
import OpportunityPanel from "./teralinx/OpportunityPanel";
import ReadinessPanel from "./teralinx/ReadinessPanel";
import RouteSummaryPanel from "./teralinx/RouteSummaryPanel";
import SiteListPanel from "./teralinx/SiteListPanel";

function fixtureLabel(intake: TeralinxRouteIntake) {
  return `${intake.routeRequest.customer.company || "Blocked"} - ${intake.routeRequest.opportunity.opportunityName || intake.routeRequest.routeRequestId}`;
}

export default function TeralinxRouteWorkspace() {
  const { setSelectedDesignLaunchResult, setSelectedProposedGraph, setWorkspace } = useDALState();
  const fixtures = useMemo(() => teralinxRouteFixtures, []);
  const defaultIndex = Math.max(0, fixtures.indexOf(googleTexasAiTeralinxRoute));
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState(defaultIndex);
  const [designLaunchResult, setDesignLaunchResult] = useState<DesignLaunchResult | null>(null);
  const [designing, setDesigning] = useState(false);
  const intake = fixtures[selectedFixtureIndex] ?? googleTexasAiTeralinxRoute;

  function handleFixtureChange(index: number) {
    setSelectedFixtureIndex(index);
    setDesignLaunchResult(null);
  }

  async function handleDesignNetwork() {
    const request = buildDesignLaunchRequestFromRouteRequest(intake.routeRequest);
    const result = createDesignLaunchSession(request);
    setDesignLaunchResult(result);
    setSelectedDesignLaunchResult(result);
    if (result.session) {
      setDesigning(true);
      try {
        setSelectedProposedGraph(await createProposedGraphWithCenterline(result.session));
        setWorkspace("design");
      } finally {
        setDesigning(false);
      }
    }
  }

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>Teralinx Route</h2>
          <p>Sales intake for proposed Layer 1 route requests before Design creates executable infrastructure truth.</p>
        </div>
        <select value={selectedFixtureIndex} onChange={(event) => handleFixtureChange(Number(event.currentTarget.value))} aria-label="Teralinx route fixture">
          {fixtures.map((item, index) => (
            <option key={item.routeRequest.routeRequestId} value={index}>
              {fixtureLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <RouteSummaryPanel intake={intake} />

      <div className="dal-grid">
        <CustomerPanel intake={intake} />
        <OpportunityPanel intake={intake} />
      </div>

      <div className="dal-grid">
        <NetworkIntentPanel intake={intake} />
        <ReadinessPanel intake={intake} />
      </div>

      <SiteListPanel intake={intake} />

      {designLaunchResult && (
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>{designLaunchResult.status === "READY" ? "Design Session Created" : "Design Session Blocked"}</h3>
            <span className={`dal-badge ${designLaunchResult.status === "READY" ? "pass" : "fail"}`}>{designLaunchResult.status}</span>
          </div>

          {designLaunchResult.session ? (
            <div className="teralinx-summary-grid">
              <div>
                <span>Customer</span>
                <b>{designLaunchResult.session.customerName}</b>
              </div>
              <div>
                <span>Opportunity</span>
                <b>{designLaunchResult.session.opportunityName}</b>
              </div>
              <div>
                <span>Sites</span>
                <b>{designLaunchResult.session.siteList.length}</b>
              </div>
              <div>
                <span>Network</span>
                <b>{designLaunchResult.session.networkIntent.networkType}</b>
              </div>
              <div>
                <span>Protection</span>
                <b>{designLaunchResult.session.protection ? formatProtectionClass(designLaunchResult.session.protection, designLaunchResult.session.networkClass) : "Missing"}</b>
              </div>
              <div>
                <span>Product</span>
                <b>{designLaunchResult.session.primaryProduct}</b>
              </div>
              <div>
                <span>Estimated Miles</span>
                <b>{designLaunchResult.session.estimatedMileage.toLocaleString()}</b>
              </div>
              <div>
                <span>Estimated Nodes</span>
                <b>{designLaunchResult.session.estimatedNodeCount.toLocaleString()}</b>
              </div>
              <div>
                <span>Estimated Stations</span>
                <b>{designLaunchResult.session.estimatedStations.toLocaleString()}</b>
              </div>
              <div>
                <span>Estimated Segments</span>
                <b>{designLaunchResult.session.estimatedSegments.toLocaleString()}</b>
              </div>
              <div>
                <span>Estimated Objects</span>
                <b>{designLaunchResult.session.estimatedObjects.toLocaleString()}</b>
              </div>
              <div>
                <span>Next Workspace</span>
                <b>{designLaunchResult.session.nextWorkspace}</b>
              </div>
            </div>
          ) : (
            <div className="dal-list">
              {designLaunchResult.blockers.map((blocker) => (
                <div className="dal-list-row teralinx-list-row" key={blocker.blockerId}>
                  <b>{blocker.blockerType.replaceAll("_", " ")}</b>
                  <span>BLOCKER</span>
                  <small>
                    {blocker.message} Required: {blocker.requiredAction}
                  </small>
                </div>
              ))}
            </div>
          )}

          <details>
            <summary>Design launch diagnostics</summary>
            <pre className="dal-pre">{JSON.stringify(designLaunchResult, null, 2)}</pre>
          </details>
        </section>
      )}

      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Actions</h3>
          <span className="dal-badge warning">Orchestration only</span>
        </div>
        <div className="dal-actions">
          <button type="button" onClick={handleDesignNetwork} disabled={designing}>
            {designing ? "Designing Network..." : "Design Network"}
          </button>
          <button type="button" disabled={!designLaunchResult?.session} onClick={() => setWorkspace("design")}>
            Open Design Workspace
          </button>
          <button type="button" disabled>
            Save Draft
          </button>
          <button type="button" disabled>
            Cancel
          </button>
        </div>
        <div className="dal-status">
          Design Network creates a read-only launch session and hands off to the existing Design workspace. No routing, geometry, ScopeVersion creation, inventory
          mutation, or persistence occurs here.
        </div>
      </section>
    </section>
  );
}
