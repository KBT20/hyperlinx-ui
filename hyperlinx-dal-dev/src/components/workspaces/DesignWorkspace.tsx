import { useMemo, useState } from "react";
import { useDALState } from "../../dal/DALState";
import { designLaunchFixtureResults } from "../../design/fixtures/designLaunchFixtures";
import type { DesignLaunchResult } from "../../design/DesignLaunchResult";
import type { DesignLaunchSession } from "../../design/DesignLaunchSession";
import { resolveDesignDoctrineForSession } from "../../designDoctrine/DesignDoctrineEngine";
import { formatNetworkClass } from "../../designDoctrine/NetworkClass";
import { formatProtectionClass } from "../../designDoctrine/ProtectionClass";
import { formatTopologyClass } from "../../designDoctrine/TopologyClass";

function fixtureLabel(result: DesignLaunchResult, index: number) {
  if (result.session) return `${result.session.customerName} - ${result.session.opportunityName}`;
  return `Blocked Design Launch ${index + 1}`;
}

function matchSelectedFixture(session?: DesignLaunchSession | null) {
  if (!session) return designLaunchFixtureResults[0];
  return designLaunchFixtureResults.find((fixture) => fixture.session?.launchId === session.launchId) ?? designLaunchFixtureResults[0];
}

export default function DesignWorkspace() {
  const { selectedDesignLaunchResult, selectedProposedGraph, setWorkspace } = useDALState();
  const fixtures = useMemo(() => designLaunchFixtureResults, []);
  const defaultFixture = matchSelectedFixture(selectedDesignLaunchResult?.session);
  const defaultIndex = Math.max(0, fixtures.indexOf(defaultFixture));
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState(defaultIndex);
  const fixture = fixtures[selectedFixtureIndex] ?? defaultFixture;
  const selectedSession = selectedFixtureIndex === defaultIndex ? selectedDesignLaunchResult?.session : null;
  const session = selectedSession ?? fixture.session;
  const appliedDoctrine = session ? resolveDesignDoctrineForSession(session) : null;

  if (!session || !appliedDoctrine) {
    return (
      <section className="dal-workspace wide">
        <div className="dal-workspace-header">
          <div>
            <h2>Design</h2>
            <p>Layer 1 design doctrine workspace. No routing or engineering execution occurs here.</p>
          </div>
        </div>
        <section className="dal-panel">
          <h3>Design Doctrine Blocked</h3>
          <div className="dal-status">A ready Design Launch Session is required before doctrine can be applied.</div>
        </section>
      </section>
    );
  }

  const doctrine = appliedDoctrine.doctrine;
  const canOpenProposedGraph = Boolean(selectedProposedGraph?.sourceDesignLaunchId === session.launchId);

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>Design</h2>
          <p>Deterministic Layer 1 doctrine explains how this network class should behave before any route generation exists.</p>
        </div>
        <select value={selectedFixtureIndex} onChange={(event) => setSelectedFixtureIndex(Number(event.currentTarget.value))} aria-label="Design doctrine fixture">
          {fixtures.map((item, index) => (
            <option key={item.session?.launchId ?? `blocked-${index}`} value={index}>
              {fixtureLabel(item, index)}
            </option>
          ))}
        </select>
      </div>

      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Layer 1 Design Doctrine</h3>
          <span className="dal-badge pass">{doctrine.designDoctrineId}</span>
        </div>
        <div className="teralinx-summary-grid">
          <div>
            <span>Customer</span>
            <b>{session.customerName}</b>
          </div>
          <div>
            <span>Opportunity</span>
            <b>{session.opportunityName}</b>
          </div>
          <div>
            <span>Network Class</span>
            <b>{formatNetworkClass(appliedDoctrine.networkClass)}</b>
          </div>
          <div>
            <span>Topology</span>
            <b>{formatTopologyClass(appliedDoctrine.topology)}</b>
          </div>
          <div>
            <span>Protection</span>
            <b>{formatProtectionClass(appliedDoctrine.protection, appliedDoctrine.networkClass)}</b>
          </div>
          <div>
            <span>MSA Classification</span>
            <b>{appliedDoctrine.msaClassification.status.replaceAll("_", " ")}</b>
          </div>
          <div>
            <span>Construction Profile</span>
            <b>{appliedDoctrine.constructionProfileId}</b>
          </div>
          <div>
            <span>Material Profile</span>
            <b>{appliedDoctrine.materialProfileId}</b>
          </div>
          <div>
            <span>Facility Profile</span>
            <b>{appliedDoctrine.facilityProfileId}</b>
          </div>
        </div>
      </section>

      <div className="dal-grid">
        <section className="dal-panel">
          <h3>Applied Rules</h3>
          <div className="dal-list">
            {appliedDoctrine.appliedRules.map((rule) => (
              <div className="dal-list-row" key={rule}>
                <b>{rule}</b>
                <span>RULE</span>
                <small>Doctrine only. Future route generation must obey this rule.</small>
              </div>
            ))}
          </div>
        </section>

        <section className="dal-panel">
          <h3>Facility Doctrine</h3>
          <div className="teralinx-facts">
            <span>Regen Spacing</span>
            <b>{doctrine.facilitySpacingDoctrine.regenSpacingMiles ? `${doctrine.facilitySpacingDoctrine.regenSpacingMiles} mi` : "Not applicable"}</b>
            <span>Vault Spacing</span>
            <b>{doctrine.facilitySpacingDoctrine.vaultSpacingFeet ? `${doctrine.facilitySpacingDoctrine.vaultSpacingFeet} ft` : "Not applicable"}</b>
            <span>Cabinet Density</span>
            <b>{doctrine.facilitySpacingDoctrine.cabinetDensity ?? "Not applicable"}</b>
            <span>Building Entrances</span>
            <b>{doctrine.facilitySpacingDoctrine.buildingEntranceAssumption ?? "Not applicable"}</b>
          </div>
        </section>
      </div>

      <div className="dal-grid">
        <section className="dal-panel">
          <h3>Construction Doctrine</h3>
          <div className="dal-list">
            {doctrine.constructionDoctrine.constructionAssumptions.map((item) => (
              <div className="dal-list-row" key={item}>
                <b>{item}</b>
                <span>ASSUMPTION</span>
                <small>{doctrine.constructionDoctrine.preferredConstructionType}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="dal-panel">
          <h3>Material Doctrine</h3>
          <div className="teralinx-facts">
            <span>Default Products</span>
            <b>{doctrine.materialDoctrine.defaultProducts.join(", ")}</b>
            <span>Fiber Count</span>
            <b>{doctrine.materialDoctrine.preferredBackboneFiberCount ?? "Not applicable"}</b>
            <span>Duct Configuration</span>
            <b>{doctrine.materialDoctrine.preferredDuctConfiguration ?? "Not applicable"}</b>
            <span>Override</span>
            <b>{doctrine.materialDoctrine.overrideAllowed ? "Allowed later" : "Not allowed"}</b>
          </div>
        </section>
      </div>

      <section className="dal-panel">
        <h3>MSA Doctrine</h3>
        <div className="dal-status">{appliedDoctrine.msaClassification.explanation}</div>
        <div className="teralinx-summary-grid">
          <div>
            <span>Identified Markets</span>
            <b>{appliedDoctrine.msaClassification.identifiedMarkets.length ? appliedDoctrine.msaClassification.identifiedMarkets.join(", ") : "Unknown"}</b>
          </div>
          <div>
            <span>Recommendation</span>
            <b>{appliedDoctrine.msaClassification.recommendedNetworkClass?.replaceAll("_", " ") ?? "No recommendation"}</b>
          </div>
          <div>
            <span>GIS Lookup</span>
            <b>Fixture only</b>
          </div>
        </div>
      </section>

      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Actions</h3>
          <span className="dal-badge warning">Doctrine only</span>
        </div>
        <div className="dal-actions">
          <button type="button" disabled={!canOpenProposedGraph} onClick={() => setWorkspace("proposedNetwork")}>
            Open Proposed Network
          </button>
          <button type="button" onClick={() => setWorkspace("teralinxRoute")}>
            Back to Teralinx Route
          </button>
        </div>
        <div className="dal-status">No routing, geometry creation, pathfinding, stationing, ScopeVersion creation, inventory mutation, persistence, or API calls occur here.</div>
      </section>

      <section className="dal-panel">
        <h3>Developer Diagnostics</h3>
        <details>
          <summary>Loaded Doctrine</summary>
          <pre className="dal-pre">{JSON.stringify(doctrine, null, 2)}</pre>
        </details>
        <details>
          <summary>Applied Rules and Classification</summary>
          <pre className="dal-pre">{JSON.stringify(appliedDoctrine, null, 2)}</pre>
        </details>
      </section>
    </section>
  );
}
