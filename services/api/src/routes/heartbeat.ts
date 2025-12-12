/**
 * Heartbeat and run session routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { userDb, deviceDb, repoDb, sessionDb } from '../db.js';
import { createRulesetManager } from '@viberunner/github';
import type { RunState, Heartbeat, HeartbeatResponse } from '@viberunner/shared';

const router = Router();

/**
 * Heartbeat endpoint - called by iOS app every few seconds during a run
 */
const heartbeatSchema = z.object({
  runState: z.enum(['NOT_RUNNING', 'RUNNING_UNLOCKED', 'RUNNING_LOCKED']),
  currentPace: z.number().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const body = heartbeatSchema.parse(req.body);
    const userId = req.user!.id;
    const deviceId = req.deviceId;

    if (!deviceId) {
      res.status(400).json({ error: 'Device ID required' });
      return;
    }

    // Update device heartbeat
    deviceDb.updateHeartbeat(deviceId, body.runState);

    // Update or create session
    let session = sessionDb.findActiveByDeviceId(deviceId);
    const isRunning = body.runState !== 'NOT_RUNNING';

    if (isRunning && !session) {
      // Start new session
      session = sessionDb.create({
        userId,
        deviceId,
        startedAt: Date.now(),
        lastHeartbeat: Date.now(),
        currentState: body.runState,
      });
    } else if (session) {
      if (!isRunning) {
        // End session
        sessionDb.update(session.id, {
          endedAt: Date.now(),
          lastHeartbeat: Date.now(),
          currentState: body.runState,
        });
      } else {
        // Update session
        sessionDb.update(session.id, {
          lastHeartbeat: Date.now(),
          currentState: body.runState,
          averagePace: body.currentPace,
        });
      }
    }

    // Determine if GitHub writes should be enabled
    const githubWritesEnabled = body.runState === 'RUNNING_UNLOCKED';

    // Update GitHub rulesets based on state
    await updateGitHubRulesets(userId, githubWritesEnabled);

    const response: HeartbeatResponse = {
      success: true,
      serverTime: Date.now(),
      stateAcknowledged: body.runState,
      githubWritesEnabled,
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

/**
 * Get current session status
 */
router.get('/status', requireAuth, (req, res) => {
  const deviceId = req.deviceId;

  if (!deviceId) {
    res.status(400).json({ error: 'Device ID required' });
    return;
  }

  const device = deviceDb.findById(deviceId);
  const session = sessionDb.findActiveByDeviceId(deviceId);

  res.json({
    device: device
      ? {
          id: device.id,
          lastHeartbeat: device.lastHeartbeat,
          lastRunState: device.lastRunState,
        }
      : null,
    session: session
      ? {
          id: session.id,
          startedAt: session.startedAt,
          currentState: session.currentState,
          averagePace: session.averagePace,
        }
      : null,
    githubWritesEnabled: device?.lastRunState === 'RUNNING_UNLOCKED',
  });
});

/**
 * Start a run session (alternative to heartbeat for explicit start)
 */
router.post('/start', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const deviceId = req.deviceId;

  if (!deviceId) {
    res.status(400).json({ error: 'Device ID required' });
    return;
  }

  // Check for existing session
  const existingSession = sessionDb.findActiveByDeviceId(deviceId);
  if (existingSession) {
    res.status(409).json({ error: 'Session already active' });
    return;
  }

  const session = sessionDb.create({
    userId,
    deviceId,
    startedAt: Date.now(),
    lastHeartbeat: Date.now(),
    currentState: 'RUNNING_LOCKED', // Start locked
  });

  deviceDb.updateHeartbeat(deviceId, 'RUNNING_LOCKED');

  // Block writes on session start
  await updateGitHubRulesets(userId, false);

  res.status(201).json({
    session: {
      id: session.id,
      startedAt: session.startedAt,
      currentState: session.currentState,
    },
  });
});

/**
 * End a run session
 */
router.post('/end', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const deviceId = req.deviceId;

  if (!deviceId) {
    res.status(400).json({ error: 'Device ID required' });
    return;
  }

  const session = sessionDb.findActiveByDeviceId(deviceId);
  if (!session) {
    res.status(404).json({ error: 'No active session' });
    return;
  }

  sessionDb.update(session.id, {
    endedAt: Date.now(),
    lastHeartbeat: Date.now(),
    currentState: 'NOT_RUNNING',
  });

  deviceDb.updateHeartbeat(deviceId, 'NOT_RUNNING');

  // Block writes when session ends
  await updateGitHubRulesets(userId, false);

  res.json({
    session: {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      duration: Date.now() - session.startedAt,
    },
  });
});

/**
 * Update GitHub rulesets based on current state
 */
async function updateGitHubRulesets(
  userId: string,
  allowWrites: boolean
): Promise<void> {
  const user = userDb.findById(userId);
  if (!user?.githubAccessToken) return;

  const repos = repoDb.findByUserId(userId);
  if (repos.length === 0) return;

  const manager = createRulesetManager(user.githubAccessToken);

  // Update all gated repositories
  await Promise.all(
    repos.map(async (repo) => {
      if (!repo.rulesetId || !repo.gatingEnabled) return;

      try {
        if (allowWrites) {
          await manager.allowWrites(repo.owner, repo.name, repo.rulesetId);
        } else {
          await manager.blockWrites(repo.owner, repo.name, repo.rulesetId);
        }
      } catch (error) {
        console.error(`Failed to update ruleset for ${repo.fullName}:`, error);
      }
    })
  );
}

export default router;
