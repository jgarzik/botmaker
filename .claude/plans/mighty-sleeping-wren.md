# Plan: Cached Build Environment for Bot Containers

## Problem
Bots need a full development environment but we want instant startup (no per-bot build step).

## Solution
Create `botmaker-runtime:latest` image extending `openclaw:latest` with pre-installed packages. All tools cached in Docker layers.

## Architecture
```
openclaw:latest (base)
       ↓
botmaker-runtime:latest (+ build tools)
       ↓
Bot containers (config via volumes/env)
```

## Files to Create

### 1. `bot-image/Dockerfile`
```dockerfile
ARG BASE_IMAGE=openclaw:latest
FROM ${BASE_IMAGE}

# System packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git ca-certificates curl \
    pkg-config cmake ninja-build \
    gdb strace \
    python3 python3-venv python3-pip python3-dev \
    libssl-dev libffi-dev \
    zlib1g-dev libbz2-dev liblzma-dev libreadline-dev libsqlite3-dev \
    jq ripgrep fd-find less \
    unzip zip xz-utils \
    procps lsof \
    iproute2 netcat-openbsd dnsutils \
 && rm -rf /var/lib/apt/lists/*

# Rust (installed to /usr/local for all users)
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path

# Go
ENV GOROOT=/usr/local/go \
    GOPATH=/go \
    PATH=/usr/local/go/bin:/go/bin:$PATH
RUN curl -fsSL https://go.dev/dl/go1.23.6.linux-amd64.tar.gz | tar -C /usr/local -xzf -

LABEL botmaker.build-env="cached"
```

### 2. `scripts/build-bot-runtime.sh`
```bash
#!/bin/bash
set -e
cd "$(dirname "$0")/.."
BASE_IMAGE="${1:-openclaw:latest}"
docker build --build-arg BASE_IMAGE="$BASE_IMAGE" -t botmaker-runtime:latest ./bot-image
```

## Files to Modify

### 3. `docker-compose.yml`
Add build service (profile=build, won't auto-start):
```yaml
bot-runtime:
  build:
    context: ./bot-image
    args:
      BASE_IMAGE: ${OPENCLAW_BASE_IMAGE:-openclaw:latest}
  image: botmaker-runtime:latest
  profiles:
    - build
```

Change botmaker OPENCLAW_IMAGE default:
```yaml
- OPENCLAW_IMAGE=${OPENCLAW_IMAGE:-botmaker-runtime:latest}
```

### 4. `README.md`
Add section on building the bot runtime image.

## No Changes Needed
- `src/config.ts` - already reads OPENCLAW_IMAGE
- `src/services/DockerService.ts` - already uses configured image

## Build Workflow
```bash
# One-time (or when openclaw updates)
./scripts/build-bot-runtime.sh

# Verify
docker images botmaker-runtime
```

## Verification
1. Build: `./scripts/build-bot-runtime.sh`
2. Rebuild botmaker: `docker compose build botmaker`
3. Restart: `docker compose up -d`
4. Create new bot via UI
5. Exec into bot: `docker exec -it botmaker-<hostname> bash`
6. Verify tools: `gcc --version && python3 --version && rustc --version && go version && rg --version`
