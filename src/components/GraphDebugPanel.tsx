type GraphScopeVersion = {
  id: string;
  nodes: any[];
  edges: any[];
  events: any[];
  metadata?: any;
};

function DebugBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
      <pre
        style={{
          margin: 0,
          padding: 12,
          borderRadius: 10,
          background: "#0b1220",
          border: "1px solid #1f2937",
          color: "#cbd5e1",
          fontSize: 12,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {value}
      </pre>
    </div>
  );
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

export function GraphDebugPanel({
  derivedState,
  graphScope,
  rawScope,
  closes,
}: {
  derivedState: any;
  graphScope: GraphScopeVersion;
  rawScope: any;
  closes: any[];
}) {
  return (
    <Panel title="Graph / Debug">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DebugBlock
          label="Derived State"
          value={JSON.stringify(derivedState, null, 2)}
        />
        <DebugBlock
          label="Graph Scope"
          value={JSON.stringify(graphScope, null, 2)}
        />
        <DebugBlock
          label="Loaded Scope"
          value={JSON.stringify(rawScope, null, 2)}
        />
        <DebugBlock
          label="Loaded Closes"
          value={JSON.stringify(closes, null, 2)}
        />
      </div>
    </Panel>
  );
}
