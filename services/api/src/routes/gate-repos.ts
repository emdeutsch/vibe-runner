/**
 * Gate Repos routes - create and manage HR-gated repositories
 */

import { Hono } from 'hono';
import { prisma } from '@viberunner/db';
import { authMiddleware } from '../middleware/auth.js';
import { decrypt } from '../lib/encryption.js';
import {
  createUserOctokit,
  createRepoFromTemplate,
  createEmptyRepo,
  commitBootstrapFiles,
} from '../lib/github.js';
import { config } from '../config.js';
import { buildSignalRef, PAYLOAD_FILENAME, SIGNAL_REF_PATTERN } from '@viberunner/shared';
import type {
  CreateGateRepoRequest,
  CreateGateRepoResponse,
  GateRepoResponse,
  GateRepoConfig,
} from '@viberunner/shared';

const gateRepos = new Hono();

// Apply auth to all routes
gateRepos.use('*', authMiddleware);

/**
 * Generate bootstrap files for a gate repo
 */
function generateBootstrapFiles(userKey: string, publicKey: string): Array<{ path: string; content: string }> {
  const signalRef = buildSignalRef(userKey);

  // viberunner.config.json
  const configContent: GateRepoConfig = {
    version: 1,
    user_key: userKey,
    signal_ref_pattern: SIGNAL_REF_PATTERN,
    payload_filename: PAYLOAD_FILENAME,
    public_key: publicKey,
    public_key_version: 1,
    ttl_seconds: config.hrTtlSeconds,
  };

  // .claude/settings.json - Claude Code hook configuration
  const claudeSettings = {
    hooks: {
      PreToolUse: [
        {
          matcher: '*',
          hooks: ['./scripts/viberunner-hr-check']
        }
      ]
    }
  };

  // scripts/viberunner-hr-check - The enforcement script
  const hrCheckScript = `#!/usr/bin/env bash
#
# viberunner HR check script
# Verifies HR signal is valid before allowing Claude Code tool execution
#

set -e

CONFIG_FILE="viberunner.config.json"
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Read config
if [[ ! -f "$REPO_ROOT/$CONFIG_FILE" ]]; then
  echo "viberunner: config not found — tools locked" >&2
  exit 2
fi

USER_KEY=$(jq -r '.user_key' "$REPO_ROOT/$CONFIG_FILE")
PUBLIC_KEY=$(jq -r '.public_key' "$REPO_ROOT/$CONFIG_FILE")
TTL_SECONDS=$(jq -r '.ttl_seconds' "$REPO_ROOT/$CONFIG_FILE")
SIGNAL_REF="refs/viberunner/hr/$USER_KEY"

# Fetch the signal ref
if ! git fetch origin "$SIGNAL_REF:refs/viberunner-check/hr-signal" --quiet 2>/dev/null; then
  echo "viberunner: HR signal not found — tools locked" >&2
  exit 2
fi

# Read payload from the ref
PAYLOAD=$(git show refs/viberunner-check/hr-signal:hr-signal.json 2>/dev/null)
if [[ -z "$PAYLOAD" ]]; then
  echo "viberunner: HR payload missing — tools locked" >&2
  exit 2
fi

# Extract fields
V=$(echo "$PAYLOAD" | jq -r '.v')
PAYLOAD_USER_KEY=$(echo "$PAYLOAD" | jq -r '.user_key')
HR_OK=$(echo "$PAYLOAD" | jq -r '.hr_ok')
BPM=$(echo "$PAYLOAD" | jq -r '.bpm')
THRESHOLD_BPM=$(echo "$PAYLOAD" | jq -r '.threshold_bpm')
EXP_UNIX=$(echo "$PAYLOAD" | jq -r '.exp_unix')
NONCE=$(echo "$PAYLOAD" | jq -r '.nonce')
SIG=$(echo "$PAYLOAD" | jq -r '.sig')

# Validate user_key matches
if [[ "$PAYLOAD_USER_KEY" != "$USER_KEY" ]]; then
  echo "viberunner: user_key mismatch — tools locked" >&2
  exit 2
fi

# Check expiration
NOW=$(date +%s)
if [[ "$EXP_UNIX" -le "$NOW" ]]; then
  echo "viberunner: HR signal expired — tools locked" >&2
  exit 2
fi

# Build canonical payload for signature verification
CANONICAL=$(jq -cS '{bpm,exp_unix,hr_ok,nonce,threshold_bpm,user_key,v}' <<< "$PAYLOAD")

# Verify signature using openssl
# Convert hex sig to binary
SIG_BIN=$(mktemp)
echo -n "$SIG" | xxd -r -p > "$SIG_BIN"

# Convert hex public key to raw format for openssl
PUB_KEY_BIN=$(mktemp)
echo -n "$PUBLIC_KEY" | xxd -r -p > "$PUB_KEY_BIN"

# Create PEM formatted public key
PUB_KEY_PEM=$(mktemp)
{
  echo "-----BEGIN PUBLIC KEY-----"
  # Ed25519 public key needs OID prefix: 302a300506032b6570032100
  (echo -n "302a300506032b6570032100"; cat "$PUB_KEY_BIN" | xxd -p -c 32) | xxd -r -p | base64
  echo "-----END PUBLIC KEY-----"
} > "$PUB_KEY_PEM"

# Verify signature
MSG_FILE=$(mktemp)
echo -n "$CANONICAL" > "$MSG_FILE"

if ! openssl pkeyutl -verify -pubin -inkey "$PUB_KEY_PEM" -sigfile "$SIG_BIN" -in "$MSG_FILE" -rawin 2>/dev/null; then
  echo "viberunner: invalid signature — tools locked" >&2
  rm -f "$SIG_BIN" "$PUB_KEY_BIN" "$PUB_KEY_PEM" "$MSG_FILE"
  exit 2
fi

rm -f "$SIG_BIN" "$PUB_KEY_BIN" "$PUB_KEY_PEM" "$MSG_FILE"

# Check hr_ok
if [[ "$HR_OK" != "true" ]]; then
  echo "viberunner: HR $BPM below threshold $THRESHOLD_BPM — tools locked" >&2
  exit 2
fi

# All checks passed - tools unlocked
exit 0
`;

  // CLAUDE.md - Instructions for Claude
  const claudeMd = `# viberunner HR-Gated Repository

This repository is protected by viberunner. Claude Code tool calls (edit, write, bash, etc.) are gated by the user's live heart rate.

## How it works

- You can **chat anytime** without restrictions
- **Tool calls are blocked** unless the user's heart rate is above their configured threshold
- When tools are locked, you'll see: \`viberunner: HR below threshold — tools locked\`

## When tools are locked

Switch to **planning and review mode**:
- Discuss architecture and design decisions
- Review code and suggest improvements
- Plan implementation steps
- Answer questions about the codebase
- **Don't spam tool calls** — wait for the user to get their HR up!

## Configuration

- User key: \`${userKey}\`
- Signal ref: \`${signalRef}\`
- Public key version: 1
`;

  return [
    { path: 'viberunner.config.json', content: JSON.stringify(configContent, null, 2) },
    { path: '.claude/settings.json', content: JSON.stringify(claudeSettings, null, 2) },
    { path: 'scripts/viberunner-hr-check', content: hrCheckScript },
    { path: 'CLAUDE.md', content: claudeMd },
  ];
}

