import Foundation
import CoreLocation

/// GPS location sample
struct LocationSample {
    let latitude: Double
    let longitude: Double
    let timestamp: Date
    let accuracy: Double?
    let speed: Double? // meters per second
}

/// Service for tracking GPS location during runs
class LocationService: NSObject, ObservableObject {
    private let locationManager = CLLocationManager()

    @Published var lastLocation: LocationSample?
    @Published var isTracking = false
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

    var onLocationUpdate: ((LocationSample) -> Void)?

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 5 // Update every 5 meters
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.activityType = .fitness
        authorizationStatus = locationManager.authorizationStatus
    }

    func requestPermission() async {
        guard authorizationStatus == .notDetermined else { return }

        await withCheckedContinuation { continuation in
            locationManager.requestWhenInUseAuthorization()
            // Note: In production, also request .requestAlwaysAuthorization()
            // for background tracking
            continuation.resume()
        }
    }

    func startTracking() {
        guard !isTracking else { return }

        if authorizationStatus == .authorizedWhenInUse ||
            authorizationStatus == .authorizedAlways {
            locationManager.startUpdatingLocation()
            isTracking = true
        }
    }

    func stopTracking() {
        locationManager.stopUpdatingLocation()
        isTracking = false
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationService: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        // Filter out inaccurate readings
        guard location.horizontalAccuracy >= 0 && location.horizontalAccuracy < 50 else { return }

        let sample = LocationSample(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            timestamp: location.timestamp,
            accuracy: location.horizontalAccuracy,
            speed: location.speed >= 0 ? location.speed : nil
        )

        lastLocation = sample
        onLocationUpdate?(sample)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error)")
    }
}
