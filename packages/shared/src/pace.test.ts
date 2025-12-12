import {
  haversineDistance,
  speedToPace,
  paceToSpeed,
  formatPace,
  parsePace,
  PaceCalculator,
} from './pace.js';

describe('haversineDistance', () => {
  it('calculates distance between two points', () => {
    // NYC to LA is roughly 3,944 km
    const nyc = { lat: 40.7128, lon: -74.006 };
    const la = { lat: 34.0522, lon: -118.2437 };
    const distance = haversineDistance(nyc.lat, nyc.lon, la.lat, la.lon);
    expect(distance).toBeGreaterThan(3900000);
    expect(distance).toBeLessThan(4000000);
  });

  it('returns 0 for same point', () => {
    const distance = haversineDistance(40.7128, -74.006, 40.7128, -74.006);
    expect(distance).toBe(0);
  });
});

describe('pace conversions', () => {
  it('converts speed to pace correctly', () => {
    // 2.68 m/s ≈ 6:00/mi pace
    const pace = speedToPace(2.68224); // exactly 6:00/mi
    expect(Math.round(pace)).toBe(600);
  });

  it('converts pace to speed correctly', () => {
    // 10:00/mi = 600 seconds/mile
    const speed = paceToSpeed(600);
    expect(speed).toBeCloseTo(2.68224, 2);
  });

  it('handles zero/invalid speed', () => {
    expect(speedToPace(0)).toBe(Infinity);
    expect(speedToPace(-1)).toBe(Infinity);
  });

  it('handles zero/invalid pace', () => {
    expect(paceToSpeed(0)).toBe(0);
    expect(paceToSpeed(-1)).toBe(0);
    expect(paceToSpeed(Infinity)).toBe(0);
  });
});

describe('formatPace', () => {
  it('formats pace correctly', () => {
    expect(formatPace(600)).toBe('10:00');
    expect(formatPace(450)).toBe('7:30');
    expect(formatPace(359)).toBe('5:59');
  });

  it('handles invalid pace', () => {
    expect(formatPace(Infinity)).toBe('--:--');
    expect(formatPace(0)).toBe('--:--');
    expect(formatPace(-1)).toBe('--:--');
  });
});

describe('parsePace', () => {
  it('parses valid pace strings', () => {
    expect(parsePace('10:00')).toBe(600);
    expect(parsePace('7:30')).toBe(450);
    expect(parsePace('5:59')).toBe(359);
  });

  it('returns null for invalid strings', () => {
    expect(parsePace('invalid')).toBeNull();
    expect(parsePace('10:60')).toBeNull();
    expect(parsePace('10:0')).toBeNull();
    expect(parsePace('')).toBeNull();
  });
});

describe('PaceCalculator', () => {
  it('returns null with insufficient samples', () => {
    const calc = new PaceCalculator();
    const sample = {
      latitude: 40.7128,
      longitude: -74.006,
      timestamp: Date.now(),
    };
    expect(calc.addSample(sample)).toBeNull();
    expect(calc.getCurrentPace()).toBeNull();
  });

  it('calculates pace from location samples', () => {
    const calc = new PaceCalculator({ windowSize: 2, minDistanceThreshold: 1 });
    const baseTime = Date.now();

    // Simulate running at ~6:00/mi pace (2.68 m/s)
    // Each sample moves ~26.8m in 10 seconds
    const samples = [
      { latitude: 40.7128, longitude: -74.006, timestamp: baseTime },
      { latitude: 40.71304, longitude: -74.006, timestamp: baseTime + 10000 }, // ~26.7m north
      { latitude: 40.71328, longitude: -74.006, timestamp: baseTime + 20000 },
    ];

    calc.addSample(samples[0]!);
    calc.addSample(samples[1]!);
    const pace = calc.addSample(samples[2]!);

    expect(pace).not.toBeNull();
    // Should be approximately 6:00/mi pace
    expect(pace!).toBeGreaterThan(300);
    expect(pace!).toBeLessThan(700);
  });

  it('filters out GPS jumps', () => {
    const calc = new PaceCalculator({ windowSize: 2, minDistanceThreshold: 1 });
    const baseTime = Date.now();

    // First two legitimate samples
    calc.addSample({ latitude: 40.7128, longitude: -74.006, timestamp: baseTime });
    calc.addSample({ latitude: 40.71304, longitude: -74.006, timestamp: baseTime + 10000 });

    // GPS jump - way too fast to be real
    const paceAfterJump = calc.addSample({
      latitude: 41.0, // ~32km jump
      longitude: -74.006,
      timestamp: baseTime + 11000, // only 1 second later
    });

    // Should still have reasonable pace (jump filtered out)
    const currentPace = calc.getCurrentPace();
    expect(currentPace).not.toBeNull();
    expect(currentPace!).toBeGreaterThan(100); // Not impossibly fast
  });

  it('resets on large time gaps', () => {
    const calc = new PaceCalculator({ maxTimeGap: 10000 });
    const baseTime = Date.now();

    calc.addSample({ latitude: 40.7128, longitude: -74.006, timestamp: baseTime });
    calc.addSample({ latitude: 40.71304, longitude: -74.006, timestamp: baseTime + 5000 });

    // Long gap - should reset
    calc.addSample({
      latitude: 40.71328,
      longitude: -74.006,
      timestamp: baseTime + 60000,
    });

    // Should need more samples after reset
    expect(calc.getCurrentPace()).toBeNull();
  });

  it('tracks total distance', () => {
    const calc = new PaceCalculator({ minDistanceThreshold: 1 });
    const baseTime = Date.now();

    calc.addSample({ latitude: 40.7128, longitude: -74.006, timestamp: baseTime });
    calc.addSample({ latitude: 40.71304, longitude: -74.006, timestamp: baseTime + 10000 });

    expect(calc.getTotalDistance()).toBeGreaterThan(20);
  });

  it('resets properly', () => {
    const calc = new PaceCalculator({ minDistanceThreshold: 1 });
    const baseTime = Date.now();

    calc.addSample({ latitude: 40.7128, longitude: -74.006, timestamp: baseTime });
    calc.addSample({ latitude: 40.71304, longitude: -74.006, timestamp: baseTime + 10000 });

    calc.reset();

    expect(calc.getCurrentPace()).toBeNull();
    expect(calc.getTotalDistance()).toBe(0);
  });
});
