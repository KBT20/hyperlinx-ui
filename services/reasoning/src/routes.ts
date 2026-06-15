import type { IncomingMessage, ServerResponse } from "node:http";
import { getReasoningTrace, listReasoningTraces } from "./audit/reasoningEvents.js";
import { providerHealth } from "./inferenceProvider.js";
import { runReasoning } from "./reasoningClient.js";
import { validateReasoningRequest } from "./schemas.js";

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

export async function handleReasoningRoute(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/reasoning/health") {
      sendJson(res, 200, await providerHealth());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/reasoning/query") {
      const request = validateReasoningRequest(await readBody(req));
      sendJson(res, 200, await runReasoning(request));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/reasoning/traces") {
      sendJson(res, 200, { traces: listReasoningTraces() });
      return;
    }

    const traceMatch = url.pathname.match(/^\/api\/reasoning\/traces\/([^/]+)$/);
    if (req.method === "GET" && traceMatch) {
      const trace = getReasoningTrace(decodeURIComponent(traceMatch[1]));
      if (!trace) sendJson(res, 404, { error: "Reasoning trace not found" });
      else sendJson(res, 200, { trace });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err: any) {
    sendJson(res, 400, { error: err?.message ?? String(err), nonAuthoritative: true });
  }
}

