/**
 * HR Signal Update Helper
 *
 * Updates GitHub refs for gate repos when HR samples arrive.
 * Debounced to reduce GitHub API load - only updates every 5 seconds.
 */

import { prisma } from '@viberunner/db';
import { createSignedPayload } from '@viberunner/shared';
import { config } from '../config.js';
import { createInstallationOctokit, updateSignalRef } from './github.js';

// Debounce interval in milliseconds (5 seconds)
const GITHUB_UPDATE_DEBOUNCE_MS = 5000;

/**
 * Update HR signal refs for all gate repos in a session.
 * Debounced: only updates GitHub every 5 seconds to avoid API overload.
 * The database HrStatus is always up-to-date; this just syncs to GitHub.
 */
export async function updateSessionSignalRefs(
  userId: string,
  sessionId: string,
  bpm: number,
  thresholdBpm: number
): Promise<void> {
  try {
    const now = new Date();

    // Check debounce using raw SQL to avoid Prisma client field issues
    try {
      const result = await prisma.$queryRaw<Array<{ last_signal_ref_update_at: Date | null }>>`
        SELECT last_signal_ref_update_at FROM hr_status WHERE user_id = ${userId} LIMIT 1
      `;
      const lastUpdate = result[0]?.last_signal_ref_update_at;
      if (lastUpdate) {
        const timeSinceLastUpdate = now.getTime() - lastUpdate.getTime();
        if (timeSinceLastUpdate < GITHUB_UPDATE_DEBOUNCE_MS) {
          return; // Skip, too soon
        }
      }
    } catch (debounceErr) {
      console.error('[HR Signal] Debounce check failed, proceeding anyway:', debounceErr);
    }

    // Find gate repos selected for this session with GitHub App installed
    const gateRepos = await prisma.gateRepo.findMany({
      where: {
        userId,
        active: true,
        activeSessionId: sessionId,
        githubAppInstallationId: { not: null },
      },
    });

    if (gateRepos.length === 0) {
      return;
    }

    // Create signed payload
    const payload = createSignedPayload(
      gateRepos[0].userKey,
      sessionId,
      bpm,
      thresholdBpm,
      config.hrTtlSeconds,
      config.signerPrivateKey
    );

    const payloadJson = JSON.stringify(payload);

    // Update all repos in parallel
    const results = await Promise.allSettled(
      gateRepos.map(async (repo) => {
        const octokit = await createInstallationOctokit(repo.githubAppInstallationId!);
        await updateSignalRef(octokit, repo.owner, repo.name, repo.signalRef, payloadJson);
        console.log(`[HR Signal] Updated ${repo.owner}/${repo.name}: hr_ok=${payload.hr_ok}`);
      })
    );

    // If at least one succeeded, update the timestamp
    const anySuccess = results.some((r) => r.status === 'fulfilled');
    if (anySuccess) {
      try {
        await prisma.$executeRaw`
          UPDATE hr_status SET last_signal_ref_update_at = ${now} WHERE user_id = ${userId}
        `;
      } catch (updateErr) {
        console.error('[HR Signal] Failed to update debounce timestamp:', updateErr);
      }
    }

    // Log any failures
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(
          `[HR Signal] Failed to update ${gateRepos[i].owner}/${gateRepos[i].name}:`,
          result.reason
        );
      }
    });
  } catch (error) {
    console.error('[HR Signal] Error updating refs:', error);
  }
}
