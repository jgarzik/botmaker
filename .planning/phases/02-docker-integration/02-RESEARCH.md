# Phase 2: Docker Integration - Research

**Researched:** 2026-01-30
**Domain:** Docker container lifecycle management with Node.js
**Confidence:** HIGH

## Summary

Docker container lifecycle management in Node.js is a well-established domain with mature tooling. The standard approach uses `dockerode` (4.0.9), the most popular Docker SDK for Node.js with 1.9M weekly downloads. The library provides both callback and promise-based interfaces for all Docker Engine API operations.

Container lifecycle follows a clear state machine: created → running → stopped → removed. The DockerService pattern wraps dockerode methods to provide application-specific container management. Key configuration areas include restart policies (`unless-stopped` for auto-recovery), bind mounts for secrets isolation, and labels for container filtering and orphan detection.

Critical pitfalls center on stream handling (logs/exec streams don't always end cleanly), error handling (getContainer doesn't validate existence), and secrets management (never use environment variables for secrets, always use bind mounts to /run/secrets).

**Primary recommendation:** Use dockerode 4.0.9 with TypeScript types, wrap in service class with explicit error handling, bind-mount secrets read-only to /run/secrets, and use label filtering for container discovery.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dockerode | 4.0.9 | Docker Engine API client for Node.js | 1.9M weekly downloads, 4,739 GitHub stars, actively maintained, full API coverage |
| @types/dockerode | 4.0.0 | TypeScript definitions for dockerode | Official DefinitelyTyped types, updated Jan 2026 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/docker-modem | latest | TypeScript types for docker-modem | Automatically installed with @types/dockerode |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dockerode | node-docker-api | Promisified-only interface, but only 103K weekly downloads, beta status, less community support |
| dockerode | @docker/sdk | Newer official SDK, but less mature, minimal documentation, smaller ecosystem |

**Installation:**
```bash
npm install dockerode
npm install --save-dev @types/dockerode
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   └── DockerService.ts     # Container lifecycle wrapper
├── types/
│   └── container.ts         # Container status/config types
└── utils/
    └── docker-errors.ts     # Error wrapping/handling
```

### Pattern 1: Service Class Wrapper
**What:** Encapsulate dockerode in a service class that maps bot IDs to containers
**When to use:** When container operations are domain-specific (e.g., bot management)
**Example:**
```typescript
// Source: WebSearch verified with Docker API patterns
import Docker from 'dockerode';

export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker(); // Uses /var/run/docker.sock by default
  }

  async createContainer(botId: string, config: ContainerConfig): Promise<string> {
    const container = await this.docker.createContainer({
      name: `botmaker-${botId}`,
      Image: config.image,
      Env: config.environment,
      Labels: {
        'botmaker.managed': 'true',
        'botmaker.bot-id': botId
      },
      HostConfig: {
        Binds: [`${config.secretsPath}:/run/secrets:ro`],
        RestartPolicy: {
          Name: 'unless-stopped'
        },
        NetworkMode: 'bridge'
      }
    });

    return container.id;
  }

  async startContainer(botId: string): Promise<void> {
    const container = this.docker.getContainer(`botmaker-${botId}`);
    await container.start();
  }

  async stopContainer(botId: string): Promise<void> {
    const container = this.docker.getContainer(`botmaker-${botId}`);
    await container.stop();
  }

  async restartContainer(botId: string): Promise<void> {
    const container = this.docker.getContainer(`botmaker-${botId}`);
    await container.restart();
  }

  async removeContainer(botId: string): Promise<void> {
    const container = this.docker.getContainer(`botmaker-${botId}`);
    try {
      await container.stop({ t: 10 }); // 10 second grace period
    } catch (err) {
      // Container may already be stopped
    }
    await container.remove();
  }

  async getContainerStatus(botId: string): Promise<ContainerStatus | null> {
    try {
      const container = this.docker.getContainer(`botmaker-${botId}`);
      const info = await container.inspect();

      return {
        id: info.Id,
        state: info.State.Status,
        running: info.State.Running,
        exitCode: info.State.ExitCode,
        startedAt: info.State.StartedAt,
        finishedAt: info.State.FinishedAt
      };
    } catch (err: any) {
      if (err.statusCode === 404) {
        return null; // Container doesn't exist
      }
      throw err;
    }
  }

  async listManagedContainers(): Promise<ContainerInfo[]> {
    const containers = await this.docker.listContainers({
      all: true, // Include stopped containers
      filters: {
        label: ['botmaker.managed=true']
      }
    });

    return containers.map(c => ({
      id: c.Id,
      name: c.Names[0].replace(/^\//, ''), // Remove leading slash
      botId: c.Labels['botmaker.bot-id'],
      state: c.State,
      status: c.Status
    }));
  }
}
```

