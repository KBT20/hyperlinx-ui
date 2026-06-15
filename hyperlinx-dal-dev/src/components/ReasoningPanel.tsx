import { useEffect, useState } from "react";
import { loadReasoningHealth, queryReasoning, type ReasoningContext, type ReasoningResponse, type ReasoningWorkspace } from "../api/reasoningClient";

export default function ReasoningPanel({
  workspace,
  context,
  suggestedPrompts,
  title,
}: {
  workspace: ReasoningWorkspace;
  context: ReasoningContext;
  suggestedPrompts: string[];
  title: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [intent, setIntent] = useState("operator-assist");
  const [answer, setAnswer] = useState<ReasoningResponse | null>(null);
  const [status, setStatus] = useState("Reasoning ready.");
  const [health, setHealth] = useState<{ providerReachable: boolean; dryRun: boolean; model: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadReasoningHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  async function askReasoning(userPrompt = prompt) {
    if (!userPrompt.trim()) {
      setStatus("Choose or enter a question first.");
      return;
    }
    try {
      setLoading(true);
      setOpen(true);
      setStatus("Asking Reasoning Service...");
      const response = await queryReasoning({
        workspace,
        intent,
        userPrompt,
        context,
      });
      setAnswer(response);
      setStatus(response.dryRun ? "Dry-run reasoning returned." : "Reasoning returned.");
    } catch (err: any) {
      setStatus(`Reasoning failed: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="dal-reasoning-panel">
      <div className="dal-panel-title-row">
        <div>
          <h3>{title}</h3>
          <span className="dal-reasoning-badge">Human approval required</span>
        </div>
        <button type="button" onClick={() => setOpen((prev) => !prev)}>
          {open ? "Hide" : "Ask Reasoning"}
        </button>
      </div>

      {open && (
        <>
          <div className="dal-status">
            {status}
            {health && ` | Model: ${health.model} | Provider: ${health.providerReachable ? "reachable" : "dry-run"}`}
          </div>
          <div className="dal-reasoning-prompts">
            {suggestedPrompts.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setPrompt(item);
                  void askReasoning(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <input value={intent} onChange={(event) => setIntent(event.target.value)} placeholder="Intent" />
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask bounded reasoning..." />
          <button type="button" disabled={loading} onClick={() => void askReasoning()}>
            {loading ? "Thinking..." : "Ask Reasoning"}
          </button>

          {answer && (
            <div className="dal-reasoning-answer">
              <div className="dal-metrics">
                <span>ID: {answer.reasoningId}</span>
                <span>Confidence: {Math.round(answer.confidence * 100)}%</span>
                <span>{answer.nonAuthoritative ? "Non-authoritative" : "Authoritative disabled"}</span>
              </div>
              <p>{answer.answer}</p>
              <h4>Recommendations</h4>
              <ul>
                {answer.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h4>Proposed Actions</h4>
              <ul>
                {answer.proposedActions.map((item) => (
                  <li key={item.label}>
                    <b>{item.label}</b>: {item.description}
                  </li>
                ))}
              </ul>
              <h4>Warnings</h4>
              <ul>
                {answer.warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

