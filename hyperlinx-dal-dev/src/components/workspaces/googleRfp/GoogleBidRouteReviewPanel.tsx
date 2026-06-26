import { useEffect, useMemo, useState } from "react";
import { estimateCivilMixFromCorridor } from "../../../construction/CivilMixEngine";
import type { CivilMixEstimate } from "../../../construction/CivilMixEstimate";
import { priceHyperscalerRoutes } from "../../../commercial/HyperscalerPricingEngine";
import type { SelectedScopePricingSummary } from "../../../commercial/SelectedScopePricingSummary";
import { googleHeliumBudgetaryCostProfileV1 } from "../../../construction/fixtures/civilMixFixtures";
import type { StationedCorridor } from "../../../corridor/StationedCorridor";
import { createGoogleRfpRouteRevisionPlan, previewGoogleRfpRouteRevision } from "../../../rfp/GoogleRfpResponseEngine";
import type { GoogleRfpBidPlan, GoogleRfpRouteBidPlan } from "../../../rfp/GoogleRfpBidPlan";
import type { RouteRevisionBuildResult } from "../../../redline/RouteRedlineEngine";
import type { DALCoordinate } from "../../../types/dal";
import ProposedNetworkMapPanel, { type ProposedNetworkRedlineMode, type ProposedNetworkSelection } from "../proposednetwork/ProposedNetworkMapPanel";

function money(value: number | undefined) {
  return `$${Math.round(value ?? 0).toLocaleString()}`;
}

function crossingCount(stationedCorridor: StationedCorridor) {
  const takeoff = stationedCorridor.takeoff;
  return takeoff.roadCrossingCount + takeoff.railCrossingCount + takeoff.waterCrossingCount + takeoff.bridgeCrossingCount + takeoff.unknownConstraintCount;
}

function civilQuantities(civilMixEstimate: CivilMixEstimate | null | undefined) {
  return Object.fromEntries((civilMixEstimate?.lineItems ?? []).map((item) => [item.category, item.feet || item.count]));
}

function takeoffSnapshot(args: {
  routePlan: GoogleRfpRouteBidPlan;
  stationedCorridor: StationedCorridor | null | undefined;
  civilMixEstimate: CivilMixEstimate | null | undefined;
  costOverride?: number;
}) {
  if (!args.stationedCorridor) return null;
  const takeoff = args.stationedCorridor.takeoff;
  return {
    miles: takeoff.routeMiles,
    cost: args.costOverride ?? pricingForRoute(args.routePlan, args.stationedCorridor),
    ductFeet: takeoff.ductFeet,
    fiberFeet: takeoff.fiberFeet,
    vaults: takeoff.vaultCount,
    handholes: takeoff.handholeCount,
    regen: takeoff.regenSiteCount,
    crossings: crossingCount(args.stationedCorridor),
    civilQuantities: civilQuantities(args.civilMixEstimate),
  };
}

function pricingForRoute(routePlan: GoogleRfpRouteBidPlan, stationedCorridor: StationedCorridor | null | undefined) {
  if (!stationedCorridor?.takeoff) return 0;
  return priceHyperscalerRoutes({
    pricingId: routePlan.routeRequirement.routeRequirementId,
    routes: [{
      segmentId: routePlan.routeRequirement.routeRequirementId,
      segmentName: routePlan.routeRequirement.bidSegmentName,
      aLocation: routePlan.routeRequirement.aSite.facilityName,
      zLocation: routePlan.routeRequirement.zSite.facilityName,
      fiberCount: routePlan.routeRequirement.fiberCount,
      takeoff: stationedCorridor.takeoff,
    }],
  }).fiberSummary.costPlus.sellPrice;
}

