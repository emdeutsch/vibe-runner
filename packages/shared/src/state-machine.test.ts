import { RunStateMachine, createStateMachine } from './state-machine.js';
import { PACE_THRESHOLD_SECONDS } from './types.js';

describe('RunStateMachine', () => {
  let sm: RunStateMachine;

  beforeEach(() => {
    sm = createStateMachine({
      paceThreshold: PACE_THRESHOLD_SECONDS, // 10:00/mi = 600s
      hysteresisBuffer: 15,
      consecutiveReadingsRequired: 2,
      heartbeatTimeout: 30000,
    });
  });

  afterEach(() => {
    sm.destroy();
  });

  describe('initial state', () => {
    it('starts in NOT_RUNNING state', () => {
      expect(sm.getState()).toBe('NOT_RUNNING');
    });

    it('has correct permissions when not running', () => {
      const perms = sm.getPermissions();
      expect(perms.claudeAllowed).toBe(true);
      expect(perms.githubWritesAllowed).toBe(false);
    });
  });

  describe('starting a run', () => {
    it('transitions to RUNNING_LOCKED on start', () => {
      sm.startRun();
      expect(sm.getState()).toBe('RUNNING_LOCKED');
    });

    it('emits state change event on start', () => {
      const listener = jest.fn();
      sm.onStateChange(listener);
      sm.startRun();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          previousState: 'NOT_RUNNING',
          newState: 'RUNNING_LOCKED',
          reason: 'run_started',
        })
      );
    });

    it('has correct permissions when running locked', () => {
      sm.startRun();
      const perms = sm.getPermissions();
      expect(perms.claudeAllowed).toBe(false);
      expect(perms.githubWritesAllowed).toBe(false);
    });
  });

  describe('pace updates', () => {
    beforeEach(() => {
      sm.startRun();
    });

    it('unlocks when pace is fast enough', () => {
      // Fast pace (below threshold - hysteresis = 585)
      sm.updatePace(500); // First reading
      expect(sm.getState()).toBe('RUNNING_LOCKED');

      sm.updatePace(500); // Second reading - should unlock
      expect(sm.getState()).toBe('RUNNING_UNLOCKED');
    });

    it('stays locked with slow pace', () => {
      sm.updatePace(650); // Slow pace
      sm.updatePace(650);
      sm.updatePace(650);
      expect(sm.getState()).toBe('RUNNING_LOCKED');
    });

    it('has correct permissions when running unlocked', () => {
      sm.updatePace(500);
      sm.updatePace(500);

      const perms = sm.getPermissions();
      expect(perms.claudeAllowed).toBe(true);
      expect(perms.githubWritesAllowed).toBe(true);
    });

    it('transitions back to locked when pace slows', () => {
      // First unlock
      sm.updatePace(500);
      sm.updatePace(500);
      expect(sm.getState()).toBe('RUNNING_UNLOCKED');

      // Now slow down (above threshold + hysteresis = 615)
      sm.updatePace(650);
      expect(sm.getState()).toBe('RUNNING_UNLOCKED'); // Not yet

      sm.updatePace(650);
      expect(sm.getState()).toBe('RUNNING_LOCKED'); // Now locked
    });

    it('maintains state in hysteresis zone', () => {
      // Unlock first
      sm.updatePace(500);
      sm.updatePace(500);
      expect(sm.getState()).toBe('RUNNING_UNLOCKED');

      // Pace in hysteresis zone (between 585 and 615)
      sm.updatePace(600);
      sm.updatePace(600);
      sm.updatePace(600);

      // Should still be unlocked
      expect(sm.getState()).toBe('RUNNING_UNLOCKED');
    });
  });

  describe('ending a run', () => {
    it('transitions to NOT_RUNNING on end', () => {
      sm.startRun();
      sm.updatePace(500);
      sm.updatePace(500);
      expect(sm.getState()).toBe('RUNNING_UNLOCKED');

      sm.endRun();
      expect(sm.getState()).toBe('NOT_RUNNING');
    });

    it('emits state change event on end', () => {
      sm.startRun();
      const listener = jest.fn();
      sm.onStateChange(listener);
      sm.endRun();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          previousState: 'RUNNING_LOCKED',
          newState: 'NOT_RUNNING',
          reason: 'run_ended',
        })
      );
    });
  });

  describe('force lock', () => {
    it('forces lock state on timeout', () => {
      sm.startRun();
      sm.updatePace(500);
      sm.updatePace(500);
      expect(sm.getState()).toBe('RUNNING_UNLOCKED');

      sm.forceLock('heartbeat_timeout');
      expect(sm.getState()).toBe('RUNNING_LOCKED');
    });
  });

  describe('listener management', () => {
    it('allows unsubscribing from state changes', () => {
      const listener = jest.fn();
      const unsubscribe = sm.onStateChange(listener);

      sm.startRun();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      sm.endRun();
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });
});
