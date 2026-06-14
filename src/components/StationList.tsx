type StationRow = {
  key: string;
  label: string;
  state: string;
  raw: any;
  activated: boolean;
  stationId: string;
};

function StateBadge({ state }: { state: string }) {
  const color =
    state === "active"
      ? "#10b981"
      : state === "constrained"
      ? "#f59e0b"
      : state === "blocked"
      ? "#ef4444"
      : state === "unreachable"
      ? "#f97316"
      : "#6b7280";

  return (
    <div
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        background: color,
        color: "#ffffff",
        fontSize: 12,
        fontWeight: 700,
        textTransform: "capitalize",
      }}
    >
      {state}
    </div>
  );
}

function MutedText({ children }: { children: React.ReactNode }) {
  return <div style={{ opacity: 0.7 }}>{children}</div>;
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 0,
        borderRadius: 14,
        background: "#0f172a",
        border: "1px solid #1f2937",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
      <div style={{ minHeight: 0, overflow: "auto" }}>{children}</div>
    </div>
  );
}

export function StationList({
  stationRows,
  isLoading,
  loadError,
  onActivate,
}: {
  stationRows: StationRow[];
  isLoading: boolean;
  loadError: string | null;
  onActivate?: (stationId: string) => void;
}) {
  return (
    <Panel title="Stations / Derived State">
      {isLoading ? (
        <MutedText>Loading scope…</MutedText>
      ) : loadError ? (
        <MutedText>Load error: {loadError}</MutedText>
      ) : stationRows.length === 0 ? (
        <MutedText>No stations loaded yet.</MutedText>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {stationRows.map((row) => (
            <div
              key={row.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderRadius: 10,
                background: "#111827",
                border: "1px solid #1f2937",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{row.label}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{row.key}</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <StateBadge state={row.state} />
                {row.activated ? (
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "#16a34a",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "capitalize",
                    }}
                  >
                    activated
                  </div>
                ) : onActivate ? (
                  <button
                    onClick={() => onActivate(row.stationId)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Activate
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
