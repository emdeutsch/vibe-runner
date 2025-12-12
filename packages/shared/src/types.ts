/**
 * Core types for VibeRunner
 */

/** Pace in seconds per mile */
export type PaceSecondsPerMile = number;

/** Threshold pace: 10:00/mile = 600 seconds */
export const PACE_THRESHOLD_SECONDS: PaceSecondsPerMile = 600;

/** User's current run state */
export type RunState =
  | 'NOT_RUNNING'      // No active run session
  | 'RUNNING_UNLOCKED' // Running fast enough (pace < threshold)
  | 'RUNNING_LOCKED';  // Running too slow (pace >= threshold)

/** What actions are allowed in each state */
export interface StatePermissions {
  claudeAllowed: boolean;
  githubWritesAllowed: boolean;
}

/** Permission matrix by state */
export const STATE_PERMISSIONS: Record<RunState, StatePermissions> = {
  NOT_RUNNING: {
    claudeAllowed: true,
    githubWritesAllowed: false, // Must be running to push code
  },
  RUNNING_UNLOCKED: {
    claudeAllowed: true,
    githubWritesAllowed: true,
  },
  RUNNING_LOCKED: {
    claudeAllowed: false, // Too slow, blocked
    githubWritesAllowed: false,
  },
};

/** A single GPS location sample */
export interface LocationSample {
  latitude: number;
  longitude: number;
  timestamp: number; // Unix timestamp in ms
  accuracy?: number; // meters
  altitude?: number;
  speed?: number; // meters per second (if available from device)
}

/** Heartbeat sent from iOS app to backend */
export interface Heartbeat {
  userId: string;
  deviceId: string;
  timestamp: number;
  runState: RunState;
  currentPace?: PaceSecondsPerMile; // undefined if not running
  location?: {
    latitude: number;
    longitude: number;
  };
}

/** Backend response to heartbeat */
export interface HeartbeatResponse {
  success: boolean;
  serverTime: number;
  stateAcknowledged: RunState;
  githubWritesEnabled: boolean;
}

/** User record */
export interface User {
  id: string;
  email: string;
  createdAt: number;
  githubUserId?: string;
  githubUsername?: string;
  githubAccessToken?: string; // Encrypted in storage
}

/** Device registration */
export interface Device {
  id: string;
  userId: string;
  name: string;
  platform: 'ios';
  pushToken?: string;
  lastHeartbeat?: number;
  lastRunState?: RunState;
  createdAt: number;
}

/** Repository configured for gating */
export interface GatedRepository {
  id: string;
  userId: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string; // owner/name
  rulesetId?: number; // GitHub ruleset ID once created
  gatingEnabled: boolean;
  createdAt: number;
}

/** Run session record */
export interface RunSession {
  id: string;
  userId: string;
  deviceId: string;
  startedAt: number;
  endedAt?: number;
  lastHeartbeat: number;
  currentState: RunState;
  averagePace?: PaceSecondsPerMile;
  distance?: number; // meters
}
