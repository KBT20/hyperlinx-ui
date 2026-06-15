# Hyperlinx DAL Reasoning Service

One bounded reasoning service supports every DAL UI. It provides summaries, explanations, draft recommendations, and non-authoritative proposed actions.

## Boundaries

- No model weights in Git.
- No secrets in Git.
- No direct DAL UI to GPU/vLLM calls.
- Reasoning output is non-authoritative.
- Deterministic IOF/DAL services remain authoritative.
- Humans remain authoritative.

## Environment

Copy `.env.example` into your runtime environment:

```env
VLLM_BASE_URL=http://127.0.0.1:8000/v1
VLLM_MODEL=mistral
VLLM_API_KEY=local-or-empty
REASONING_PORT=4100
REASONING_MODE=local
REASONING_MAX_CONTEXT_TOKENS=24000
```

## Run

```bash
cd services/reasoning
npm install
npm run build
npm start
```

## Endpoints

- `GET /api/reasoning/health`
- `POST /api/reasoning/query`
- `GET /api/reasoning/traces`
- `GET /api/reasoning/traces/:reasoningId`

If vLLM is unavailable, the service returns deterministic dry-run reasoning with `providerReachable: false` and `dryRun: true`.