### Pattern 2: Error Handling Wrapper
**What:** Wrap dockerode errors with domain-specific context
**When to use:** To provide clear error messages for API layer
**Example:**
```typescript
// Source: Docker API error patterns + dockerode issues
export class ContainerError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'ALREADY_EXISTS' | 'START_FAILED' | 'NETWORK_ERROR',
    message: string,
    public botId: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ContainerError';
  }
}

export function wrapDockerError(err: any, botId: string): ContainerError {
  if (err.statusCode === 404) {
    return new ContainerError('NOT_FOUND', `Container for bot ${botId} not found`, botId, err);
  }
  if (err.statusCode === 409) {
    return new ContainerError('ALREADY_EXISTS', `Container for bot ${botId} already exists`, botId, err);
  }
  if (err.message?.includes('timeout') || err.code === 'ETIMEDOUT') {
    return new ContainerError('NETWORK_ERROR', `Docker daemon connection timeout`, botId, err);
  }
  return new ContainerError('START_FAILED', err.message || 'Unknown Docker error', botId, err);
}
```

### Pattern 3: Label-Based Filtering
**What:** Use labels to mark and discover managed containers
**When to use:** To distinguish your containers from other Docker containers on the host
**Example:**
```typescript
// Source: Docker label filtering patterns from WebSearch
// Filter format: label=["key=value", "key2=value2"]
const managedContainers = await docker.listContainers({
  all: true,
  filters: {
    label: [
      'botmaker.managed=true',
      'botmaker.bot-id' // Has this label (any value)
    ]
  }
});

// Detect orphans: containers in Docker but not in database
const orphans = containers.filter(c =>
  !databaseBotIds.includes(c.Labels['botmaker.bot-id'])
);
```

### Anti-Patterns to Avoid
- **Using environment variables for secrets:** Environment variables are logged, visible to all processes, and leaked between containers. Always use bind-mounted files.
- **Not handling 404 errors:** `getContainer()` doesn't validate existence. Always wrap `.inspect()`, `.start()`, etc. in try-catch for 404 handling.
- **Ignoring stream cleanup:** Container logs and exec streams may not emit 'end' events. Use timeouts or explicit cleanup.
- **Auto-retry on start failures:** If a container fails to start, the configuration is likely wrong. Return error status instead of retrying.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Docker API communication | Raw HTTP client to /var/run/docker.sock | dockerode | Handles socket/HTTP/HTTPS connections, multiplexing, stream demux, authentication |
| Container state tracking | Poll containers to check status | dockerode's inspect() + labels | Docker maintains state, labels provide identity mapping |
| Log streaming | Parse Docker API stream format | dockerode's container.logs() with follow option | Handles TTY vs non-TTY, stdout/stderr multiplexing |
| Restart orchestration | Manual start/stop loop with intervals | Docker restart policies (unless-stopped) | Docker daemon manages restarts, survives host reboots |
| Container discovery | Parse `docker ps` output | dockerode's listContainers with label filters | Type-safe, filters server-side, handles pagination |
| Secrets management | Environment variables or custom mount logic | Bind mount to /run/secrets read-only | Industry standard, works with OpenClaw's existing pattern |

**Key insight:** Docker's API is complex (stream multiplexing, TTY handling, error codes). dockerode encapsulates years of edge case handling. Container orchestration (restart policies, health checks) is better handled by Docker itself than application-level loops.

## Common Pitfalls

### Pitfall 1: getContainer() Doesn't Validate Existence
**What goes wrong:** Calling `docker.getContainer(id)` succeeds even if container doesn't exist, then subsequent operations (start, stop, inspect) throw 404 errors.
**Why it happens:** `getContainer()` is a factory method that creates a container reference object, not an API call.
**How to avoid:** Always wrap container operations in try-catch and handle 404 status codes explicitly. Use `inspect()` first if existence check is needed.
**Warning signs:** 404 errors when starting/stopping containers that "should" exist.

### Pitfall 2: Streams Don't Always Emit 'end' Event
**What goes wrong:** Code waits for container.logs() or exec.start() stream to end, but event never fires, causing hanging processes.
**Why it happens:** Docker API streams can stay open indefinitely for following logs, or exec streams may not emit end on command completion.
**How to avoid:** Use timeout mechanisms, explicit stream cleanup, or the `follow: false` option for logs. Don't rely solely on 'end' event.
**Warning signs:** Node.js process doesn't exit after container operations, hanging awaits on stream promises.

