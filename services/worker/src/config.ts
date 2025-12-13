/**
 * Worker configuration from environment variables
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const config = {
  // Worker settings
  pollIntervalMs: parseInt(optionalEnv('POLL_INTERVAL_MS', '5000'), 10), // 5 seconds
  hrStaleThresholdSeconds: parseInt(optionalEnv('HR_STALE_THRESHOLD_SECONDS', '30'), 10),

  // GitHub App (for pushing refs)
  githubAppId: requireEnv('GITHUB_APP_ID'),
  githubAppPrivateKey: requireEnv('GITHUB_APP_PRIVATE_KEY'),

  // Viberunner signing keys (Ed25519)
  signerPrivateKey: requireEnv('SIGNER_PRIVATE_KEY'),
  signerPublicKey: requireEnv('SIGNER_PUBLIC_KEY'),

  // HR settings
  hrTtlSeconds: parseInt(optionalEnv('HR_TTL_SECONDS', '15'), 10),
};

export type Config = typeof config;
