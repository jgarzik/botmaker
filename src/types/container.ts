/**
 * Container Types
 *
 * Types for Docker container lifecycle management.
 */

/** Docker container state from inspect API */
export type ContainerState =
  | 'created'
  | 'running'
  | 'exited'
  | 'paused'
  | 'restarting'
  | 'removing'
  | 'dead';

/** Docker health check status */
export type HealthStatus = 'none' | 'starting' | 'healthy' | 'unhealthy';

/** Container status from Docker inspect */
export interface ContainerStatus {
  id: string;
  state: ContainerState;
  running: boolean;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
  health: HealthStatus;
}

/** Container info from Docker list (human-readable) */
export interface ContainerInfo {
  id: string;
  name: string;
  botId: string;
  hostname: string;
  state: string;
  status: string; // Human-readable like "Up 2 hours"
}

/** Configuration for creating a new container */
export interface ContainerConfig {
  image: string;
  environment: string[];
  port: number;
  /** Host path for workspace bind mount (Docker daemon perspective) */
  hostWorkspacePath: string;
  /** Host path for secrets bind mount (Docker daemon perspective) */
  hostSecretsPath: string;
  /** Host path for sandbox bind mount (Docker daemon perspective) */
  hostSandboxPath: string;
  gatewayToken: string;
  /** Docker network to join (optional, for proxy connectivity) */
  networkName?: string;
}

/** Container resource statistics */
export interface ContainerStats {
  hostname: string;
  name: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  timestamp: string;
}
