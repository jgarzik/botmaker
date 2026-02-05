import type { Bot, BotStatus } from '../types';

/**
 * Derives the effective bot status from database status and live container state.
 * 
 * Uses Docker health check status to determine if a running container is ready:
 * - health='starting' → bot is initializing
 * - health='healthy' → bot is ready
 * - health='unhealthy' → bot has failed health checks
 * - health='none' → legacy container without health check (treat as running)
 */
export function getEffectiveStatus(bot: Bot): BotStatus {
  const containerState = bot.container_status?.state;
  
  if (containerState === 'running') {
    // Use Docker health check status to determine if bot is ready
    const health = bot.container_status?.health;
    if (health === 'starting') {
      return 'starting';
    }
    if (health === 'unhealthy') {
      return 'error';
    }
    // 'healthy' or 'none' (no healthcheck configured) = running
    return 'running';
  }
  
  if (containerState === 'exited' || containerState === 'dead') {
    return bot.container_status?.exitCode === 0 ? 'stopped' : 'error';
  }
  
  // Fallback to database status
  return bot.status;
}
