import type { GoogleBidPackagePreview } from "../../../rfp/GoogleBidPackagePreview";

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

export default function GoogleBidRoutePreviewPanel({ preview }: { preview: GoogleBidPackagePreview }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Route Preview</h3>
        <span className="dal-badge warning">Sales estimate</span>
      </div>
      <div className="dal-list">
        {preview.routePreviews.map((route) => (
          <div className="dal-list-row teralinx-list-row" key={route.routeRequirementId}>
            <b>{route.routeName}</b>
            <span>{route.status}</span>
            <small>
              {route.aSite} to {route.zSite}; {route.routeMiles.toLocaleString()} mi; plow {route.plowMiles} mi; HDD {route.hddMiles} mi; open trench {route.openTrenchMiles} mi; bridge {route.bridgeAttachmentCount}; rail {route.railCrossings}; water {route.waterCrossings}; highway {route.highwayCrossings}; vaults {route.vaultCount + route.handholeCount}; regen/ILA {route.regenIlaCount}; NRC {money(route.estimatedNrc)}; MRC {money(route.estimatedMrc)}.
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
