# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Philosophy

BotMaker packages OpenClaw into a turnkey bot platform. We are responsible
for producing **useful, usable, and working configurations** for all users.
"OpenClaw-side issue" is not an excuse — if the generated config is broken,
that's our bug. Every bot created through the wizard must work out of the box.

Users download this project from GitHub/GHCR. They may run:
- 100% cloud APIs (Anthropic, OpenAI, Google, etc.) with zero Ollama
- 100% local Ollama with zero cloud APIs
- A mix of both

The UI wizard, template generation, and proxy configuration must produce
valid, working configs for **every** combination.

## Build & Dev Commands

### Backend (root)
```bash
npm run build          # Compile TypeScript
npm run dev            # Hot-reload dev server (tsx watch)
npm run start          # Run compiled server
npm run test           # Vitest unit tests
npm run lint           # ESLint
npx vitest run src/bots/store.test.ts  # Single test file
```

### Dashboard (`dashboard/`)
```bash
npm run dev            # Vite dev server (localhost:5173)
npm run build          # TypeScript check + Vite build
npm run test           # Vitest + React Testing Library
```

### Proxy (`proxy/`)
```bash
npm run dev            # Hot-reload (tsx watch)
npm run build          # TypeScript compile
npm run test           # Vitest
```

### Full build
```bash
npm run build:all      # Backend + dashboard
```

### Docker
```bash
docker compose up -d                # Start botmaker + keyring-proxy
docker compose --profile build build botenv  # Build bot environment image
```

Test framework is **Vitest** (not Jest) across all three modules. Tests use `*.test.ts` pattern.

## Architecture

Three independent TypeScript services sharing one repo:

```
src/           → Backend: Fastify API (port 7100), bot lifecycle, Docker orchestration
proxy/src/     → Keyring-proxy: credential vault (admin:9100, data:9101), request forwarding
dashboard/src/ → React + Vite frontend: wizard, dashboard, secrets management
```

All three have their own `package.json`, `tsconfig.json`, and `vitest.config.ts`.

### Request Flow
```
User → Dashboard UI → Backend API (POST /api/bots)
                          ↓
                    Creates: openclaw.json (templates.ts)
                    Creates: Docker container (DockerService.ts)
                    Registers: bot with keyring-proxy (proxy/client.ts)
                          ↓
Bot container → keyring-proxy:9101/v1/{provider}/... → upstream API
                    (injects real API key at network edge)
```

### Zero-Trust Credential Model
Bots never hold real API keys. They get a proxy token that keyring-proxy
validates, then the proxy injects the real API key when forwarding upstream.
Provider names get a `-proxy` suffix (e.g., `openai-proxy`) to avoid
collisions with OpenClaw's built-in provider defaults.

### Key Files
- `src/server.ts` — All API routes (bot CRUD, auth, stats, admin)
- `src/bots/templates.ts` — Generates openclaw.json from wizard input
- `src/bots/store.ts` — Bot DB CRUD (better-sqlite3, no ORM)
- `src/services/DockerService.ts` — Container lifecycle
- `proxy/src/types.ts` — All 15+ LLM vendor configs + `initOllamaVendor()`
- `proxy/src/services/upstream.ts` — Transparent request forwarding (any path)
- `proxy/src/routes/proxy.ts` — Auth validation, key selection, forwarding
- `dashboard/src/wizard/` — Multi-step bot creation wizard
- `dashboard/src/config/providers/` — Provider definitions (22 providers)

### Database
Direct SQL via better-sqlite3 (no ORM). Two separate SQLite databases:
- Backend: `${DATA_DIR}/botmaker.db` — `bots` table
- Proxy: `${DB_PATH}/proxy.db` — `provider_keys`, `bots`, `usage_logs` (AES-256 encrypted keys)

### Provider API Type Mapping
`templates.ts:getApiTypeForProvider()` maps provider IDs to OpenClaw API types:
- `anthropic` → `anthropic-messages`
- `google` → `google-gemini`
- `openai` → `openai-responses`
- Everything else (ollama, groq, deepseek, mistral, etc.) → `openai-completions`

### Ollama Integration
- Optional: enabled by `OLLAMA_UPSTREAM` env var on keyring-proxy
- Uses `noAuth: true` + `forceNonStreaming: true` (OpenClaw can't parse streaming tool-call deltas)
- Bots address it identically to cloud: `http://keyring-proxy:9101/v1/ollama`
- Context window set via `OLLAMA_CONTEXT_LENGTH` env var on Ollama container

## Known Issue: memorySearch

OpenClaw's memorySearch auto-discovery looks for providers named exactly
`"openai"` or `"gemini"`. Our `-proxy` suffix means auto-discovery always
fails. The template generator must explicitly produce a `memorySearch`
section in openclaw.json pointing at the correct keyring-proxy embedding
endpoint, or explicitly disable it for providers without embedding support.

~13/22 providers support OpenAI-compatible `/embeddings`; the rest
(anthropic, groq, cerebras, perplexity, moonshot) need `enabled: false`.

## CI

GitHub Actions (`.github/workflows/ci.yml`): Node 20+22 matrix, lints and
tests all three modules, builds Docker image, pushes to GHCR on main.
