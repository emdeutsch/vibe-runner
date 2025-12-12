/**
 * GitHub OAuth utilities
 */

import type { GitHubTokens, GitHubUser } from './types.js';
import { Octokit } from '@octokit/rest';

/** Required OAuth scopes for VibeRunner */
export const REQUIRED_SCOPES = ['repo', 'read:user', 'user:email'];

/** GitHub OAuth configuration */
export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Generate the GitHub OAuth authorization URL
 */
export function getAuthorizationUrl(
  config: GitHubOAuthConfig,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: REQUIRED_SCOPES.join(' '),
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForTokens(
  config: GitHubOAuthConfig,
  code: string
): Promise<GitHubTokens> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub OAuth error: ${response.status}`);
  }

  const data = await response.json() as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token!,
    tokenType: data.token_type || 'bearer',
    scope: data.scope || '',
  };
}

/**
 * Get the authenticated GitHub user's info
 */
export async function getAuthenticatedUser(
  accessToken: string
): Promise<GitHubUser> {
  const octokit = new Octokit({ auth: accessToken });

  const [userResponse, emailsResponse] = await Promise.all([
    octokit.users.getAuthenticated(),
    octokit.users.listEmailsForAuthenticatedUser(),
  ]);

  const primaryEmail = emailsResponse.data.find((e) => e.primary)?.email || null;

  return {
    id: userResponse.data.id,
    login: userResponse.data.login,
    email: primaryEmail,
    name: userResponse.data.name,
    avatarUrl: userResponse.data.avatar_url,
  };
}

/**
 * Verify that an access token is still valid
 */
export async function verifyToken(accessToken: string): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: accessToken });
    await octokit.users.getAuthenticated();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if token has required scopes
 */
export async function hasRequiredScopes(accessToken: string): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: accessToken });
    const response = await octokit.users.getAuthenticated();

    // GitHub returns scopes in x-oauth-scopes header
    const scopesHeader = response.headers['x-oauth-scopes'];
    if (!scopesHeader) return false;

    const scopes = scopesHeader.split(',').map((s) => s.trim());
    return REQUIRED_SCOPES.every((required) => scopes.includes(required));
  } catch {
    return false;
  }
}
