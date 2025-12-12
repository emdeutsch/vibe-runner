/**
 * Pace calculation with rolling window smoothing and GPS jitter handling
 */

import { LocationSample, PaceSecondsPerMile } from './types.js';

/** Configuration for pace calculator */
export interface PaceCalculatorConfig {
  /** Size of rolling window in samples (default: 5) */
  windowSize: number;
  /** Minimum distance between samples to consider valid in meters (default: 5) */
  minDistanceThreshold: number;
  /** Maximum time gap between samples in ms before resetting (default: 10000) */
  maxTimeGap: number;
  /** Minimum speed to be considered "moving" in m/s (default: 0.5) */
  minMovingSpeed: number;
  /** Maximum realistic speed in m/s to filter GPS jumps (default: 10 = ~2:40/mi) */
  maxRealisticSpeed: number;
}

const DEFAULT_CONFIG: PaceCalculatorConfig = {
  windowSize: 5,
  minDistanceThreshold: 5,
  maxTimeGap: 10000,
  minMovingSpeed: 0.5,
  maxRealisticSpeed: 10,
};

/** Meters per mile conversion */
const METERS_PER_MILE = 1609.344;

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert speed (m/s) to pace (seconds per mile)
 */
export function speedToPace(speedMs: number): PaceSecondsPerMile {
  if (speedMs <= 0) return Infinity;
  return METERS_PER_MILE / speedMs;
}

/**
 * Convert pace (seconds per mile) to speed (m/s)
 */
export function paceToSpeed(paceSeconds: PaceSecondsPerMile): number {
  if (paceSeconds <= 0 || !isFinite(paceSeconds)) return 0;
  return METERS_PER_MILE / paceSeconds;
}

/**
 * Format pace as MM:SS string
 */
export function formatPace(paceSeconds: PaceSecondsPerMile): string {
  if (!isFinite(paceSeconds) || paceSeconds <= 0) return '--:--';
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.floor(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse pace string (MM:SS) to seconds
 */
export function parsePace(paceStr: string): PaceSecondsPerMile | null {
  const match = paceStr.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1]!, 10);
  const seconds = parseInt(match[2]!, 10);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

/** A single speed segment between two points */
interface SpeedSegment {
  speed: number; // m/s
  distance: number;
  duration: number;
  timestamp: number;
}

/**
 * Rolling window pace calculator with GPS noise filtering
 */
export class PaceCalculator {
  private config: PaceCalculatorConfig;
  private samples: LocationSample[] = [];
  private speedSegments: SpeedSegment[] = [];
  private totalDistance: number = 0;

  constructor(config: Partial<PaceCalculatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a new location sample and calculate updated pace
   * Returns null if not enough data or user isn't moving
   */
  addSample(sample: LocationSample): PaceSecondsPerMile | null {
    const lastSample = this.samples[this.samples.length - 1];

    // Reset if too much time has passed
    if (lastSample && sample.timestamp - lastSample.timestamp > this.config.maxTimeGap) {
      this.reset();
    }

    // If we have a previous sample, calculate segment
    if (lastSample) {
      const distance = haversineDistance(
        lastSample.latitude,
        lastSample.longitude,
        sample.latitude,
        sample.longitude
      );
      const duration = (sample.timestamp - lastSample.timestamp) / 1000; // seconds

      // Skip if distance is too small (GPS noise) or duration is 0
      if (distance >= this.config.minDistanceThreshold && duration > 0) {
        const speed = distance / duration;

        // Filter out unrealistic speeds (GPS jumps)
        if (speed <= this.config.maxRealisticSpeed) {
          this.totalDistance += distance;
          this.speedSegments.push({
            speed,
            distance,
            duration,
            timestamp: sample.timestamp,
          });

          // Keep only recent segments in window
          while (this.speedSegments.length > this.config.windowSize) {
            this.speedSegments.shift();
          }
        }
      }
    }

    this.samples.push(sample);

    // Keep samples buffer reasonable
    while (this.samples.length > this.config.windowSize + 1) {
      this.samples.shift();
    }

    return this.getCurrentPace();
  }

  /**
   * Get current smoothed pace
   */
  getCurrentPace(): PaceSecondsPerMile | null {
    if (this.speedSegments.length === 0) {
      return null;
    }

    // Distance-weighted average speed for smoother results
    let totalWeightedSpeed = 0;
    let totalDistance = 0;

    for (const segment of this.speedSegments) {
      totalWeightedSpeed += segment.speed * segment.distance;
      totalDistance += segment.distance;
    }

    if (totalDistance === 0) return null;

    const avgSpeed = totalWeightedSpeed / totalDistance;

    // If moving too slowly, return null (not really running)
    if (avgSpeed < this.config.minMovingSpeed) {
      return null;
    }

    return speedToPace(avgSpeed);
  }

  /**
   * Get total distance traveled in meters
   */
  getTotalDistance(): number {
    return this.totalDistance;
  }

  /**
   * Reset calculator state
   */
  reset(): void {
    this.samples = [];
    this.speedSegments = [];
    this.totalDistance = 0;
  }
}
