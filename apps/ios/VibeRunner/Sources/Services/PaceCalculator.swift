import Foundation
import CoreLocation

/// Calculates running pace with rolling window smoothing
class PaceCalculator {
    private var samples: [LocationSample] = []
    private var speedSegments: [SpeedSegment] = []
    private(set) var totalDistance: Double = 0

    // Configuration
    private let windowSize = 5
    private let minDistanceThreshold: Double = 5 // meters
    private let maxTimeGap: TimeInterval = 10 // seconds
    private let minMovingSpeed: Double = 0.5 // m/s
    private let maxRealisticSpeed: Double = 10 // m/s (~2:40/mi)

    private let metersPerMile: Double = 1609.344

    struct SpeedSegment {
        let speed: Double // m/s
        let distance: Double
        let duration: TimeInterval
        let timestamp: Date
    }

    /// Add a location sample and return the calculated pace
    /// Returns nil if not enough data or not moving
    func addSample(_ sample: LocationSample) -> Double? {
        let lastSample = samples.last

        // Reset if too much time has passed
        if let last = lastSample,
           sample.timestamp.timeIntervalSince(last.timestamp) > maxTimeGap {
            reset()
        }

        // Calculate segment from previous sample
        if let last = lastSample {
            let distance = haversineDistance(
                lat1: last.latitude,
                lon1: last.longitude,
                lat2: sample.latitude,
                lon2: sample.longitude
            )
            let duration = sample.timestamp.timeIntervalSince(last.timestamp)

            // Skip if distance too small or duration is 0
            if distance >= minDistanceThreshold && duration > 0 {
                let speed = distance / duration

                // Filter unrealistic speeds
                if speed <= maxRealisticSpeed {
                    totalDistance += distance
                    speedSegments.append(SpeedSegment(
                        speed: speed,
                        distance: distance,
                        duration: duration,
                        timestamp: sample.timestamp
                    ))

                    // Keep window size
                    while speedSegments.count > windowSize {
                        speedSegments.removeFirst()
                    }
                }
            }
        }

        samples.append(sample)
        while samples.count > windowSize + 1 {
            samples.removeFirst()
        }

        return getCurrentPace()
    }

    /// Get current smoothed pace in seconds per mile
    func getCurrentPace() -> Double? {
        guard !speedSegments.isEmpty else { return nil }

        // Distance-weighted average speed
        var totalWeightedSpeed: Double = 0
        var segmentDistance: Double = 0

        for segment in speedSegments {
            totalWeightedSpeed += segment.speed * segment.distance
            segmentDistance += segment.distance
        }

        guard segmentDistance > 0 else { return nil }

        let avgSpeed = totalWeightedSpeed / segmentDistance

        // Not moving fast enough
        if avgSpeed < minMovingSpeed {
            return nil
        }

        // Convert to seconds per mile
        return metersPerMile / avgSpeed
    }

    /// Reset the calculator
    func reset() {
        samples = []
        speedSegments = []
        totalDistance = 0
    }

    /// Haversine formula for distance between two coordinates
    private func haversineDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double) -> Double {
        let R: Double = 6371000 // Earth's radius in meters
        let dLat = (lat2 - lat1) * .pi / 180
        let dLon = (lon2 - lon1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2) +
            cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) *
            sin(dLon / 2) * sin(dLon / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c
    }
}

// MARK: - Pace Formatting

extension Double {
    /// Format pace as MM:SS string (assuming value is seconds per mile)
    var paceString: String {
        guard self.isFinite && self > 0 else { return "--:--" }
        let minutes = Int(self) / 60
        let seconds = Int(self) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
