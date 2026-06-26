const items = [
  ["A Site", "#22c55e"],
  ["Z Site", "#ef4444"],
  ["Intermediate Site", "#38bdf8"],
  ["Vault / Handhole", "#f59e0b"],
  ["Regeneration Site", "#8b5cf6"],
  ["Centerline Route", "#0f766e"],
  ["Station", "#2563eb"],
  ["Crossing / Constraint", "#ef4444"],
] as const;

export default function ProposedNetworkLegendPanel() {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Legend</h3>
        <span className="dal-badge warning">Display only</span>
      </div>
      <div className="dal-list">
        {items.map(([label, color]) => (
          <div className="dal-list-row teralinx-list-row" key={label}>
            <b>{label}</b>
            <span aria-label={`${label} color`} style={{ width: 12, height: 12, borderRadius: 999, background: color, display: "inline-block" }} />
            <small>Read-only proposed network visualization.</small>
          </div>
        ))}
      </div>
    </section>
  );
}
