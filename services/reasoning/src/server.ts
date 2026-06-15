import { createServer } from "node:http";
import { handleReasoningRoute } from "./routes.js";

export function startReasoningServer() {
  const port = Number(process.env.REASONING_PORT || 4100);
  const server = createServer((req, res) => {
    void handleReasoningRoute(req, res);
  });

  server.listen(port, () => {
    console.log(`Reasoning Service listening on http://127.0.0.1:${port}`);
  });

  return server;
}

