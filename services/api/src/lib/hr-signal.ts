/**
 * HR Signal Update Helper
 *
 * Updates GitHub refs for gate repos when HR samples arrive.
 * Replaces the polling worker with inline, realtime updates.
 */

import { prisma } from '@viberunner/db';
import { createSignedPayload } from '@viberunner/shared';
import { config } from '../config.js';
import { createInstallationOctokit, updateSignalRef } from './github.js';

/**
 * Update HR signal refs for all gate repos in a session.
 * Fire-and-forget: errors are logged but don't fail the request.
 */
export async function updateSessionSignalRefs(
  userId: string,
  sessionId: string,
  bpm: number,
  thresholdBpm: number
): Promise<void> {
  try {
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
      // Debug: check if any repos exist for this user at all
      const allUserRepos = await prisma.gateRepo.findMany({
        where: { userId },
        select: { id: true, active: true, activeSessionId: true, githubAppInstallationId: true },
      });
      console.log(
        `[HR Signal] No repos found for session. userId=${userId}, sessionId=${sessionId}, allUserRepos=${JSON.stringify(allUserRepos)}`
      );
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
    await Promise.allSettled(
      gateRepos.map(async (repo) => {
        try {
          const octokit = await createInstallationOctokit(repo.githubAppInstallationId!);
          await updateSignalRef(octokit, repo.owner, repo.name, repo.signalRef, payloadJson);
          console.log(`[HR Signal] Updated ${repo.owner}/${repo.name}: hr_ok=${payload.hr_ok}`);
        } catch (error) {
          console.error(`[HR Signal] Failed to update ${repo.owner}/${repo.name}:`, error);
        }
      })
    );
  } catch (error) {
    console.error('[HR Signal] Error updating refs:', error);
  }
}
