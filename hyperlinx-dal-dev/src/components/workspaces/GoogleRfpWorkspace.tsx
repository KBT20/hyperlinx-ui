import { useEffect, useMemo, useState } from "react";
import { cloneBudgetAssumptionState, createDefaultBudgetAssumptionState, rebalanceConstructionStrategy, type BudgetAssumptionState } from "../../commercial/BudgetAssumptionState";
import { createSelectedScopePricingSummary, type PricingScopeSelection } from "../../commercial/SelectedScopePricingSummary";
import { googleHeliumBidPlanFixture, googleHeliumRfpOpportunity } from "../../rfp/fixtures/googleHeliumRfpFixtures";
import { buildGoogleBidPackagePreview } from "../../rfp/GoogleBidPackagePreview";
import { buildGoogleRfpBidPlanWithOsrm, rebuildGoogleRfpBidPlanFromRoutePlans } from "../../rfp/GoogleRfpResponseEngine";
import type { GoogleRfpRouteBidPlan } from "../../rfp/GoogleRfpBidPlan";
import teralinxLogo from "../../assets/teralinx-logo.png";
import GoogleBidExecutiveSummaryPanel from "./googleRfp/GoogleBidExecutiveSummaryPanel";
import GoogleBidCommercialPreviewPanel from "./googleRfp/GoogleBidCommercialPreviewPanel";
import GoogleBidRouteReviewPanel from "./googleRfp/GoogleBidRouteReviewPanel";
import GoogleBidSupportingInformationPanel from "./googleRfp/GoogleBidSupportingInformationPanel";
import GoogleBidVendorResponsePreviewPanel from "./googleRfp/GoogleBidVendorResponsePreviewPanel";

function routeLabel(routePlan: GoogleRfpRouteBidPlan) {
  return routePlan.routeRequirement.bidSegmentName.replace("Helium / HIU to ", "Helium -> ");
}

function routeInput(routePlan: GoogleRfpRouteBidPlan) {
  if (!routePlan.stationedCorridor?.takeoff) return null;
  return {
    segmentId: routePlan.routeRequirement.routeRequirementId,
    segmentName: routePlan.routeRequirement.bidSegmentName,
    aLocation: routePlan.routeRequirement.aSite.facilityName,
    zLocation: routePlan.routeRequirement.zSite.facilityName,
    fiberCount: routePlan.routeRequirement.fiberCount,
    takeoff: routePlan.stationedCorridor.takeoff,
  };
}

function CommercialRecalculationNotice() {
  return (
    <section className="dal-panel bid-recalculation-panel">
      <div className="dal-panel-title-row">
        <h3>Recalculating Commercial Plan...</h3>
        <span className="dal-badge warning">Corridor changed</span>
      </div>
      <div className="dal-status">
        The saved proposal corridor is becoming the active commercial corridor. Stationing, takeoff, materials,
        splicing, pricing, vendor response, readiness, and supporting information are being regenerated from that corridor.
      </div>
    </section>
  );
}

