/**
 * GitHub Ruleset management for write gating
 *
 * Creates and toggles repository rulesets to block/allow pushes
 */

import { Octokit } from '@octokit/rest';
import type {
  GitHubRepository,
  GitHubRuleset,
  CreateRulesetOptions,
  RulesetOperationResult,
} from './types.js';

/** Name for VibeRunner rulesets */
export const VIBERUNNER_RULESET_NAME = 'viberunner-write-gate';

/** Default branch pattern - all branches */
const DEFAULT_BRANCH_PATTERN = '~ALL';

/**
 * GitHub Ruleset Manager
 * Handles creating and toggling rulesets on repositories
 */
export class RulesetManager {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  /**
   * List repositories accessible to the authenticated user
   */
  async listRepositories(): Promise<GitHubRepository[]> {
    const repos: GitHubRepository[] = [];
    let page = 1;

    while (true) {
      const response = await this.octokit.repos.listForAuthenticatedUser({
        per_page: 100,
        page,
        sort: 'updated',
      });

      if (response.data.length === 0) break;

      for (const repo of response.data) {
        // Only include repos where user has admin access (needed for rulesets)
        if (repo.permissions?.admin) {
          repos.push({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            owner: repo.owner.login,
            private: repo.private,
            defaultBranch: repo.default_branch,
          });
        }
      }

      page++;
      if (response.data.length < 100) break;
    }

    return repos;
  }

  /**
   * Get existing VibeRunner ruleset for a repository
   */
  async getExistingRuleset(
    owner: string,
    repo: string
  ): Promise<GitHubRuleset | null> {
    try {
      const response = await this.octokit.repos.getRepoRulesets({
        owner,
        repo,
        per_page: 100,
      });

      const ruleset = response.data.find(
        (r) => r.name === VIBERUNNER_RULESET_NAME
      );

      if (!ruleset) return null;

      return {
        id: ruleset.id,
        name: ruleset.name,
        enforcement: ruleset.enforcement as 'active' | 'disabled' | 'evaluate',
        target: ruleset.target as 'branch' | 'tag',
      };
    } catch (error: unknown) {
      // 404 means no rulesets exist
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create the VibeRunner write-gate ruleset for a repository
   * Starts in DISABLED state (writes allowed)
   */
  async createRuleset(
    options: CreateRulesetOptions
  ): Promise<RulesetOperationResult> {
    const { owner, repo, branchPattern = DEFAULT_BRANCH_PATTERN } = options;

    try {
      // Check if ruleset already exists
      const existing = await this.getExistingRuleset(owner, repo);
      if (existing) {
        return {
          success: true,
          rulesetId: existing.id,
        };
      }

      // Create new ruleset - starts disabled (writes allowed)
      const response = await this.octokit.repos.createRepoRuleset({
        owner,
        repo,
        name: VIBERUNNER_RULESET_NAME,
        enforcement: 'disabled', // Start with writes allowed
        target: 'branch',
        conditions: {
          ref_name: {
            include: [branchPattern === DEFAULT_BRANCH_PATTERN ? 'refs/heads/**' : `refs/heads/${branchPattern}`],
            exclude: [],
          },
        },
        rules: [
          // Block direct pushes (creation and updates)
          { type: 'creation' },
          { type: 'update' },
          { type: 'deletion' },
        ],
      });

      return {
        success: true,
        rulesetId: response.data.id,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Enable the ruleset (BLOCK writes)
   */
  async blockWrites(
    owner: string,
    repo: string,
    rulesetId: number
  ): Promise<RulesetOperationResult> {
    try {
      await this.octokit.repos.updateRepoRuleset({
        owner,
        repo,
        ruleset_id: rulesetId,
        enforcement: 'active',
      });

      return { success: true, rulesetId };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Disable the ruleset (ALLOW writes)
   */
  async allowWrites(
    owner: string,
    repo: string,
    rulesetId: number
  ): Promise<RulesetOperationResult> {
    try {
      await this.octokit.repos.updateRepoRuleset({
        owner,
        repo,
        ruleset_id: rulesetId,
        enforcement: 'disabled',
      });

      return { success: true, rulesetId };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get current ruleset enforcement status
   */
  async getRulesetStatus(
    owner: string,
    repo: string,
    rulesetId: number
  ): Promise<{ enabled: boolean; enforcement: string } | null> {
    try {
      const response = await this.octokit.repos.getRepoRuleset({
        owner,
        repo,
        ruleset_id: rulesetId,
      });

      return {
        enabled: response.data.enforcement === 'active',
        enforcement: response.data.enforcement,
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete the VibeRunner ruleset from a repository
   */
  async deleteRuleset(
    owner: string,
    repo: string,
    rulesetId: number
  ): Promise<RulesetOperationResult> {
    try {
      await this.octokit.repos.deleteRepoRuleset({
        owner,
        repo,
        ruleset_id: rulesetId,
      });

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}

/**
 * Create a RulesetManager instance
 */
export function createRulesetManager(accessToken: string): RulesetManager {
  return new RulesetManager(accessToken);
}
