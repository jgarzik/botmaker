/**
 * Docker Service
 *
 * Container lifecycle management for BotMaker.
 * Wraps dockerode with domain-specific error handling and labeling.
 */

import Docker from 'dockerode';
import type { ContainerStatus, ContainerInfo, ContainerConfig, ContainerStats } from '../types/container.js';
import { wrapDockerError } from './docker-errors.js';

/** Label used to identify BotMaker-managed containers */
const LABEL_MANAGED = 'botmaker.managed';
const LABEL_BOT_ID = 'botmaker.bot-id';
const LABEL_BOT_HOSTNAME = 'botmaker.bot-hostname';

/**
 * Docker container lifecycle management service.
 * All containers are labeled for filtering and use bind-mounted secrets.
 */
export class DockerService {
  private docker: Docker;

  constructor() {
    // Uses /var/run/docker.sock by default
    this.docker = new Docker();
  }

  /**
   * Creates a new container for a bot.
   *
   * @param hostname - Hostname of the bot (used for container name)
   * @param botId - UUID of the bot (internal, passed as label)
   * @param config - Container configuration
   * @returns Container ID
   */
  async createContainer(hostname: string, botId: string, config: ContainerConfig): Promise<string> {
    const containerName = `botmaker-${hostname}`;

    try {
      const container = await this.docker.createContainer({
        name: containerName,
        Image: config.image,
        Cmd: ['node', 'dist/index.js', 'gateway'],
        Env: [
          ...config.environment,
          `OPENCLAW_STATE_DIR=/app/botdata`,
          `OPENCLAW_GATEWAY_TOKEN=${config.gatewayToken}`,
        ],
        ExposedPorts: {
          [`${config.port}/tcp`]: {}
        },
        Labels: {
          [LABEL_MANAGED]: 'true',
          [LABEL_BOT_ID]: botId,
          [LABEL_BOT_HOSTNAME]: hostname
        },
        Healthcheck: {
          Test: ['CMD', 'curl', '-sf', `http://localhost:${config.port}/`],
          Interval: 2_000_000_000,  // 2s in nanoseconds
          Timeout: 3_000_000_000,   // 3s in nanoseconds
          Retries: 30,
          StartPeriod: 5_000_000_000,  // 5s in nanoseconds
        },
        HostConfig: {
          Binds: [
            `${config.hostSecretsPath}:/run/secrets:ro`,
            `${config.hostWorkspacePath}:/app/botdata:rw`,
            `${config.hostSandboxPath}:/app/workspace:rw`
          ],
          PortBindings: {
            [`${config.port}/tcp`]: [{ HostPort: String(config.port) }]
          },
          RestartPolicy: {
            Name: 'unless-stopped'
          },
          NetworkMode: config.networkName ?? 'bridge'
        }
      });

      return container.id;
    } catch (err) {
      throw wrapDockerError(err, botId);
    }
  }

  /**
   * Starts a container for a bot.
   *
   * @param hostname - Hostname of the bot
   */
  async startContainer(hostname: string): Promise<void> {
    const containerName = `botmaker-${hostname}`;

    try {
      const container = this.docker.getContainer(containerName);
      await container.start();
    } catch (err) {
      const dockerErr = err as { statusCode?: number };

      // 304 = container already running, that's OK
      if (dockerErr.statusCode === 304) {
        return;
      }

      throw wrapDockerError(err, hostname);
    }
  }

  /**
   * Stops a container for a bot.
   *
   * @param hostname - Hostname of the bot
   * @param timeout - Seconds to wait before killing (default: 10)
   */
  async stopContainer(hostname: string, timeout = 10): Promise<void> {
    const containerName = `botmaker-${hostname}`;

    try {
      const container = this.docker.getContainer(containerName);
      await container.stop({ t: timeout });
    } catch (err) {
      const dockerErr = err as { statusCode?: number };

      // 304 = container already stopped, that's OK
      if (dockerErr.statusCode === 304) {
        return;
      }

      throw wrapDockerError(err, hostname);
    }
  }

  /**
   * Restarts a container for a bot.
   *
   * @param hostname - Hostname of the bot
   */
  async restartContainer(hostname: string): Promise<void> {
    const containerName = `botmaker-${hostname}`;

    try {
      const container = this.docker.getContainer(containerName);
      await container.restart();
    } catch (err) {
      throw wrapDockerError(err, hostname);
    }
  }