// List gate repos
gateRepos.get('/', async (c) => {
  const userId = c.get('userId');

  const repos = await prisma.gateRepo.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const response: GateRepoResponse[] = repos.map((repo) => ({
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    user_key: repo.userKey,
    signal_ref: repo.signalRef,
    active: repo.active,
    github_app_installed: !!repo.githubAppInstallationId,
    created_at: repo.createdAt.toISOString(),
  }));

  return c.json({ repos: response });
});

// Create a new gate repo
gateRepos.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<CreateGateRepoRequest>();

  if (!body.name || body.name.length < 1) {
    return c.json({ error: 'Repository name is required' }, 400);
  }

  // Get GitHub credentials
  const [githubAccount, githubToken] = await Promise.all([
    prisma.githubAccount.findUnique({ where: { userId } }),
    prisma.githubToken.findUnique({ where: { userId } }),
  ]);

  if (!githubAccount || !githubToken) {
    return c.json({ error: 'GitHub not connected. Please connect GitHub first.' }, 400);
  }

  const accessToken = decrypt(githubToken.encryptedAccessToken);
  const octokit = createUserOctokit(accessToken);
  const userKey = githubAccount.username; // Use GitHub username as user_key
  const signalRef = buildSignalRef(userKey);

  try {
    let repoInfo: { owner: string; name: string; html_url: string };

    // Try template first, fall back to empty repo
    try {
      repoInfo = await createRepoFromTemplate(
        octokit,
        config.templateRepoOwner,
        config.templateRepoName,
        githubAccount.username,
        body.name,
        body.description || 'viberunner HR-gated repository',
        body.private ?? true
      );
    } catch {
      // Template doesn't exist, create empty repo
      repoInfo = await createEmptyRepo(
        octokit,
        body.name,
        body.description || 'viberunner HR-gated repository',
        body.private ?? true
      );

      // Commit bootstrap files
      const files = generateBootstrapFiles(userKey, config.signerPublicKey);
      await commitBootstrapFiles(
        octokit,
        repoInfo.owner,
        repoInfo.name,
        files,
        'Initialize viberunner HR gating'
      );
    }

    // Store gate repo record
    const gateRepo = await prisma.gateRepo.create({
      data: {
        userId,
        owner: repoInfo.owner,
        name: repoInfo.name,
        userKey,
        signalRef,
        active: true,
      },
    });

    const response: CreateGateRepoResponse = {
      id: gateRepo.id,
      owner: repoInfo.owner,
      name: repoInfo.name,
      user_key: userKey,
      signal_ref: signalRef,
      html_url: repoInfo.html_url,
      needs_app_install: true, // User needs to install GitHub App
    };

    return c.json(response, 201);
  } catch (error) {
    console.error('Create gate repo error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to create repository',
    }, 500);
  }
});

