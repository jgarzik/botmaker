# Requirements: BotMaker

**Defined:** 2026-01-30
**Core Value:** Simple, secure bot provisioning — spin up isolated OpenClaw instances without manual Docker or config file management.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Bot Lifecycle

- [ ] **BOT-01**: User can create a bot with name, AI provider, model, API key, channel type, and channel credentials
- [ ] **BOT-02**: User can view list of all bots with current status (running/stopped/error)
- [x] **BOT-03**: User can start a stopped bot
- [x] **BOT-04**: User can stop a running bot
- [x] **BOT-05**: User can restart a running bot
- [x] **BOT-06**: User can delete a bot (stops container, removes secrets)
- [ ] **BOT-07**: User can view bot detail page showing configuration

### Logging

- [ ] **LOG-01**: User can view container logs for a bot
- [ ] **LOG-02**: Logs stream in real-time via SSE

### Security

- [ ] **SEC-01**: UI requires HTTP Basic Auth to access
- [x] **SEC-02**: Secrets stored as files with 0600 permissions
- [x] **SEC-03**: Each bot has isolated secrets directory (no sharing)

### Infrastructure

- [x] **INF-01**: Minimal OpenClaw Docker image exists for bot containers
- [x] **INF-02**: SQLite database stores bot metadata
- [ ] **INF-03**: Health check endpoint available at /health

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Logging Enhancements

- **LOG-03**: Log search with regex filtering
- **LOG-04**: Log download as text file
- **LOG-05**: Auto-scroll pause/resume toggle

### Operations

- **OPS-01**: Container resource limits (CPU/memory)
- **OPS-02**: Scheduled orphan container cleanup
- **OPS-03**: Bulk actions (multi-select start/stop/delete)

### Validation

- **VAL-01**: Channel token format validation on create
- **VAL-02**: API key validation before container creation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Docker Swarm / remote hosts | Local Docker only for v1 simplicity |
| Config editing after creation | Complexity — delete and recreate instead |
| Credential sharing between bots | Violates isolation principle |
| Shell/exec access to containers | Security risk |
| User authentication/RBAC | Single-user assumption for v1 |
| Image/volume/network management | Scope creep — BotMaker manages bots only |
| Mobile-specific UI | Web-first, responsive is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INF-02 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| INF-01 | Phase 2 | Complete |
| BOT-03 | Phase 2 | Complete |
| BOT-04 | Phase 2 | Complete |
| BOT-05 | Phase 2 | Complete |
| BOT-06 | Phase 2 | Complete |
| SEC-01 | Phase 3 | Pending |
| BOT-01 | Phase 3 | Pending |
| BOT-02 | Phase 3 | Pending |
| BOT-07 | Phase 3 | Pending |
| LOG-01 | Phase 3 | Pending |
| LOG-02 | Phase 3 | Pending |
| INF-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

**Phase 4 (Frontend Dashboard):** No unique requirements - implements UI for Phase 3 API capabilities
**Phase 5 (MVP Polish):** No unique requirements - refinement and production hardening

---
*Requirements defined: 2026-01-30*
*Last updated: 2026-01-30 after Phase 2 completion*
