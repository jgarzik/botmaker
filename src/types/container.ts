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

/** Container status from Docker inspect */
export interface ContainerStatus {
  id: string;
  state: ContainerState;
  running: boolean;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
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
  gatewayToken: string;
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