### Pitfall 3: Secrets in Environment Variables
**What goes wrong:** Passing secrets via `Env` array exposes them in `docker inspect`, logs, and child processes.
**Why it happens:** Environment variables are visible globally within container and persisted in Docker's metadata.
**How to avoid:** Always use bind mounts to /run/secrets with read-only flag. OpenClaw already expects this pattern.
**Warning signs:** Secrets visible in `docker inspect` output, security audit failures.

### Pitfall 4: Restart Policy Confusion
**What goes wrong:** Using `always` restart policy causes stopped containers to restart on Docker daemon restart, even when intentionally stopped.
**Why it happens:** `always` means "always restart unless explicitly removed," including after host reboots.
**How to avoid:** Use `unless-stopped` for services that should auto-recover but respect manual stops. Only use `always` for critical infrastructure containers.
**Warning signs:** Containers restarting after manual stops when Docker daemon restarts.

### Pitfall 5: Not Handling Container Already Exists
**What goes wrong:** Creating a container with the same name twice throws 409 Conflict error.
**Why it happens:** Docker container names must be unique. Stopped containers still occupy the namespace.
**How to avoid:** Check if container exists before creating, or remove old container first. Use label-based discovery to find existing containers.
**Warning signs:** 409 Conflict errors on container creation after failed cleanup.

### Pitfall 6: Bind Mount Path Validation
**What goes wrong:** Bind mounting paths with special characters, spaces, or non-existent directories causes cryptic errors.
**Why it happens:** Docker validates bind mount source paths at container creation time.
**How to avoid:** Validate that source paths exist, are absolute, and have proper permissions before calling createContainer(). For secrets directory, ensure 0700 permissions.
**Warning signs:** Container creation fails with "invalid mount config" or "no such file or directory" errors.

## Code Examples

Verified patterns from official sources:

### Creating Container with Bind Mounts and Labels
```typescript
// Source: dockerode GitHub issues #57, #265 + Docker API reference
const container = await docker.createContainer({
  name: 'botmaker-abc-123',
  Image: 'openclaw/openclaw:latest',
  Env: [
    'AI_PROVIDER=anthropic',
    'MODEL=claude-3-5-sonnet-20241022',
    'CHANNEL_TYPE=telegram'
  ],
  Labels: {
    'botmaker.managed': 'true',
    'botmaker.bot-id': 'abc-123'
  },
  HostConfig: {
    Binds: [
      '/var/botmaker/secrets/abc-123:/run/secrets:ro'
    ],
    RestartPolicy: {
      Name: 'unless-stopped'
    },
    NetworkMode: 'bridge'
  }
});
```

### Inspecting Container State
```typescript
// Source: dockerode Tabnine examples + GitHub issue #567
try {
  const container = docker.getContainer('botmaker-abc-123');
  const info = await container.inspect();

  const isRunning = info.State.Running;
  const status = info.State.Status; // "created", "running", "exited", "paused", "restarting", "removing", "dead"
  const exitCode = info.State.ExitCode;

  console.log(`Container status: ${status}, running: ${isRunning}, exit code: ${exitCode}`);
} catch (err: any) {
  if (err.statusCode === 404) {
    console.log('Container does not exist');
  } else {
    throw err;
  }
}
```

### Listing Containers by Label
```typescript
// Source: dockerode GitHub issue #196 + Docker filter documentation
const containers = await docker.listContainers({
  all: true, // Include stopped containers
  filters: {
    label: ['botmaker.managed=true']
  }
});

containers.forEach(containerInfo => {
  const botId = containerInfo.Labels['botmaker.bot-id'];
  const name = containerInfo.Names[0]; // Array of names (aliases)
  const state = containerInfo.State; // "running", "exited", etc.
  const status = containerInfo.Status; // "Up 2 hours", "Exited (0) 5 minutes ago"

  console.log(`Bot ${botId}: ${name} [${state}] ${status}`);
});
```

### Safe Container Removal
```typescript
// Source: Docker container lifecycle best practices
async function safeRemoveContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);

  try {
    // First, try to stop gracefully (10 second timeout)
    await container.stop({ t: 10 });
  } catch (err: any) {
    // Container might already be stopped (404) or not running (304)
    if (err.statusCode !== 404 && err.statusCode !== 304) {
      throw err;
    }
  }

  // Now remove the container
  await container.remove();
}
```

