/**
 * In-memory database for MVP
 * Replace with PostgreSQL/SQLite for production
 */

import type {
  User,
  Device,
  GatedRepository,
  RunSession,
  RunState,
} from '@viberunner/shared';
import { nanoid } from 'nanoid';

// In-memory stores
const users = new Map<string, User>();
const devices = new Map<string, Device>();
const repositories = new Map<string, GatedRepository>();
const sessions = new Map<string, RunSession>();

// Index: GitHub user ID -> user ID
const githubUserIndex = new Map<number, string>();
// Index: device user ID -> device IDs
const userDevicesIndex = new Map<string, Set<string>>();
// Index: user ID -> repository IDs
const userReposIndex = new Map<string, Set<string>>();

/**
 * User operations
 */
export const userDb = {
  create(data: Omit<User, 'id' | 'createdAt'>): User {
    const user: User = {
      ...data,
      id: nanoid(),
      createdAt: Date.now(),
    };
    users.set(user.id, user);
    return user;
  },

  findById(id: string): User | undefined {
    return users.get(id);
  },

  findByGithubId(githubUserId: number): User | undefined {
    const userId = githubUserIndex.get(githubUserId);
    if (!userId) return undefined;
    return users.get(userId);
  },

  update(id: string, data: Partial<User>): User | undefined {
    const user = users.get(id);
    if (!user) return undefined;

    const updated = { ...user, ...data };
    users.set(id, updated);

    // Update GitHub index if needed
    if (data.githubUserId !== undefined) {
      // Remove old index
      if (user.githubUserId) {
        githubUserIndex.delete(user.githubUserId);
      }
      // Add new index
      if (data.githubUserId) {
        githubUserIndex.set(data.githubUserId, id);
      }
    }

    return updated;
  },

  linkGithub(
    userId: string,
    githubUserId: number,
    githubUsername: string,
    accessToken: string
  ): User | undefined {
    const user = users.get(userId);
    if (!user) return undefined;

    const updated: User = {
      ...user,
      githubUserId,
      githubUsername,
      githubAccessToken: accessToken, // TODO: encrypt in production
    };

    users.set(userId, updated);
    githubUserIndex.set(githubUserId, userId);

    return updated;
  },
};

/**
 * Device operations
 */
export const deviceDb = {
  create(data: Omit<Device, 'id' | 'createdAt'>): Device {
    const device: Device = {
      ...data,
      id: nanoid(),
      createdAt: Date.now(),
    };
    devices.set(device.id, device);

    // Update user index
    const userDevices = userDevicesIndex.get(data.userId) || new Set();
    userDevices.add(device.id);
    userDevicesIndex.set(data.userId, userDevices);

    return device;
  },

  findById(id: string): Device | undefined {
    return devices.get(id);
  },

  findByUserId(userId: string): Device[] {
    const deviceIds = userDevicesIndex.get(userId);
    if (!deviceIds) return [];
    return Array.from(deviceIds)
      .map((id) => devices.get(id))
      .filter((d): d is Device => d !== undefined);
  },

  update(id: string, data: Partial<Device>): Device | undefined {
    const device = devices.get(id);
    if (!device) return undefined;

    const updated = { ...device, ...data };
    devices.set(id, updated);
    return updated;
  },

  updateHeartbeat(id: string, state: RunState): Device | undefined {
    return this.update(id, {
      lastHeartbeat: Date.now(),
      lastRunState: state,
    });
  },
};

/**
 * Repository operations
 */
export const repoDb = {
  create(data: Omit<GatedRepository, 'id' | 'createdAt'>): GatedRepository {
    const repo: GatedRepository = {
      ...data,
      id: nanoid(),
      createdAt: Date.now(),
    };
    repositories.set(repo.id, repo);

    // Update user index
    const userRepos = userReposIndex.get(data.userId) || new Set();
    userRepos.add(repo.id);
    userReposIndex.set(data.userId, userRepos);

    return repo;
  },

  findById(id: string): GatedRepository | undefined {
    return repositories.get(id);
  },

  findByUserId(userId: string): GatedRepository[] {
    const repoIds = userReposIndex.get(userId);
    if (!repoIds) return [];
    return Array.from(repoIds)
      .map((id) => repositories.get(id))
      .filter((r): r is GatedRepository => r !== undefined);
  },

  findByGithubRepoId(
    userId: string,
    githubRepoId: number
  ): GatedRepository | undefined {
    const repos = this.findByUserId(userId);
    return repos.find((r) => r.githubRepoId === githubRepoId);
  },

  update(id: string, data: Partial<GatedRepository>): GatedRepository | undefined {
    const repo = repositories.get(id);
    if (!repo) return undefined;

    const updated = { ...repo, ...data };
    repositories.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    const repo = repositories.get(id);
    if (!repo) return false;

    repositories.delete(id);
    const userRepos = userReposIndex.get(repo.userId);
    userRepos?.delete(id);

    return true;
  },
};

/**
 * Session operations
 */
export const sessionDb = {
  create(data: Omit<RunSession, 'id'>): RunSession {
    const session: RunSession = {
      ...data,
      id: nanoid(),
    };
    sessions.set(session.id, session);
    return session;
  },

  findById(id: string): RunSession | undefined {
    return sessions.get(id);
  },

  findActiveByDeviceId(deviceId: string): RunSession | undefined {
    for (const session of sessions.values()) {
      if (session.deviceId === deviceId && !session.endedAt) {
        return session;
      }
    }
    return undefined;
  },

  update(id: string, data: Partial<RunSession>): RunSession | undefined {
    const session = sessions.get(id);
    if (!session) return undefined;

    const updated = { ...session, ...data };
    sessions.set(id, updated);
    return updated;
  },
};

/**
 * Get all active sessions that need heartbeat checking
 */
export function getActiveSessionsForHeartbeatCheck(): RunSession[] {
  return Array.from(sessions.values()).filter((s) => !s.endedAt);
}
