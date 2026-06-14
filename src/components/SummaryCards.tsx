type StatCard = {
  label: string;
  value: number | string;
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "#111827",
        border: "1px solid #1f2937",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function SummaryCards({
  totalStations,
  activeStations,
  unknownStations,
  totalEvents,
}: {
  totalStations: number;
  activeStations: number;
  unknownStations: number;
  totalEvents: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      <StatCard label="Stations" value={totalStations} />
      <StatCard label="Active" value={activeStations} />
      <StatCard label="Unknown" value={unknownStations} />
      <StatCard label="Events" value={totalEvents} />
    </div>
  );
}
