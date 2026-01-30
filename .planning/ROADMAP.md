# Roadmap: BotMaker

## Overview

BotMaker delivers a web UI for managing OpenClaw bot containers through five phases: database and secrets foundation, Docker container lifecycle integration, Fastify API with authentication and log streaming, React dashboard for user interaction, and MVP polish for production readiness. Each phase builds on the previous, with infrastructure dependencies resolved before service layers.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Database schema and secrets filesystem infrastructure
- [ ] **Phase 2: Docker Integration** - Container lifecycle operations and OpenClaw image
- [ ] **Phase 3: API Layer** - Fastify routes, authentication, and SSE log streaming
- [ ] **Phase 4: Frontend Dashboard** - React UI for bot management
- [ ] **Phase 5: MVP Polish** - Error handling, health checks, and production hardening

## Phase Details

### Phase 1: Foundation
**Goal**: Establish persistent storage and secure secrets infrastructure
**Depends on**: Nothing (first phase)
**Requirements**: INF-02, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. SQLite database exists with bots table and WAL mode enabled
  2. Secrets manager can create per-bot directories with 0700 permissions
  3. Secrets manager can write credential files with 0600 permissions
  4. Secrets manager can delete bot secrets directory on cleanup
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

### Phase 2: Docker Integration
**Goal**: Container lifecycle operations work independently of API layer
**Depends on**: Phase 1 (needs secrets paths for bind mounts)
**Requirements**: INF-01, BOT-03, BOT-04, BOT-05, BOT-06
**Success Criteria** (what must be TRUE):
  1. OpenClaw Docker image builds and runs standalone
  2. DockerService can create container with secrets bind-mounted to /run/secrets
  3. DockerService can start, stop, restart, and remove containers
  4. Container status can be inspected (running/stopped/error)
  5. Containers are labeled for BotMaker filtering (botmaker.managed=true)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: API Layer
**Goal**: HTTP API exposes all bot operations with authentication and real-time logs
**Depends on**: Phase 2 (needs DockerService)
**Requirements**: SEC-01, BOT-01, BOT-02, BOT-07, LOG-01, LOG-02, INF-03
**Success Criteria** (what must be TRUE):
  1. API requires HTTP Basic Auth for all protected routes
  2. POST /api/bots creates bot with name, AI config, and channel credentials
  3. GET /api/bots returns list of all bots with current container status
  4. GET /api/bots/:id returns bot configuration details
  5. GET /api/bots/:id/logs streams container logs via SSE
  6. GET /health returns 200 OK
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Frontend Dashboard
**Goal**: Users can manage bots through a web interface
**Depends on**: Phase 3 (needs working API)
**Requirements**: (none unique - UI implements Phase 3 API capabilities)
**Success Criteria** (what must be TRUE):
  1. User can view bot list with status badges (running/stopped/error)
  2. User can create new bot via form (name, AI provider, model, channel, credentials)
  3. User can start/stop/restart/delete bots with confirmation for destructive actions
  4. User can view bot detail page showing configuration
  5. User can view real-time streaming logs for a bot
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: MVP Polish
**Goal**: Production-ready error handling and operational reliability
**Depends on**: Phase 4 (needs end-to-end flow working)
**Requirements**: (none unique - refinement of existing capabilities)
**Success Criteria** (what must be TRUE):
  1. API errors return consistent JSON error responses
  2. UI shows loading states during async operations
  3. Container/database state reconciliation handles orphaned containers
  4. Log streaming handles backpressure without memory exhaustion
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/? | Not started | - |
| 2. Docker Integration | 0/? | Not started | - |
| 3. API Layer | 0/? | Not started | - |
| 4. Frontend Dashboard | 0/? | Not started | - |
| 5. MVP Polish | 0/? | Not started | - |

---
*Roadmap created: 2026-01-30*