export default function GoogleRfpWorkspace() {
  const [bidPlan, setBidPlan] = useState(googleHeliumBidPlanFixture);
  const defaultAssumptionState = useMemo(() => createDefaultBudgetAssumptionState(), []);
  const [assumptionStates, setAssumptionStates] = useState<BudgetAssumptionState[]>([defaultAssumptionState]);
  const [selectedAssumptionStateId, setSelectedAssumptionStateId] = useState(defaultAssumptionState.stateId);
  const [selectedScopeId, setSelectedScopeId] = useState<string>(googleHeliumBidPlanFixture.routePlans[0]?.routeRequirement.routeRequirementId ?? "COMBINED_AWARD");
  const [verificationStatus, setVerificationStatus] = useState<"PENDING" | "RUNNING" | "COMPLETE" | "FAILED">("PENDING");
  const [commercialRecalculationPending, setCommercialRecalculationPending] = useState(false);
  const pricingScopes: PricingScopeSelection[] = useMemo(() => [
    ...bidPlan.routePlans.map((route) => ({
      scopeId: route.routeRequirement.routeRequirementId,
      label: routeLabel(route),
      kind: "ROUTE" as const,
      routeRequirementIds: [route.routeRequirement.routeRequirementId],
    })),
    {
      scopeId: "COMBINED_AWARD",
      label: "Combined Award",
      kind: "COMBINED_AWARD",
      routeRequirementIds: bidPlan.routePlans.map((route) => route.routeRequirement.routeRequirementId),
    },
  ], [bidPlan.routePlans]);
  const selectedScope = pricingScopes.find((scope) => scope.scopeId === selectedScopeId) ?? pricingScopes[0];
  const selectedRoutePlans = useMemo(
    () => bidPlan.routePlans.filter((route) => selectedScope?.routeRequirementIds.includes(route.routeRequirement.routeRequirementId)),
    [bidPlan.routePlans, selectedScope],
  );
  const selectedAssumptionState = assumptionStates.find((state) => state.stateId === selectedAssumptionStateId) ?? assumptionStates[0];
  const scopedBidPlan = useMemo(() => ({
    ...bidPlan,
    routePlans: selectedRoutePlans,
  }), [bidPlan, selectedRoutePlans]);
  const preview = useMemo(() => buildGoogleBidPackagePreview(scopedBidPlan), [scopedBidPlan]);
  const selectedPricingSummary = useMemo(() => createSelectedScopePricingSummary({
    scope: selectedScope,
    routes: selectedRoutePlans.map(routeInput).filter((input): input is NonNullable<typeof input> => Boolean(input)),
    assumptionState: selectedAssumptionState,
  }), [selectedAssumptionState, selectedRoutePlans, selectedScope]);

  function commitAssumptionState(label: string, patch: Partial<Pick<BudgetAssumptionState, "civilMix" | "borePricing" | "slack" | "waste" | "splicing">>) {
    const next = cloneBudgetAssumptionState({
      state: selectedAssumptionState,
      label,
      patch,
    });
    setAssumptionStates((prev) => [...prev, next]);
    setSelectedAssumptionStateId(next.stateId);
  }

  function updateConstructionStrategy(changed: "hddPercent" | "plowPercent" | "openCutPercent", value: number) {
    const label = changed === "hddPercent" ? "Dirt Bore" : changed === "plowPercent" ? "Plow" : "Open Cut";
    commitAssumptionState(`Construction Strategy ${label} ${Math.round(value)}%`, {
      civilMix: rebalanceConstructionStrategy(selectedAssumptionState.civilMix, changed, value),
    });
  }

  function updateRockPercent(value: number) {
    const rockBorePercent = Math.max(0, Math.min(100, Math.round(value)));
    commitAssumptionState(`Geology rock ${rockBorePercent}%`, {
      borePricing: {
        ...selectedAssumptionState.borePricing,
        rockBorePercent,
        dirtBorePercent: 100 - rockBorePercent,
      },
    });
  }

  async function verifyRoutesWithOsrm() {
    setVerificationStatus("RUNNING");
    try {
      const verifiedPlan = await buildGoogleRfpBidPlanWithOsrm(googleHeliumRfpOpportunity);
      setBidPlan(verifiedPlan);
      setVerificationStatus(verifiedPlan.status === "READY_FOR_REVIEW" ? "COMPLETE" : "FAILED");
    } catch (error) {
      console.warn("Teralinx Bid Engine OSRM verification failed", error);
      setBidPlan(googleHeliumBidPlanFixture);
      setVerificationStatus("FAILED");
    }
  }

  useEffect(() => {
    void verifyRoutesWithOsrm();
  }, []);

  function handleRoutePlanRevised(nextRoutePlan: GoogleRfpRouteBidPlan) {
    setBidPlan((prev) =>
      rebuildGoogleRfpBidPlanFromRoutePlans(
        prev.opportunity,
        prev.routePlans.map((route) => (route.routeRequirement.routeRequirementId === nextRoutePlan.routeRequirement.routeRequirementId ? nextRoutePlan : route)),
      ),
    );
  }

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header bid-workspace-header">
        <div className="bid-workspace-brand">
          <img className="bid-workspace-logo" src={teralinxLogo} alt="TeralinX" />
          <div>
            <h2>Commercial Planning Workspace</h2>
            <p>Powered by IOF</p>
          </div>
        </div>
        <div className="dal-actions">
          <span className="dal-badge warning">Budgetary only</span>
          <span className={`dal-badge ${verificationStatus === "COMPLETE" ? "pass" : verificationStatus === "RUNNING" ? "warning" : "fail"}`}>
            OSRM {verificationStatus}
          </span>
          <button className="dal-button secondary" type="button" onClick={verifyRoutesWithOsrm} disabled={verificationStatus === "RUNNING"}>
            Verify OSRM Routes
          </button>
        </div>
      </div>

      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Pricing Scope</h3>
          <span className="dal-badge pass">Commercial context</span>
        </div>
        <div className="dal-actions">
          <select
            value={selectedScope.scopeId}
            onChange={(event) => setSelectedScopeId(event.currentTarget.value)}
            aria-label="Pricing scope selector"
          >
            {pricingScopes.map((scope) => (
              <option key={scope.scopeId} value={scope.scopeId}>{scope.label}</option>
            ))}
          </select>
          <span className="dal-status">{selectedPricingSummary.reconciliation.combinedAwardAdjustmentStatus}</span>
        </div>
      </section>

      {commercialRecalculationPending ? (
        <CommercialRecalculationNotice />
      ) : (
        <>
          <GoogleBidExecutiveSummaryPanel preview={preview} pricingSummary={selectedPricingSummary} />
          <GoogleBidCommercialPreviewPanel
            pricingSummary={selectedPricingSummary}
            assumptionStates={assumptionStates}
            selectedAssumptionStateId={selectedAssumptionState.stateId}
            onSelectAssumptionState={setSelectedAssumptionStateId}
            onConstructionStrategyChange={updateConstructionStrategy}
            onRockPercentChange={updateRockPercent}
          />
        </>
      )}

      <GoogleBidRouteReviewPanel
        bidPlan={bidPlan}
        selectedScopeId={selectedScope.scopeId}
        pricingSummary={selectedPricingSummary}
        onRoutePlanRevised={handleRoutePlanRevised}
        onCommercialRecalculationChange={setCommercialRecalculationPending}
      />
      {commercialRecalculationPending ? null : (
        <>
          <GoogleBidVendorResponsePreviewPanel preview={preview} pricingSummary={selectedPricingSummary} />
          <GoogleBidSupportingInformationPanel bidPlan={scopedBidPlan} preview={preview} pricingSummary={selectedPricingSummary} />
        </>
      )}
    </section>
  );
}
