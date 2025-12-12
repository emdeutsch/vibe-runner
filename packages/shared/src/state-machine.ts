/**
 * Run state machine with hysteresis to prevent rapid state flapping
 */

import {
  RunState,
  PaceSecondsPerMile,
  PACE_THRESHOLD_SECONDS,
  STATE_PERMISSIONS,
  StatePermissions,
} from './types.js';

/** Configuration for the state machine */
export interface StateMachineConfig {
  /** Pace threshold in seconds/mile (default: 600 = 10:00/mi) */
  paceThreshold: PaceSecondsPerMile;
  /** Hysteresis buffer in seconds (default: 15 = +/- 15 seconds from threshold) */
  hysteresisBuffer: PaceSecondsPerMile;
  /** Number of consecutive readings needed to change state (default: 3) */
  consecutiveReadingsRequired: number;
  /** Time in ms without heartbeat before forcing locked state (default: 30000) */
  heartbeatTimeout: number;
}

const DEFAULT_CONFIG: StateMachineConfig = {
  paceThreshold: PACE_THRESHOLD_SECONDS,
  hysteresisBuffer: 15, // 15 seconds buffer
  consecutiveReadingsRequired: 3,
  heartbeatTimeout: 30000,
};

/** State change event */
export interface StateChangeEvent {
  previousState: RunState;
  newState: RunState;
  timestamp: number;
  pace?: PaceSecondsPerMile;
  reason: 'pace_change' | 'run_started' | 'run_ended' | 'heartbeat_timeout';
}

/** Listener for state changes */
export type StateChangeListener = (event: StateChangeEvent) => void;

/**
 * State machine that manages run state transitions with hysteresis
 */
export class RunStateMachine {
  private config: StateMachineConfig;
  private currentState: RunState = 'NOT_RUNNING';
  private lastPace: PaceSecondsPerMile | null = null;
  private lastHeartbeat: number = 0;
  private consecutiveFastReadings: number = 0;
  private consecutiveSlowReadings: number = 0;
  private listeners: Set<StateChangeListener> = new Set();
  private timeoutCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<StateMachineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start a run session
   */
  startRun(): void {
    if (this.currentState !== 'NOT_RUNNING') return;

    const previousState = this.currentState;
    // Start in locked state - must prove pace before unlocking
    this.currentState = 'RUNNING_LOCKED';
    this.lastHeartbeat = Date.now();
    this.consecutiveFastReadings = 0;
    this.consecutiveSlowReadings = 0;

    this.emit({
      previousState,
      newState: this.currentState,
      timestamp: Date.now(),
      reason: 'run_started',
    });

    this.startTimeoutCheck();
  }

  /**
   * End the current run session
   */
  endRun(): void {
    if (this.currentState === 'NOT_RUNNING') return;

    const previousState = this.currentState;
    this.currentState = 'NOT_RUNNING';
    this.lastPace = null;
    this.consecutiveFastReadings = 0;
    this.consecutiveSlowReadings = 0;

    this.emit({
      previousState,
      newState: this.currentState,
      timestamp: Date.now(),
      reason: 'run_ended',
    });

    this.stopTimeoutCheck();
  }

  /**
   * Update pace and potentially transition state
   * Called on each GPS update during a run
   */
  updatePace(pace: PaceSecondsPerMile): void {
    if (this.currentState === 'NOT_RUNNING') return;

    this.lastPace = pace;
    this.lastHeartbeat = Date.now();

    const { paceThreshold, hysteresisBuffer, consecutiveReadingsRequired } = this.config;

    // Thresholds with hysteresis
    const lockThreshold = paceThreshold - hysteresisBuffer; // Must be faster than this to unlock
    const unlockThreshold = paceThreshold + hysteresisBuffer; // Must be slower than this to lock

    // Track consecutive readings
    if (pace < lockThreshold) {
      // Fast enough to unlock
      this.consecutiveFastReadings++;
      this.consecutiveSlowReadings = 0;
    } else if (pace > unlockThreshold) {
      // Too slow - should lock
      this.consecutiveSlowReadings++;
      this.consecutiveFastReadings = 0;
    } else {
      // In hysteresis zone - maintain current state, reset counters
      this.consecutiveFastReadings = 0;
      this.consecutiveSlowReadings = 0;
    }

    // Check for state transitions
    const previousState = this.currentState;

    if (
      this.currentState === 'RUNNING_LOCKED' &&
      this.consecutiveFastReadings >= consecutiveReadingsRequired
    ) {
      // Transition to unlocked
      this.currentState = 'RUNNING_UNLOCKED';
      this.consecutiveFastReadings = 0;

      this.emit({
        previousState,
        newState: this.currentState,
        timestamp: Date.now(),
        pace,
        reason: 'pace_change',
      });
    } else if (
      this.currentState === 'RUNNING_UNLOCKED' &&
      this.consecutiveSlowReadings >= consecutiveReadingsRequired
    ) {
      // Transition to locked
      this.currentState = 'RUNNING_LOCKED';
      this.consecutiveSlowReadings = 0;

      this.emit({
        previousState,
        newState: this.currentState,
        timestamp: Date.now(),
        pace,
        reason: 'pace_change',
      });
    }
  }

  /**
   * Get current state
   */
  getState(): RunState {
    return this.currentState;
  }

  /**
   * Get current permissions based on state
   */
  getPermissions(): StatePermissions {
    return STATE_PERMISSIONS[this.currentState];
  }

  /**
   * Get last known pace
   */
  getLastPace(): PaceSecondsPerMile | null {
    return this.lastPace;
  }

  /**
   * Check if heartbeat has timed out
   */
  isHeartbeatStale(): boolean {
    if (this.currentState === 'NOT_RUNNING') return false;
    return Date.now() - this.lastHeartbeat > this.config.heartbeatTimeout;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Force transition to locked state (for fail-closed behavior)
   */
  forceLock(reason: 'heartbeat_timeout' | 'run_ended'): void {
    if (this.currentState === 'NOT_RUNNING') return;
    if (this.currentState === 'RUNNING_LOCKED' && reason !== 'run_ended') return;

    const previousState = this.currentState;

    if (reason === 'run_ended') {
      this.currentState = 'NOT_RUNNING';
    } else {
      this.currentState = 'RUNNING_LOCKED';
    }

    this.emit({
      previousState,
      newState: this.currentState,
      timestamp: Date.now(),
      reason,
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopTimeoutCheck();
    this.listeners.clear();
  }

  private emit(event: StateChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('State change listener error:', e);
      }
    }
  }

  private startTimeoutCheck(): void {
    this.stopTimeoutCheck();
    this.timeoutCheckInterval = setInterval(() => {
      if (this.isHeartbeatStale() && this.currentState === 'RUNNING_UNLOCKED') {
        this.forceLock('heartbeat_timeout');
      }
    }, 5000);
  }

  private stopTimeoutCheck(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
  }
}

/**
 * Create a configured state machine instance
 */
export function createStateMachine(
  config?: Partial<StateMachineConfig>
): RunStateMachine {
  return new RunStateMachine(config);
}
