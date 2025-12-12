/**
 * GitHub-specific types for VibeRunner
 */

/** GitHub repository info */
export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
}

/** GitHub ruleset info */
export interface GitHubRuleset {
  id: number;
  name: string;
  enforcement: 'active' | 'disabled' | 'evaluate';
  target: 'branch' | 'tag';
}

/** Ruleset creation options */
export interface CreateRulesetOptions {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Optional: specific branch pattern (default: all branches) */
  branchPattern?: string;
}

/** Result of ruleset operations */
export interface RulesetOperationResult {
  success: boolean;
  rulesetId?: number;
  error?: string;
}

/** GitHub OAuth tokens */
export interface GitHubTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType: string;
  scope: string;
}

/** GitHub user info from OAuth */
export interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatarUrl: string;
}