// Get single gate repo
gateRepos.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const repo = await prisma.gateRepo.findFirst({
    where: { id, userId },
  });

  if (!repo) {
    return c.json({ error: 'Repository not found' }, 404);
  }

  const response: GateRepoResponse = {
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    user_key: repo.userKey,
    signal_ref: repo.signalRef,
    active: repo.active,
    github_app_installed: !!repo.githubAppInstallationId,
    created_at: repo.createdAt.toISOString(),
  };

  return c.json(response);
});

// Update gate repo (activate/deactivate)
gateRepos.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json<{ active?: boolean }>();

  const repo = await prisma.gateRepo.findFirst({
    where: { id, userId },
  });

  if (!repo) {
    return c.json({ error: 'Repository not found' }, 404);
  }

  const updated = await prisma.gateRepo.update({
    where: { id },
    data: {
      active: body.active ?? repo.active,
    },
  });

  return c.json({
    id: updated.id,
    active: updated.active,
    updated_at: updated.updatedAt.toISOString(),
  });
});

// Delete gate repo record (doesn't delete GitHub repo)
gateRepos.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const repo = await prisma.gateRepo.findFirst({
    where: { id, userId },
  });

  if (!repo) {
    return c.json({ error: 'Repository not found' }, 404);
  }

  await prisma.gateRepo.delete({ where: { id } });

  return c.json({ deleted: true });
});

// GitHub App installation webhook handler
gateRepos.post('/webhook/installation', async (c) => {
  // In production, verify webhook signature
  const payload = await c.req.json<{
    action: string;
    installation: {
      id: number;
      account: { login: string };
    };
    repositories?: Array<{
      id: number;
      name: string;
      full_name: string;
    }>;
  }>();

  if (payload.action === 'created' || payload.action === 'added') {
    const installationId = payload.installation.id;
    const owner = payload.installation.account.login;

    // Update gate repos with this installation
    if (payload.repositories) {
      for (const repo of payload.repositories) {
        await prisma.gateRepo.updateMany({
          where: {
            owner,
            name: repo.name,
          },
          data: {
            githubAppInstallationId: installationId,
          },
        });
      }
    }
  } else if (payload.action === 'removed' || payload.action === 'deleted') {
    // Clear installation ID from affected repos
    await prisma.gateRepo.updateMany({
      where: {
        githubAppInstallationId: payload.installation.id,
      },
      data: {
        githubAppInstallationId: null,
      },
    });
  }

  return c.json({ received: true });
});

// Get GitHub App installation URL
gateRepos.get('/:id/install-url', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const repo = await prisma.gateRepo.findFirst({
    where: { id, userId },
  });

  if (!repo) {
    return c.json({ error: 'Repository not found' }, 404);
  }

  // GitHub App installation URL with repo pre-selected
  const installUrl = `https://github.com/apps/viberunner/installations/new/permissions?target_id=${repo.owner}&suggested_target_id=${repo.owner}&repository_ids[]=${repo.name}`;

  return c.json({
    install_url: installUrl,
    owner: repo.owner,
    name: repo.name,
  });
});

export { gateRepos };
