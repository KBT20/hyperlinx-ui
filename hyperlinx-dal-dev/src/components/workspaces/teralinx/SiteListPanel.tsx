import type { TeralinxRouteIntake } from "../../../teralinx/TeralinxRouteIntake";

function siteLocation(site: TeralinxRouteIntake["routeRequest"]["siteList"][number]) {
  if (Number.isFinite(site.latitude) && Number.isFinite(site.longitude)) return `${site.latitude}, ${site.longitude}`;
  return site.address || "Missing location";
}

export default function SiteListPanel({ intake }: { intake: TeralinxRouteIntake }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Sites</h3>
        <span className="dal-badge pass">{intake.routeRequest.siteList.length} sites</span>
      </div>
      <div className="teralinx-site-grid">
        {intake.routeRequest.siteList.map((site) => (
          <article className="teralinx-site-card" key={site.siteId}>
            <div className="dal-panel-title-row">
              <h3>{site.facilityName || site.siteId}</h3>
              <span className="dal-badge warning">{site.role.replaceAll("_", " ")}</span>
            </div>
            <p>{siteLocation(site)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
