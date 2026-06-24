import type { PrismWorkspace } from "../../../prism/PrismWorkspace";

export default function PrismOpportunityPanel({ workspace }: { workspace: PrismWorkspace }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Opportunities</h3>
        <span className="dal-badge warning">Advisory only</span>
      </div>

      <div className="prism-card-grid">
        {workspace.advisoryCards.map((card) => (
          <article className="prism-advisory-card" key={card.cardId}>
            <div className="dal-panel-title-row">
              <h3>{card.title}</h3>
              <span className="dal-badge pass">{card.impactScore}</span>
            </div>
            <span className="dal-badge warning">{card.category.replaceAll("_", " ")}</span>
            <p>{card.summary}</p>
            <div className="dal-status">Confidence: {card.confidence}</div>
          </article>
        ))}
      </div>

      <div className="dal-grid compact">
        <section className="dal-panel">
          <h3>Route Alternatives</h3>
          <div className="dal-list">
            {workspace.routeAlternatives.map((alternative) => (
              <div className="dal-list-row opportunity-list-row" key={alternative.alternativeId}>
                <b>{alternative.label}</b>
                <span>{alternative.routeType}</span>
                <small>{alternative.summary}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="dal-panel">
          <h3>Marketplace Matches</h3>
          <div className="dal-list">
            {workspace.marketplaceAssets.slice(0, 6).map((asset) => (
              <div className="dal-list-row opportunity-list-row" key={asset.assetId}>
                <b>{asset.assetName}</b>
                <span>{asset.assetType}</span>
                <small>{asset.ownerName} · {asset.status}</small>
              </div>
            ))}
            {!workspace.marketplaceAssets.length && <div className="dal-status">No marketplace assets in this fixture.</div>}
          </div>
        </section>
      </div>
    </section>
  );
}
