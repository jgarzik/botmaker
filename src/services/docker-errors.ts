/**
 * Docker Error Handling
 *
 * Domain-specific error classes for container operations.
 */

export type ContainerErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'START_FAILED'
  | 'STOP_FAILED'
  | 'NETWORK_ERROR';

/**
 * Error class for container operations.
 * Provides typed error codes for API layer to handle appropriately.
 */
export class ContainerError extends Error {
  readonly name = 'ContainerError';

  constructor(
    public readonly code: ContainerErrorCode,
    message: string,
    public readonly botId: string,
    public readonly cause?: Error
  ) {
    super(message);
  }
}

/**
 * Wraps raw Docker errors with domain-specific error codes.
 *
 * Error code mapping:
 * - 404 -> NOT_FOUND (resource doesn't exist — image or container)
 * - 409 -> ALREADY_EXISTS (container name conflict)
 * - 304 -> ignored (not modified, container already in desired state)
 * - ETIMEDOUT/timeout -> NETWORK_ERROR (Docker daemon unreachable)
 * - default -> START_FAILED (generic failure)
 */
export function wrapDockerError(err: unknown, botId: string): ContainerError {
  const dockerErr = err as { statusCode?: number; code?: string; message?: string };

  // Docker resource not found (image or container)
  if (dockerErr.statusCode === 404) {
    const rawMsg = dockerErr.message ?? '';
    const detail = rawMsg ? `: ${rawMsg}` : '';
    return new ContainerError(
      'NOT_FOUND',
      `Docker resource not found for bot ${botId}${detail}`,
      botId,
      err instanceof Error ? err : undefined
    );
  }

  // Container already exists (name conflict)
  if (dockerErr.statusCode === 409) {
    return new ContainerError(
      'ALREADY_EXISTS',
      `Container for bot ${botId} already exists`,
      botId,
      err instanceof Error ? err : undefined
    );
  }

  // Network/timeout errors
  if (
    dockerErr.code === 'ETIMEDOUT' ||
    dockerErr.message?.includes('timeout')
  ) {
    return new ContainerError(
      'NETWORK_ERROR',
      'Docker daemon connection timeout',
      botId,
      err instanceof Error ? err : undefined
    );
  }

  // Default: generic failure
  return new ContainerError(
    'START_FAILED',
    dockerErr.message ?? 'Unknown Docker error',
    botId,
    err instanceof Error ? err : undefined
  );
}
