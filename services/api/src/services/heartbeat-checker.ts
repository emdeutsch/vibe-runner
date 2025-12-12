/**
 * Heartbeat checker service - implements fail-closed behavior
 *
 * Periodically checks for stale heartbeats and blocks writes
 * for any sessions that haven't reported in.
 */

import { getConfig } from '../config.js';
import { userDb, deviceDb, repoDb, sessionDb, getActiveSessionsForHeartbeatCheck } from '../db.js';
import { createRulesetManager } from '@viberunner/github';

let checkInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the heartbeat checker
 */
export function startHeartbeatChecker(): void {
  if (checkInterval) return;

  const config = getConfig();
  console.log(
    `Starting heartbeat checker (timeout: ${config.heartbeat.timeoutMs}ms, interval: ${config.heartbeat.checkIntervalMs}ms)`
  );

  checkInterval = setInterval(
    checkStaleHeartbeats,
    config.heartbeat.checkIntervalMs
  );
}

/**
 * Stop the heartbeat checker
 */
export function stopHeartbeatChecker(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

/**
 * Check for stale heartbeats and enforce fail-closed
 */
async function checkStaleHeartbeats(): Promise<void> {
  const config = getConfig();
  const now = Date.now();
  const sessions = getActiveSessionsForHeartbeatCheck();

  for (const session of sessions) {
    const isStale = now - session.lastHeartbeat > config.heartbeat.timeoutMs;

    // Only take action if session was unlocked and is now stale
    if (isStale && session.currentState === 'RUNNING_UNLOCKED') {
      console.log(
        `Session ${session.id} heartbeat stale, enforcing fail-closed`
      );

      // Update session state
      sessionDb.update(session.id, {
        currentState: 'RUNNING_LOCKED',
        lastHeartbeat: session.lastHeartbeat, // Keep original
      });

      // Update device state
      deviceDb.updateHeartbeat(session.deviceId, 'RUNNING_LOCKED');

      // Block GitHub writes
      await blockUserWrites(session.userId);
    }
  }
}

/**
 * Block writes for all of a user's gated repositories
 */
async function blockUserWrites(userId: string): Promise<void> {
  const user = userDb.findById(userId);
  if (!user?.githubAccessToken) return;

  const repos = repoDb.findByUserId(userId);
  if (repos.length === 0) return;

  const manager = createRulesetManager(user.githubAccessToken);

  await Promise.all(
    repos.map(async (repo) => {
      if (!repo.rulesetId || !repo.gatingEnabled) return;

      try {
        await manager.blockWrites(repo.owner, repo.name, repo.rulesetId);
        console.log(`Blocked writes for ${repo.fullName} (fail-closed)`);
      } catch (error) {
        console.error(`Failed to block writes for ${repo.fullName}:`, error);
      }
    })
  );
}
