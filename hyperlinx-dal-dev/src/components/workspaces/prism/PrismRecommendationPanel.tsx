import type { PrismWorkspace } from "../../../prism/PrismWorkspace";

export default function PrismRecommendationPanel({ workspace }: { workspace: PrismWorkspace }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Recommendations</h3>
        <div className="dal-actions">
          <span className="dal-badge warning">Non-authoritative</span>
          <span className="dal-badge warning">No automatic actions</span>
        </div>
      </div>

      <div className="prism-card-grid">
        {workspace.recommendations.map((recommendation) => (
          <article className="prism-advisory-card" key={recommendation.recommendationId}>
            <div className="dal-panel-title-row">
              <h3>{recommendation.title}</h3>
              <span className="dal-badge warning">{recommendation.recommendationType.replaceAll("_", " ")}</span>
            </div>
            <p>{recommendation.rationale}</p>
            <div className="dal-status">{recommendation.expectedBenefit}</div>
          </article>
        ))}
      </div>

      <button type="button" disabled>
        Generate Preliminary Quote
      </button>
    </section>
  );
}
