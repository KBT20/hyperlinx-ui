import { useEffect, useMemo, useRef, useState } from "react";
import { IOF_API } from "../config/api";

type ScopeVersion = {
  id: string;
  corridor_id: string;
  segment_id: string | null;
};

export default function ScopeSelector({
  selectedScopeVersionId,
  onSelect,
}: {
  selectedScopeVersionId?: string | null;
  onSelect: (scopeVersionId: string, scope: ScopeVersion) => void;
}) {
  const [scopes, setScopes] = useState<ScopeVersion[]>([]);
  const hasAutoSelectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadScopes = async () => {
      try {
        const res = await fetch(`${IOF_API}/iof/scopeVersions`);

        if (!res.ok) {
          throw new Error(`Failed (${res.status})`);
        }

        const data = await res.json();
        const scopesList = Array.isArray(data) ? data : [];
        if (!cancelled) setScopes(scopesList);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load scopeVersions", err);
          setScopes([]);
        }
      }
    };

    loadScopes();

    return () => {
      cancelled = true;
    };
  }, [onSelect]);

  useEffect(() => {
    if (
      scopes.length > 0 &&
      !selectedScopeVersionId &&
      !hasAutoSelectedRef.current
    ) {
      const firstScope = scopes[0];
      console.log("SCOPE SELECTOR AUTO SELECT", firstScope.id);
      onSelect(firstScope.id, firstScope);
      hasAutoSelectedRef.current = true;
    }
  }, [scopes, selectedScopeVersionId, onSelect]);

  return (
    <div style={{ marginBottom: 16 }}>
      <h3>Select Scope Version</h3>

      <select
        value={selectedScopeVersionId ?? ""}
        onChange={(e) => {
          const selected = scopes.find((s) => s.id === e.target.value);
          if (!selected) return;
          console.log("SCOPE SELECTOR USER SELECT", selected.id);
          onSelect(selected.id, selected);
        }}
      >
        <option value="" disabled>
          Select a scope version
        </option>
        {scopes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.corridor_id} / {s.segment_id ?? "NO-SEG"} / {s.id.slice(0, 8)}
          </option>
        ))}
      </select>
    </div>
  );
}
