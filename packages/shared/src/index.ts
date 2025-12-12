/**
 * @viberunner/shared - Core types, pace calculation, and state machine
 */

// Types
export * from './types.js';

// Pace calculation
export {
  PaceCalculator,
  PaceCalculatorConfig,
  haversineDistance,
  speedToPace,
  paceToSpeed,
  formatPace,
  parsePace,
} from './pace.js';

// State machine
export {
  RunStateMachine,
  StateMachineConfig,
  StateChangeEvent,
  StateChangeListener,
  createStateMachine,
} from './state-machine.js';
