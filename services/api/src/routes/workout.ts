/**
 * Workout and HR routes - session management and HR ingestion
 */

import { Hono } from 'hono';
import { prisma } from '@viberunner/db';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import type {
  StartWorkoutRequest,
  StartWorkoutResponse,
  IngestHrSampleRequest,
  HrStatusResponse,
} from '@viberunner/shared';

const workout = new Hono();

// Apply auth to all routes
workout.use('*', authMiddleware);

// Start a workout session
workout.post('/start', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<StartWorkoutRequest>().catch(() => ({}));

  // End any existing active sessions
  await prisma.workoutSession.updateMany({
    where: { userId, active: true },
    data: { active: false, endedAt: new Date() },
  });

  // Create new session
  const session = await prisma.workoutSession.create({
    data: {
      userId,
      source: body.source || 'watch',
      active: true,
    },
  });

  const response: StartWorkoutResponse = {
    session_id: session.id,
    started_at: session.startedAt.toISOString(),
  };

  return c.json(response, 201);
});

// Stop the active workout session
workout.post('/stop', async (c) => {
  const userId = c.get('userId');

  const result = await prisma.workoutSession.updateMany({
    where: { userId, active: true },
    data: { active: false, endedAt: new Date() },
  });

  if (result.count === 0) {
    return c.json({ error: 'No active workout session' }, 404);
  }

  // Expire HR status
  await prisma.hrStatus.updateMany({
    where: { userId },
    data: {
      hrOk: false,
      expiresAt: new Date(),
    },
  });

  return c.json({ stopped: true, sessions_ended: result.count });
});

// Get active workout session
workout.get('/active', async (c) => {
  const userId = c.get('userId');

  const session = await prisma.workoutSession.findFirst({
    where: { userId, active: true },
    orderBy: { startedAt: 'desc' },
  });

  if (!session) {
    return c.json({ active: false });
  }

  return c.json({
    active: true,
    session_id: session.id,
    started_at: session.startedAt.toISOString(),
    source: session.source,
  });
});

// Ingest HR sample from device
workout.post('/hr', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<IngestHrSampleRequest>();

  // Validate BPM
  if (typeof body.bpm !== 'number' || body.bpm < 30 || body.bpm > 250) {
    return c.json({ error: 'bpm must be between 30 and 250' }, 400);
  }

  // Verify session exists and belongs to user
  const session = await prisma.workoutSession.findFirst({
    where: {
      id: body.session_id,
      userId,
      active: true,
    },
  });

  if (!session) {
    return c.json({ error: 'Invalid or inactive session' }, 404);
  }

  // Get user's threshold
  const profile = await prisma.profile.findUnique({
    where: { userId },
  });

  const threshold = profile?.hrThresholdBpm ?? config.defaultHrThreshold;
  const ts = body.ts ? new Date(body.ts) : new Date();
  const expiresAt = new Date(Date.now() + config.hrTtlSeconds * 1000);
  const hrOk = body.bpm >= threshold;

  // Create HR sample
  await prisma.hrSample.create({
    data: {
      userId,
      sessionId: body.session_id,
      bpm: body.bpm,
      ts,
      source: body.source || session.source,
    },
  });

  // Update HR status (upsert)
  await prisma.hrStatus.upsert({
    where: { userId },
    update: {
      bpm: body.bpm,
      thresholdBpm: threshold,
      hrOk,
      expiresAt,
    },
    create: {
      userId,
      bpm: body.bpm,
      thresholdBpm: threshold,
      hrOk,
      expiresAt,
    },
  });

  const response: HrStatusResponse = {
    bpm: body.bpm,
    threshold_bpm: threshold,
    hr_ok: hrOk,
    expires_at: expiresAt.toISOString(),
    tools_unlocked: hrOk,
  };

  return c.json(response);
});

// Get current HR status
workout.get('/status', async (c) => {
  const userId = c.get('userId');

  const status = await prisma.hrStatus.findUnique({
    where: { userId },
  });

  if (!status) {
    return c.json({
      bpm: 0,
      threshold_bpm: config.defaultHrThreshold,
      hr_ok: false,
      expires_at: new Date().toISOString(),
      tools_unlocked: false,
    } satisfies HrStatusResponse);
  }

  // Check if expired
  const isExpired = status.expiresAt <= new Date();
  const hrOk = !isExpired && status.hrOk;

  const response: HrStatusResponse = {
    bpm: status.bpm,
    threshold_bpm: status.thresholdBpm,
    hr_ok: hrOk,
    expires_at: status.expiresAt.toISOString(),
    tools_unlocked: hrOk,
  };

  return c.json(response);
});

// Get recent HR samples
workout.get('/history', async (c) => {
  const userId = c.get('userId');
  const limit = parseInt(c.req.query('limit') || '100', 10);

  const samples = await prisma.hrSample.findMany({
    where: { userId },
    orderBy: { ts: 'desc' },
    take: Math.min(limit, 1000),
  });

  return c.json({
    samples: samples.map((s) => ({
      bpm: s.bpm,
      ts: s.ts.toISOString(),
      source: s.source,
    })),
  });
});

export { workout };
