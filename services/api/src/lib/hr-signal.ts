/**
 * HR Signal Update Helper
 *
 * Updates GitHub refs for gate repos when HR samples arrive.
 */

import { prisma } from '@viberunner/db';
import { createSignedPayload } from '@viberunner/shared';
import { config } from '../config.js';
import { createInstallationOctokit, updateSignalRef } from './github.js';

/**
 * Update HR signal refs for all gate repos in a session.
 * Atomic 1-second debounce ensures only one concurrent request updates GitHub.
 */
export async function updateSessionSignalRefs(
  userId: string,
  sessionId: string,
  bpm: number,
  thresholdBpm: number
): Promise<void> {
  try {
    // Atomic debounce: only one concurrent request proceeds, others quickly return
    const updated = await prisma.$executeRaw`
      UPDATE hr_status
      SET last_signal_ref_update_at = NOW()
      WHERE user_id = ${userId}
        AND (last_signal_ref_update_at IS NULL
             OR last_signal_ref_update_at < NOW() - INTERVAL '1 second')
    `;

    if (updated === 0) {
      return; // Another request is handling this
    }

    // Find gate repos
    const gateRepos = await prisma.gateRepo.findMany({
      where: {
        userId,
        active: true,
        activeSessionId: sessionId,
        githubAppInstallationId: { not: null },
      },
    });

    console.log(`[HR Signal] Found ${gateRepos.length} repos for session=${sessionId}`);

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
    console.log(`[HR Signal] Payload created: bpm=${bpm}, hr_ok=${payload.hr_ok}`);

    // Update all repos in parallel
    const results = await Promise.allSettled(
      gateRepos.map(async (repo) => {
        console.log(`[HR Signal] Updating ${repo.owner}/${repo.name}...`);
        const octokit = await createInstallationOctokit(repo.githubAppInstallationId!);
        await updateSignalRef(octokit, repo.owner, repo.name, repo.signalRef, payloadJson);
        console.log(`[HR Signal] SUCCESS: ${repo.owner}/${repo.name}`);
      })
    );

    // Log results
    const anySuccess = results.some((r) => r.status === 'fulfilled');
    console.log(`[HR Signal] Results: ${results.length} total, anySuccess=${anySuccess}`);

    // Log failures
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(
          `[HR Signal] FAILED ${gateRepos[i].owner}/${gateRepos[i].name}:`,
          result.reason
        );
      }
    });
  } catch (error) {
    console.error('[HR Signal] FATAL error:', error);
  }
}
