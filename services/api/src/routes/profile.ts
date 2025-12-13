/**
 * Profile routes - user settings including HR threshold
 */

import { Hono } from 'hono';
import { prisma } from '@viberunner/db';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import type { UpdateThresholdRequest, ProfileResponse } from '@viberunner/shared';

const profile = new Hono();

// Apply auth to all routes
profile.use('*', authMiddleware);

// Get current profile
profile.get('/', async (c) => {
  const userId = c.get('userId');

  // Find or create profile
  let profileData = await prisma.profile.findUnique({
    where: { userId },
    include: {
      githubAccount: true,
    },
  });

  if (!profileData) {
    profileData = await prisma.profile.create({
      data: {
        userId,
        hrThresholdBpm: config.defaultHrThreshold,
      },
      include: {
        githubAccount: true,
      },
    });
  }

  const response: ProfileResponse = {
    user_id: profileData.userId,
    hr_threshold_bpm: profileData.hrThresholdBpm,
    github_connected: !!profileData.githubAccount,
    github_username: profileData.githubAccount?.username,
  };

  return c.json(response);
});

// Update threshold
profile.patch('/threshold', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<UpdateThresholdRequest>();

  if (typeof body.hr_threshold_bpm !== 'number' || body.hr_threshold_bpm < 50 || body.hr_threshold_bpm > 220) {
    return c.json({ error: 'hr_threshold_bpm must be between 50 and 220' }, 400);
  }

  // Upsert profile
  const profileData = await prisma.profile.upsert({
    where: { userId },
    update: { hrThresholdBpm: body.hr_threshold_bpm },
    create: {
      userId,
      hrThresholdBpm: body.hr_threshold_bpm,
    },
  });

  return c.json({
    hr_threshold_bpm: profileData.hrThresholdBpm,
    updated_at: profileData.updatedAt.toISOString(),
  });
});

export { profile };
