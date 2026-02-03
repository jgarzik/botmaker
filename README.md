# BotMaker

Web UI for managing OpenClaw AI chatbots in Docker containers.

## Key Features

### Zero-Trust API Key Architecture

BotMaker isolates API keys from bot containers entirely. Bots never see your real API credentials.

**Why this matters:** API key leaks are rampant in AI applications. Prompt injection attacks, compromised dependencies, and overly-verbose logging all create opportunities for keys to leak. With BotMaker:

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

- Node.js 20+
- Docker
- OpenClaw Docker image (`openclaw:latest` or custom base image)

## Quick Start

### Docker Compose (Recommended)

```bash
# Build the bot environment image (includes build tools, python, etc.)
docker compose build botenv

# Run services
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Development

```bash
# Install dependencies
npm install
cd dashboard && npm install && cd ..
cd proxy && npm install && cd ..

# Start backend (with hot reload)
npm run dev

# Start dashboard (in another terminal)
cd dashboard && npm run dev
```

### Production

```bash
# Build everything
npm run build:all

# Start
npm start
```

## Authentication

The dashboard requires password authentication. Set the `ADMIN_PASSWORD` environment variable:

```bash
# Docker Compose
ADMIN_PASSWORD=your-secure-password docker compose up -d

# Development
ADMIN_PASSWORD=your-secure-password npm run dev
```

**Requirements:**
- Password must be at least 12 characters
- Cannot be empty or omitted

On first visit, you'll see a login form. Enter the password to access the dashboard. Sessions are stored in-memory and expire after 24 hours.

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
| `ADMIN_PASSWORD` | *(required)* | Dashboard login password |
| `ADMIN_PASSWORD_FILE` | - | Alternative: read password from file |
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
# Run E2E tests (requires running server)
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
