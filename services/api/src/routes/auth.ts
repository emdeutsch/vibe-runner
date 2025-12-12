/**
 * Authentication routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { userDb, deviceDb } from '../db.js';
import { generateToken, requireAuth, generateOAuthState } from '../middleware/auth.js';
import { getConfig } from '../config.js';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getAuthenticatedUser,
  type GitHubOAuthConfig,
} from '@viberunner/github';

const router = Router();

// Store OAuth states temporarily (use Redis in production)
const oauthStates = new Map<string, { userId?: string; expiresAt: number }>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (data.expiresAt < now) {
      oauthStates.delete(state);
    }
  }
}, 60000);

/**
 * Register a new user (simple email-based for MVP)
 */
const registerSchema = z.object({
  email: z.string().email(),
  deviceName: z.string().min(1).max(100),
});

router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);

    // Create user
    const user = userDb.create({
      email: body.email,
    });

    // Create device
    const device = deviceDb.create({
      userId: user.id,
      name: body.deviceName,
      platform: 'ios',
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      deviceId: device.id,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
      },
      device: {
        id: device.id,
        name: device.name,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * Get current user info
 */
router.get('/me', requireAuth, (req, res) => {
  const user = userDb.findById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    githubUsername: user.githubUsername,
    githubConnected: !!user.githubUserId,
  });
});

/**
 * Start GitHub OAuth flow
 */
router.get('/github', requireAuth, (req, res) => {
  const config = getConfig();
  const state = generateOAuthState();

  // Store state with user ID
  oauthStates.set(state, {
    userId: req.user!.id,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  const oauthConfig: GitHubOAuthConfig = {
    clientId: config.github.clientId,
    clientSecret: config.github.clientSecret,
    redirectUri: config.github.redirectUri,
  };

  const authUrl = getAuthorizationUrl(oauthConfig, state);
  res.json({ url: authUrl });
});

/**
 * GitHub OAuth callback
 */
router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;

  if (typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).json({ error: 'Missing code or state' });
    return;
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.expiresAt < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired state' });
    return;
  }

  oauthStates.delete(state);

  try {
    const config = getConfig();
    const oauthConfig: GitHubOAuthConfig = {
      clientId: config.github.clientId,
      clientSecret: config.github.clientSecret,
      redirectUri: config.github.redirectUri,
    };

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(oauthConfig, code);

    // Get GitHub user info
    const githubUser = await getAuthenticatedUser(tokens.accessToken);

    // Link GitHub to user account
    if (stateData.userId) {
      userDb.linkGithub(
        stateData.userId,
        githubUser.id,
        githubUser.login,
        tokens.accessToken
      );
    }

    // Redirect back to app with success
    res.redirect(`${config.clientUrl}github-connected?success=true`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    const config = getConfig();
    res.redirect(`${config.clientUrl}github-connected?error=oauth_failed`);
  }
});

/**
 * Disconnect GitHub
 */
router.delete('/github', requireAuth, (req, res) => {
  const user = userDb.findById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  userDb.update(user.id, {
    githubUserId: undefined,
    githubUsername: undefined,
    githubAccessToken: undefined,
  });

  res.json({ success: true });
});

export default router;
