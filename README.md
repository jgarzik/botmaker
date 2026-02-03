# BotMaker

Web UI for managing [OpenClaw](https://github.com/jgarzik/openclaw) AI chatbots in Docker containers.

**OpenClaw** is a multi-channel AI chatbot framework. BotMaker provides the management layer: a dashboard to create, configure, and monitor OpenClaw bots without editing config files.

## Key Features

### Zero-Trust API Key Architecture

Traditional setups pass API keys directly to bots—if a bot is compromised, your keys leak. BotMaker uses a **zero-trust** model: bots never have access to real credentials, even if fully compromised.

**Why this matters:** API key leaks are common in AI applications—prompt injection attacks, compromised dependencies, and verbose logging all create leak vectors. With BotMaker:

- Bot containers receive only a proxy URL, never real API keys
- A separate **keyring-proxy** container holds encrypted credentials
- All AI provider requests route through the proxy, which injects credentials at the network edge
- Even a fully compromised bot cannot extract your API keys

### Additional Features

- **Multi-AI Provider Support** - OpenAI, Anthropic, Google Gemini, Venice
- **Multi-Channel Wizard** - Telegram, Discord (all others supported by chatting with your bot post-setup)
- **Container Isolation** - Each bot runs in its own Docker container
- **Dashboard** - Creation wizard, monitoring, diagnostics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                          │
│                                                             │
│  ┌─────────────┐     ┌───────────────┐     ┌─────────────┐ │
│  │   Bot A     │     │ keyring-proxy │     │  OpenAI     │ │
│  │             │────▶│               │────▶│  Anthropic  │ │
│  │ (no keys)   │     │ (has keys)    │     │  etc.       │ │
│  └─────────────┘     └───────────────┘     └─────────────┘ │
│                             ▲                               │
│  ┌─────────────┐            │                               │
│  │   Bot B     │────────────┘                               │
│  │ (no keys)   │                                            │
│  └─────────────┘                                            │
│                                                             │
│  ┌─────────────┐                                            │
│  │  BotMaker   │  ◀── Dashboard UI                          │
│  │  (manager)  │      Bot lifecycle                         │
│  └─────────────┘      Key management                        │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

| Container | Purpose | Has API Keys? |
|-----------|---------|---------------|
| **botmaker** | Dashboard, bot lifecycle management | No (admin only) |
| **keyring-proxy** | Credential storage, request proxying | Yes (encrypted) |
| **bot containers** | Run OpenClaw chatbots | No |

## Requirements

- Docker and Docker Compose
- Node.js 20+ (for development only)
- OpenClaw base image — build from [OpenClaw repo](https://github.com/jgarzik/openclaw) or use a prebuilt image:
  ```bash
  # Option A: Build from source
  git clone https://github.com/jgarzik/openclaw && cd openclaw && docker build -t openclaw:latest .

  # Option B: Use a prebuilt image (set OPENCLAW_BASE_IMAGE in docker-compose.yml)
  ```

## Quick Start

### Docker Compose (Recommended)

```bash
# 1. Initialize secrets (first time only)
mkdir -p secrets
openssl rand -hex 32 > secrets/master_key
openssl rand -hex 32 > secrets/admin_token
cp secrets/admin_token secrets/proxy_admin_token
openssl rand -base64 16 > secrets/admin_password

# 2. Build images (first time, or after code changes)
docker compose build botenv
docker compose build

# 3. Run services
docker compose up -d

# 4. Open dashboard (password is in secrets/admin_password)
open http://localhost:7100   # or visit in browser
cat secrets/admin_password   # to see your generated password
```

Other useful commands:
```bash
docker compose logs -f      # View logs
docker compose down         # Stop services
docker compose ps           # Check status
```

### Development

```bash
# Install dependencies
npm install
cd dashboard && npm install && cd ..
cd proxy && npm install && cd ..

# Start backend (with hot reload)
ADMIN_PASSWORD=devpassword12 npm run dev

# Start dashboard (in another terminal)
cd dashboard && npm run dev
```

### Production (without Docker)

```bash
# Build everything
npm run build:all

# Start
ADMIN_PASSWORD=your-secure-password npm start
```

## Authentication

The dashboard requires password authentication. The password is read from `secrets/admin_password`.

**Setup (done in Quick Start):**
```bash
openssl rand -base64 16 > secrets/admin_password
```

**Requirements:**
- Password must be at least 12 characters
- File must exist and be readable

**Alternative (development only):**
```bash
ADMIN_PASSWORD=your-password npm run dev
```

On first visit, you'll see a login form. Enter the password to access the dashboard. Sessions are stored in-memory and expire after 24 hours.

### After Login

1. **Add API Keys** — Go to the Secrets tab and add your AI provider API keys (OpenAI, Anthropic, etc.). These are stored encrypted in the keyring-proxy.

2. **Create a Bot** — Click "New Bot" and follow the wizard. You'll need:
   - A name and hostname for your bot
   - Select an AI provider (must have a key added first)
   - A channel token (Telegram bot token or Discord bot token)
   - A persona (name and personality description)

3. **Monitor** — The Dashboard tab shows all bots with their status. Start/stop bots, view logs, and check resource usage.

### Login API

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:7100/api/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}' | jq -r .token)

# Use token for API calls
curl -H "Authorization: Bearer $TOKEN" http://localhost:7100/api/bots

# Logout
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:7100/api/logout
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_PASSWORD_FILE` | /secrets/admin_password | Dashboard password file (recommended) |
| `ADMIN_PASSWORD` | - | Dashboard password (env var, dev only) |
| `PORT` | 7100 | Server port |
| `HOST` | 0.0.0.0 | Bind address |
| `DATA_DIR` | ./data | Database and bot workspaces |
| `SECRETS_DIR` | ./secrets | Per-bot secret storage |
| `BOTENV_IMAGE` | botmaker-env:latest | Bot container image (built from botenv) |
| `OPENCLAW_BASE_IMAGE` | openclaw:latest | Base image for botenv |
| `BOT_PORT_START` | 19000 | Starting port for bot containers |
| `SESSION_EXPIRY_MS` | 86400000 | Session expiry in milliseconds (default 24h) |

## API Reference

All `/api/*` endpoints require authentication via Bearer token (see Authentication section).

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login` | Login with password, returns session token |
| POST | `/api/logout` | Invalidate current session |

### Bot Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bots` | List all bots with container status |
| GET | `/api/bots/:hostname` | Get bot details |
| POST | `/api/bots` | Create bot |
| DELETE | `/api/bots/:hostname` | Delete bot and cleanup resources |
| POST | `/api/bots/:hostname/start` | Start bot container |
| POST | `/api/bots/:hostname/stop` | Stop bot container |

### Monitoring & Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth required) |
| GET | `/api/stats` | Container resource stats (CPU, memory) |
| GET | `/api/admin/orphans` | Preview orphaned resources |
| POST | `/api/admin/cleanup` | Clean orphaned containers/workspaces/secrets |

## Project Structure

```
botmaker/
├── src/                  # Backend (Fastify + TypeScript)
│   ├── bots/             # Bot store and templates
│   ├── db/               # SQLite database
│   ├── secrets/          # Per-bot secret management
│   └── services/         # Docker container management
├── proxy/                # Keyring proxy service
│   └── src/              # Credential storage & request proxying
├── dashboard/            # Frontend (React + Vite)
│   └── src/components/   # UI components
├── data/                 # Database and bot workspaces
├── secrets/              # Shared secrets (master key, admin token)
└── scripts/              # Test and utility scripts
```

## Development

### Running Tests

```bash
# Backend unit tests
npm test

# Dashboard unit tests
cd dashboard && npm test

# E2E tests (requires running server)
./scripts/test-e2e.sh
```

### Code Style

- ESLint with TypeScript strict mode
- Run `npm run lint` to check, `npm run lint:fix` to auto-fix

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the code style
4. Submit a pull request

## License

MIT License