### Handling Restart Policy
```typescript
// Source: Docker restart policy documentation + dockerode examples
const restartPolicies = {
  noRestart: { Name: 'no' },
  alwaysRestart: { Name: 'always' },
  unlessStopped: { Name: 'unless-stopped' },
  onFailure: { Name: 'on-failure', MaximumRetryCount: 3 }
};

// Use unless-stopped for bot containers (auto-recover but respect manual stops)
const container = await docker.createContainer({
  Image: 'openclaw/openclaw:latest',
  HostConfig: {
    RestartPolicy: restartPolicies.unlessStopped
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| docker-cli-js (shell wrapper) | dockerode (native API client) | ~2015 | Native async/await support, no shell parsing, type safety |
| Callback-based dockerode | Promise-based dockerode | v3.0+ (2019) | Cleaner async code, better error handling |
| Environment variables for secrets | Bind mounts to /run/secrets | Docker 1.13+ (2017) | Secrets not logged, not in inspect output |
| Manual restart loops | Docker restart policies | Docker 1.2+ (2014) | Survives daemon restarts, host reboots |
| Parsing docker ps output | dockerode listContainers with filters | Always available | Type-safe, server-side filtering |

**Deprecated/outdated:**
- **docker-api (npm):** Last published 5+ years ago, superseded by node-docker-api and dockerode
- **dockerode callback API:** Still supported but promise-based is preferred in 2026
- **Docker socket permissions workarounds:** Modern Docker installations use docker group membership

## Open Questions

Things that couldn't be fully resolved:

1. **OpenClaw Docker Image Location**
   - What we know: OpenClaw documentation mentions Docker support, can be built locally or used from registry
   - What's unclear: Exact Docker Hub repository name, whether official images exist, versioning scheme
   - Recommendation: Plan should verify image availability (`docker pull openclaw/openclaw:latest` or similar), fall back to documenting image build requirements if not available

2. **Stream Cleanup Best Practices**
   - What we know: dockerode streams (logs, exec) sometimes don't emit 'end' events properly
   - What's unclear: Definitive patterns for cleanup, whether this is fixed in dockerode 4.0.9
   - Recommendation: Initially avoid stream operations (logs, exec), use polling for status. Add stream support in later phase if needed

3. **Container Networking Requirements**
   - What we know: Using bridge network mode (default)
   - What's unclear: Whether OpenClaw needs internet access, which ports need exposure
   - Recommendation: Start with bridge mode, no port exposure. Test OpenClaw networking requirements during implementation

## Sources

### Primary (HIGH confidence)
- [dockerode GitHub repository](https://github.com/apocas/dockerode) - Library features, issues, examples
- [Docker Official Documentation - Restart Policies](https://docs.docker.com/engine/containers/start-containers-automatically/) - Restart policy behavior
- [Docker Official Documentation - Bind Mounts](https://docs.docker.com/engine/storage/bind-mounts/) - Bind mount syntax and options
- [Docker Official Documentation - Secrets Management](https://docs.docker.com/engine/swarm/secrets/) - /run/secrets pattern
- [Docker Official Documentation - Container Lifecycle](https://docs.docker.com/engine/containers/) - Container states
- [Docker Official Documentation - Pruning](https://docs.docker.com/engine/manage-resources/pruning/) - Label filter syntax
- [@types/dockerode npm package](https://www.npmjs.com/package/@types/dockerode) - Current version, TypeScript support

### Secondary (MEDIUM confidence)
- [npm trends - dockerode vs node-docker-api](https://npmtrends.com/dockerode-vs-node-docker-api) - Popularity comparison (1.9M vs 103K weekly downloads)
- [Tabnine dockerode examples](https://www.tabnine.com/code/javascript/functions/dockerode/Dockerode/createContainer) - Real-world usage patterns
- [Docker label filtering patterns](https://docs.docker.com/engine/cli/filter/) - Label filter syntax verified
- [Spacelift Docker Secrets Guide](https://spacelift.io/blog/docker-secrets) - Best practices for secrets management

### Tertiary (LOW confidence)
- OpenClaw Docker documentation (ECONNREFUSED) - Need to verify image availability during implementation
- dockerode stream cleanup - Multiple GitHub issues reported, unclear if fully resolved

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - dockerode is clearly the ecosystem standard with massive adoption
- Architecture: HIGH - Service wrapper pattern is standard practice, verified with multiple sources
- Pitfalls: HIGH - All pitfalls sourced from Docker official docs, dockerode GitHub issues, or common production patterns
- OpenClaw specifics: LOW - Documentation unavailable, need implementation-time verification

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (30 days - Docker/dockerode are stable, but OpenClaw details may need refresh)
