/**
 * API Configuration
 */

import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // JWT
  JWT_SECRET: z.string().min(32),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  GITHUB_REDIRECT_URI: z.string().url(),

  // Client app
  CLIENT_URL: z.string().url().default('viberunner://'),

  // Heartbeat settings
  HEARTBEAT_TIMEOUT_MS: z.string().default('30000'),
  HEARTBEAT_CHECK_INTERVAL_MS: z.string().default('10000'),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.format());

    // In development, provide helpful defaults message
    if (process.env['NODE_ENV'] !== 'production') {
      console.error('\nCreate a .env file with:');
      console.error(`
JWT_SECRET=your-secret-key-at-least-32-chars-long
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback
      `);
    }

    throw new Error('Invalid configuration');
  }

  return {
    port: parseInt(parsed.data.PORT, 10),
    nodeEnv: parsed.data.NODE_ENV,
    jwt: {
      secret: parsed.data.JWT_SECRET,
      expiresIn: '7d',
    },
    github: {
      clientId: parsed.data.GITHUB_CLIENT_ID,
      clientSecret: parsed.data.GITHUB_CLIENT_SECRET,
      redirectUri: parsed.data.GITHUB_REDIRECT_URI,
    },
    clientUrl: parsed.data.CLIENT_URL,
    heartbeat: {
      timeoutMs: parseInt(parsed.data.HEARTBEAT_TIMEOUT_MS, 10),
      checkIntervalMs: parseInt(parsed.data.HEARTBEAT_CHECK_INTERVAL_MS, 10),
    },
  };
}

export type Config = ReturnType<typeof loadConfig>;

// Lazy load config to allow .env to be loaded first
let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
