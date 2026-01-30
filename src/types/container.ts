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
  state: string;
  status: string; // Human-readable like "Up 2 hours"
}

/** Configuration for creating a new container */
export interface ContainerConfig {
  image: string;
  environment: string[];
}