export default function GoogleBidRouteReviewPanel({
  bidPlan,
  selectedScopeId,
  pricingSummary,
  onRoutePlanRevised,
  onCommercialRecalculationChange,
}: {
  bidPlan: GoogleRfpBidPlan;
  selectedScopeId: string;
  pricingSummary: SelectedScopePricingSummary;
  onRoutePlanRevised?: (routePlan: GoogleRfpRouteBidPlan) => void;
  onCommercialRecalculationChange?: (recalculating: boolean) => void;
}) {
  const [mapSelection, setMapSelection] = useState<ProposedNetworkSelection>(null);
  const [redlineMode, setRedlineMode] = useState<ProposedNetworkRedlineMode>("REVIEW");
  const [pendingViaPoints, setPendingViaPoints] = useState<DALCoordinate[]>([]);
  const [previewGeometry, setPreviewGeometry] = useState<DALCoordinate[]>([]);
  const [previewResult, setPreviewResult] = useState<RouteRevisionBuildResult | null>(null);
  const [revisionSaveStatus, setRevisionSaveStatus] = useState<"IDLE" | "RECALCULATING" | "FAILED">("IDLE");
  const selectedRoute = bidPlan.routePlans.find((route) => route.routeRequirement.routeRequirementId === selectedScopeId);
  const selectedGraph = selectedRoute?.proposedGraph ?? null;
  const originalGeometry = selectedRoute?.originalProposedGraph?.centerlineRoute?.geometry ?? selectedGraph?.centerlineRoute?.geometry ?? [];

  useEffect(() => {
    setMapSelection(null);
    setPendingViaPoints([]);
    setPreviewGeometry([]);
    setPreviewResult(null);
    setRedlineMode("REVIEW");
    setRevisionSaveStatus("IDLE");
  }, [selectedScopeId]);

  const comparison = useMemo(() => {
    if (!selectedRoute) return null;
    const original = takeoffSnapshot({
      routePlan: selectedRoute,
      stationedCorridor: selectedRoute.originalStationedCorridor ?? selectedRoute.stationedCorridor,
      civilMixEstimate: selectedRoute.originalCivilMixEstimate ?? selectedRoute.civilMixEstimate,
    });
    const previewCivilMixEstimate = previewResult?.stationedCorridor
      ? estimateCivilMixFromCorridor({
          routeRequirementId: selectedRoute.routeRequirement.routeRequirementId,
          stationedCorridor: previewResult.stationedCorridor,
          profile: googleHeliumBudgetaryCostProfileV1,
        })
      : null;
    const proposal = takeoffSnapshot({
      routePlan: selectedRoute,
      stationedCorridor: previewResult?.stationedCorridor ?? selectedRoute.stationedCorridor,
      civilMixEstimate: previewCivilMixEstimate ?? selectedRoute.civilMixEstimate,
      costOverride: previewResult?.stationedCorridor ? undefined : pricingSummary.reconciliation.sellPriceIru,
    });
    if (!original || !proposal) return null;
    return {
      original,
      proposal,
      delta: {
        miles: Number((proposal.miles - original.miles).toFixed(2)),
        cost: proposal.cost - original.cost,
        ductFeet: proposal.ductFeet - original.ductFeet,
        fiberFeet: proposal.fiberFeet - original.fiberFeet,
        vaults: proposal.vaults - original.vaults,
        handholes: proposal.handholes - original.handholes,
        regen: proposal.regen - original.regen,
        crossings: proposal.crossings - original.crossings,
      },
    };
  }, [previewResult, pricingSummary.reconciliation.sellPriceIru, selectedRoute]);

  function viaPointsForPreview(finalCoordinate?: DALCoordinate) {
    const points = [...pendingViaPoints];
    if (finalCoordinate) {
      if (points.length) points[points.length - 1] = finalCoordinate;
      else points.push(finalCoordinate);
    }
    return points;
  }

  async function previewRevision(finalCoordinate?: DALCoordinate) {
    if (!selectedRoute) return;
    const viaPoints = viaPointsForPreview(finalCoordinate);
    if (!viaPoints.length) return;
    setPendingViaPoints(viaPoints);
    const previewResult = await previewGoogleRfpRouteRevision({
      routePlan: selectedRoute,
      viaPoints,
      affectedSegmentIds: [],
      actor: "Ryan",
      reason: "Sales corridor decision preview for Teralinx Bid Engine.",
    });
    setPreviewGeometry(previewResult?.revision.geometry ?? []);
    setPreviewResult(previewResult);
  }

  async function saveRevision() {
    if (!selectedRoute || !pendingViaPoints.length || revisionSaveStatus === "RECALCULATING") return;
    setRevisionSaveStatus("RECALCULATING");
    onCommercialRecalculationChange?.(true);
    try {
      const nextRoutePlan = await createGoogleRfpRouteRevisionPlan({
        routePlan: selectedRoute,
        viaPoints: pendingViaPoints,
        affectedSegmentIds: [],
        actor: "Ryan",
        reason: "Sales corridor decision proposal for Teralinx Bid Engine route review.",
      });
      const activeCorridorWasReplaced =
        nextRoutePlan.routeVerification.routeSnapStatus === "ROUTE_SNAPPED" &&
        Boolean(nextRoutePlan.stationedCorridor) &&
        nextRoutePlan.stationedCorridor?.stationedCorridorId !== selectedRoute.stationedCorridor?.stationedCorridorId;
      onRoutePlanRevised?.(nextRoutePlan);
      if (activeCorridorWasReplaced) {
        setPendingViaPoints([]);
        setPreviewGeometry([]);
        setPreviewResult(null);
        setRedlineMode("REVIEW");
        setRevisionSaveStatus("IDLE");
      } else {
        setRevisionSaveStatus("FAILED");
      }
    } catch (error) {
      console.warn("Teralinx Bid Engine route revision recalculation failed", error);
      setRevisionSaveStatus("FAILED");
    } finally {
      onCommercialRecalculationChange?.(false);
    }
  }

  if (!selectedRoute) {
    return (
      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Corridor Planning</h3>
          <span className="dal-badge warning">Combined Award</span>
        </div>
        <div className="dal-status">Combined Award is a commercial pricing scope. Select an individual route scope to review or drag a corridor.</div>
      </section>
    );
  }

  return (
    <section className="dal-panel bid-route-review-panel">
      <div className="dal-panel-title-row">
        <h3>Corridor Planning</h3>
        <span className="dal-badge warning">Budgetary</span>
      </div>
      <div className="dal-status">
        Selected commercial scope: {pricingSummary.scope.label}. The active proposal corridor drives every commercial recalculation.
        The original corridor remains immutable and available for Compare.
      </div>
      {revisionSaveStatus === "RECALCULATING" ? (
        <div className="dal-status bid-recalculation-status">Recalculating Commercial Plan...</div>
      ) : null}
      {revisionSaveStatus === "FAILED" ? (
        <div className="dal-status bid-recalculation-status">Commercial recalculation failed. The previous proposal corridor remains active.</div>
      ) : null}

      {selectedGraph ? (
        <ProposedNetworkMapPanel
          graph={selectedGraph}
          selected={mapSelection}
          onSelect={setMapSelection}
          mapMinHeight={720}
          redline={{
            mode: redlineMode,
            presentationMode: "SALES",
            pendingViaPoints,
            originalGeometry,
            revisionGeometry: previewGeometry,
            revisionCount: selectedRoute.routeRevisions?.length ?? 0,
            onModeChange: setRedlineMode,
            onAddViaPoint: (coordinate) => {
              setPreviewGeometry([]);
              setPreviewResult(null);
              setPendingViaPoints([coordinate]);
            },
            onMoveViaPoint: (index, coordinate) => setPendingViaPoints((prev) => {
              const next = [...prev];
              if (index >= next.length) next.push(coordinate);
              else next[index] = coordinate;
              return next;
            }),
            onRedlineDragComplete: previewRevision,
            onSaveRevision: saveRevision,
            onDiscardRevision: () => {
              setPendingViaPoints([]);
              setPreviewGeometry([]);
              setPreviewResult(null);
              setRedlineMode("REVIEW");
            },
            onSelectRevisionForProposal: () => {
              if (selectedRoute.selectedRevisionId) onRoutePlanRevised?.(selectedRoute);
            },
          }}
        />
      ) : (
        <div className="dal-status">Verified OSRM geometry is not available for this route. No stale fixture geometry is rendered.</div>
      )}
    </section>
  );
}