  /**
   * Removes a container for a bot.
   * Stops the container first if running.
   *
   * @param hostname - Hostname of the bot
   */
  async removeContainer(hostname: string): Promise<void> {
    const containerName = `botmaker-${hostname}`;

    try {
      const container = this.docker.getContainer(containerName);

      // Try to stop first (ignore if already stopped or doesn't exist)
      try {
        await container.stop({ t: 10 });
      } catch (stopErr) {
        const dockerErr = stopErr as { statusCode?: number };
        // 304 = already stopped, 404 = doesn't exist
        if (dockerErr.statusCode !== 304 && dockerErr.statusCode !== 404) {
          throw stopErr;
        }
      }

      await container.remove();
    } catch (err) {
      throw wrapDockerError(err, hostname);
    }
  }

  /**
   * Gets the status of a container for a bot.
   *
   * @param hostname - Hostname of the bot
   * @returns Container status or null if not found
   */
  async getContainerStatus(hostname: string): Promise<ContainerStatus | null> {
    const containerName = `botmaker-${hostname}`;

    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();

      // Extract health status from Docker's Health field
      const healthState = info.State.Health?.Status;
      let health: ContainerStatus['health'] = 'none';
      if (healthState === 'starting') health = 'starting';
      else if (healthState === 'healthy') health = 'healthy';
      else if (healthState === 'unhealthy') health = 'unhealthy';

      return {
        id: info.Id,
        state: info.State.Status as ContainerStatus['state'],
        running: info.State.Running,
        exitCode: info.State.ExitCode,
        startedAt: info.State.StartedAt,
        finishedAt: info.State.FinishedAt,
        health
      };
    } catch (err) {
      const dockerErr = err as { statusCode?: number };

      // 404 = container doesn't exist
      if (dockerErr.statusCode === 404) {
        return null;
      }

      throw wrapDockerError(err, hostname);
    }
  }

  /**
   * Lists all BotMaker-managed containers.
   *
   * @returns Array of container info
   */
  async listManagedContainers(): Promise<ContainerInfo[]> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: {
        label: [`${LABEL_MANAGED}=true`]
      }
    });

    return containers.map(c => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') ?? '',
      botId: c.Labels[LABEL_BOT_ID] ?? '',
      hostname: c.Labels[LABEL_BOT_HOSTNAME] ?? '',
      state: c.State,
      status: c.Status
    }));
  }

  /**
   * Gets the host mountpoint for a Docker volume.
   *
   * @param volumeName - Name of the Docker volume
   * @returns Host path where the volume is mounted
   */
  async getVolumeMountpoint(volumeName: string): Promise<string> {
    const volume = this.docker.getVolume(volumeName);
    const info = await volume.inspect();
    return info.Mountpoint;
  }

  /**
   * Gets resource statistics for a container.
   *
   * @param hostname - Hostname of the bot
   * @returns Container stats or null if not found/not running
   */
  async getContainerStats(hostname: string): Promise<ContainerStats | null> {
    const containerName = `botmaker-${hostname}`;

    try {
      const container = this.docker.getContainer(containerName);
      const stats = await container.stats({ stream: false });

      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuCount = stats.cpu_stats.online_cpus || 1;
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0;

      // Memory stats
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;
      const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

      // Network stats (aggregate all interfaces)
      let networkRxBytes = 0;
      let networkTxBytes = 0;
      const networks = stats.networks as Record<string, { rx_bytes: number; tx_bytes: number }> | undefined;
      for (const iface of Object.values(networks ?? {})) {
        networkRxBytes += (iface as { rx_bytes: number }).rx_bytes || 0;
        networkTxBytes += (iface as { tx_bytes: number }).tx_bytes || 0;
      }

      return {
        hostname,
        name: containerName,
        cpuPercent: Math.round(cpuPercent * 100) / 100,
        memoryUsage,
        memoryLimit,
        memoryPercent: Math.round(memoryPercent * 100) / 100,
        networkRxBytes,
        networkTxBytes,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const dockerErr = err as { statusCode?: number };

      // 404 = container doesn't exist, 409 = container not running
      if (dockerErr.statusCode === 404 || dockerErr.statusCode === 409) {
        return null;
      }

      throw wrapDockerError(err, hostname);
    }
  }

  /**
   * Gets resource statistics for all running BotMaker containers.
   *
   * @returns Array of container stats
   */
  async getAllContainerStats(): Promise<ContainerStats[]> {
    const containers = await this.listManagedContainers();
    const runningContainers = containers.filter(c => c.state === 'running');

    const stats = await Promise.all(
      runningContainers.map(async (container) => {
        try {
          return await this.getContainerStats(container.hostname);
        } catch {
          return null;
        }
      })
    );

    return stats.filter((s): s is ContainerStats => s !== null);
  }
}

export default DockerService;
