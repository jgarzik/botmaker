# BotMaker

Web UI for managing OpenClaw AI chatbots in Docker containers.

## Features

- **Multi-AI Provider Support** - OpenAI, Anthropic, Google Gemini, Venice
- **Multi-Channel Wizard** - Telegram, Discord (all others supported by chatting with your bot post-setup)
- **Container Isolation** - Each bot runs in its own Docker container
- **Dashboard** - Creation wizard, monitoring, diagnostics
- **Secrets Management** - Per-bot credential isolation

## Requirements

- Node.js 20+
- Docker
- OpenClaw Docker image (`openclaw:latest` or custom)

## Quick Start

### Development

```bash
# Install dependencies
npm install
cd dashboard && npm install && cd ..

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

### Docker Compose

```bash
# Build and run
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 7100 | Server port |
| `HOST` | 0.0.0.0 | Bind address |
| `DATA_DIR` | ./data | Database and bot workspaces |
| `SECRETS_DIR` | ./secrets | Per-bot secret storage |
| `OPENCLAW_IMAGE` | openclaw:latest | Docker image for bots |
| `OPENCLAW_GIT_TAG` | main | Git tag for building image |
| `BOT_PORT_START` | 19000 | Starting port for bot containers |

## API Reference

### Bot Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bots` | List all bots with container status |
| GET | `/api/bots/:id` | Get bot details |
| POST | `/api/bots` | Create bot |
| DELETE | `/api/bots/:id` | Delete bot and cleanup resources |
| POST | `/api/bots/:id/start` | Start bot container |
| POST | `/api/bots/:id/stop` | Stop bot container |

### Monitoring & Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/stats` | Container resource stats (CPU, memory) |
| GET | `/api/admin/orphans` | Preview orphaned resources |
| POST | `/api/admin/cleanup` | Clean orphaned containers/workspaces/secrets |

## Architecture

```
botmaker/
├── src/                  # Backend (Fastify + TypeScript)
│   ├── bots/             # Bot store and templates
│   ├── db/               # SQLite database
│   ├── secrets/          # Per-bot secret management
│   └── services/         # Docker container management
├── dashboard/            # Frontend (React + Vite)
│   └── src/components/   # UI components
├── data/                 # Database and bot workspaces
├── secrets/              # Per-bot secret files
└── scripts/              # Test and utility scripts
```

### Components

- **Backend**: Fastify server with SQLite for bot metadata, Dockerode for container orchestration
- **Frontend**: React SPA with Vite, served statically in production
- **Secrets**: File-based per-bot credential isolation, mounted read-only into containers

## Development

### Project Structure

- `src/` - TypeScript backend source
- `dashboard/` - React frontend (separate npm project)
- `scripts/` - Test and utility scripts

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
