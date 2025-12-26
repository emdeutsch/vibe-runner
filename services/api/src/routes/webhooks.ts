/**
 * GitHub webhook handlers for tracking commits and pull requests during workouts
 */

import { Hono } from 'hono';
import { timingSafeEqual, createHmac } from 'crypto';
import { config } from '../config.js';
import { prisma } from '@viberunner/db';
import { createInstallationOctokit } from '../lib/github.js';

const webhooks = new Hono();

/**
 * Verify GitHub webhook signature (HMAC-SHA256)
 */
function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected =
    'sha256=' + createHmac('sha256', config.githubWebhookSecret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Extract session ID from text: [vr:UUID]
 */
function extractSessionId(text: string): string | null {
  const match = text.match(/\[vr:([a-f0-9-]{36})\]/i);
  return match ? match[1] : null;
}

/**
 * Handle push events (commits)
 */
async function handlePush(payload: {
  repository?: { owner?: { login?: string; name?: string }; name?: string };
  commits?: Array<{
    id: string;
    message?: string;
    timestamp: string;
  }>;
}): Promise<{ commits: number; files: number }> {
  const repoOwner = payload.repository?.owner?.login || payload.repository?.owner?.name;
  const repoName = payload.repository?.name;
  const commits = payload.commits || [];

  if (!repoOwner || !repoName) {
    console.log('[Webhook] Missing repo info in push event');
    return { commits: 0, files: 0 };
  }

  console.log(`[Webhook] Push to ${repoOwner}/${repoName}: ${commits.length} commits`);

  let commitCount = 0;
  let fileCount = 0;

  // Get installation for fetching commit details
  const gateRepo = await prisma.gateRepo.findFirst({
    where: { owner: repoOwner, name: repoName },
  });

  for (const commit of commits) {
    const sessionId = extractSessionId(commit.message || '');
    if (!sessionId) continue;

    // Verify session exists
    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      console.log(`[Webhook] Session ${sessionId} not found, skipping`);
      continue;
    }

    // Fetch full commit details (includes file stats)
    let linesAdded: number | null = null;
    let linesRemoved: number | null = null;
    let files: Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
    }> = [];

    if (gateRepo?.githubAppInstallationId) {
      try {
        const octokit = await createInstallationOctokit(gateRepo.githubAppInstallationId);
        const { data } = await octokit.rest.repos.getCommit({
          owner: repoOwner,
          repo: repoName,
          ref: commit.id,
        });
        linesAdded = data.stats?.additions ?? null;
        linesRemoved = data.stats?.deletions ?? null;
        files = (data.files || []).map((f) => ({
          filename: f.filename,
          status: f.status || 'modified',
          additions: f.additions || 0,
          deletions: f.deletions || 0,
        }));
      } catch (err) {
        console.error(`[Webhook] Failed to fetch commit details: ${err}`);
      }
    }

    // Upsert commit
    const savedCommit = await prisma.sessionCommit.upsert({
      where: {
        sessionId_commitSha: { sessionId, commitSha: commit.id },
      },
      create: {
        sessionId,
        repoOwner,
        repoName,
        commitSha: commit.id,
        commitMsg: commit.message?.substring(0, 1000) || '',
        linesAdded,
        linesRemoved,
        committedAt: new Date(commit.timestamp),
      },
      update: { linesAdded, linesRemoved },
    });

    // Insert files (delete existing first to handle updates)
    if (files.length > 0) {
      await prisma.sessionCommitFile.deleteMany({
        where: { commitId: savedCommit.id },
      });
      await prisma.sessionCommitFile.createMany({
        data: files.map((f) => ({
          commitId: savedCommit.id,
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
        })),
      });
      fileCount += files.length;
    }

    commitCount++;
    console.log(`[Webhook] Recorded commit ${commit.id.substring(0, 7)} (${files.length} files)`);
  }

  return { commits: commitCount, files: fileCount };
}

/**
 * Handle pull_request events
 */
async function handlePullRequest(payload: {
  action?: string;
  pull_request?: {
    number?: number;
    title?: string;
    body?: string;
    state?: string;
    merged?: boolean;
    html_url?: string;
    created_at?: string;
    merged_at?: string | null;
    additions?: number;
    deletions?: number;
  };
  repository?: { owner?: { login?: string; name?: string }; name?: string };
}): Promise<{ recorded: boolean }> {
  const action = payload.action;
  const pr = payload.pull_request;
  const repo = payload.repository;

  // Only track opened, closed, merged
  if (!action || !['opened', 'closed', 'reopened'].includes(action)) {
    return { recorded: false };
  }

  const repoOwner = repo?.owner?.login || repo?.owner?.name;
  const repoName = repo?.name;
  const prNumber = pr?.number;
  const title = pr?.title || '';
  const body = pr?.body || '';

  if (!repoOwner || !repoName || !prNumber) {
    console.log('[Webhook] Missing PR info');
    return { recorded: false };
  }

  // Extract session ID from PR title or body
  const sessionId = extractSessionId(title) || extractSessionId(body);
  if (!sessionId) {
    console.log(`[Webhook] PR #${prNumber} has no session tag, skipping`);
    return { recorded: false };
  }

  // Verify session exists
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    console.log(`[Webhook] Session ${sessionId} not found, skipping PR`);
    return { recorded: false };
  }

  const state = pr?.merged ? 'merged' : pr?.state || 'open';

  await prisma.sessionPullRequest.upsert({
    where: {
      sessionId_prNumber_repoOwner_repoName: {
        sessionId,
        prNumber,
        repoOwner,
        repoName,
      },
    },
    create: {
      sessionId,
      repoOwner,
      repoName,
      prNumber,
      title: title.substring(0, 500),
      state,
      htmlUrl: pr?.html_url || '',
      createdAt: pr?.created_at ? new Date(pr.created_at) : new Date(),
      mergedAt: pr?.merged_at ? new Date(pr.merged_at) : null,
      additions: pr?.additions ?? null,
      deletions: pr?.deletions ?? null,
    },
    update: {
      state,
      mergedAt: pr?.merged_at ? new Date(pr.merged_at) : null,
      additions: pr?.additions ?? null,
      deletions: pr?.deletions ?? null,
    },
  });

  console.log(`[Webhook] Recorded PR #${prNumber} (${state}) for session ${sessionId}`);
  return { recorded: true };
}

/**
 * Main webhook endpoint
 */
webhooks.post('/github', async (c) => {
  const event = c.req.header('X-GitHub-Event');
  const signature = c.req.header('X-Hub-Signature-256');
  const rawBody = await c.req.text();

  console.log(`[Webhook] Received ${event} event`);

  // Verify signature
  if (!verifySignature(rawBody, signature)) {
    console.error('[Webhook] Invalid signature');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const payload = JSON.parse(rawBody);

  if (event === 'push') {
    const result = await handlePush(payload);
    return c.json({ message: 'OK', ...result }, 200);
  }

  if (event === 'pull_request') {
    const result = await handlePullRequest(payload);
    return c.json({ message: 'OK', ...result }, 200);
  }

  return c.json({ message: 'Event ignored', event }, 200);
});

export { webhooks };
