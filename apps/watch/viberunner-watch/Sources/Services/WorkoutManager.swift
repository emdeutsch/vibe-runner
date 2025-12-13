import Foundation
import HealthKit
import WatchKit

@MainActor
class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    // Published state
    @Published var isWorkoutActive = false
    @Published var currentHeartRate: Int = 0
    @Published var elapsedTime: TimeInterval = 0

    // HealthKit
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var workoutBuilder: HKLiveWorkoutBuilder?

    // Timer for elapsed time
    private var timer: Timer?
    private var workoutStartDate: Date?

    var elapsedTimeString: String {
        let minutes = Int(elapsedTime) / 60
        let seconds = Int(elapsedTime) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    override private init() {
        super.init()
        requestAuthorization()
    }

    // MARK: - Authorization

    private func requestAuthorization() {
        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType()
        ]

        let typesToRead: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.workoutType()
        ]

        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { success, error in
            if let error = error {
                print("HealthKit authorization error: \(error)")
            }
        }
    }

    // MARK: - Workout Control

    func startWorkout() {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .other
        configuration.locationType = .unknown

        do {
            workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            workoutBuilder = workoutSession?.associatedWorkoutBuilder()

            workoutSession?.delegate = self
            workoutBuilder?.delegate = self

            workoutBuilder?.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )

            let startDate = Date()
            workoutSession?.startActivity(with: startDate)
            workoutBuilder?.beginCollection(withStart: startDate) { [weak self] success, error in
                if success {
                    Task { @MainActor in
                        self?.isWorkoutActive = true
                        self?.workoutStartDate = startDate
                        self?.startTimer()
                    }
                }
            }
        } catch {
            print("Failed to start workout: \(error)")
        }
    }

    func stopWorkout() {
        workoutSession?.end()
        stopTimer()
    }

    // MARK: - Timer

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self = self, let startDate = self.workoutStartDate else { return }
                self.elapsedTime = Date().timeIntervalSince(startDate)
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    // MARK: - Heart Rate Processing

    private func processHeartRate(_ samples: [HKSample]) {
        guard let quantitySamples = samples as? [HKQuantitySample] else { return }

        for sample in quantitySamples {
            let heartRateUnit = HKUnit.count().unitDivided(by: .minute())
            let heartRate = Int(sample.quantity.doubleValue(for: heartRateUnit))

            Task { @MainActor in
                self.currentHeartRate = heartRate

                // Send to phone
                PhoneConnectivityService.shared.sendHeartRate(heartRate)
            }
        }
    }
}

// MARK: - HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        Task { @MainActor in
            switch toState {
            case .running:
                self.isWorkoutActive = true
            case .ended:
                self.isWorkoutActive = false
                self.currentHeartRate = 0
                self.elapsedTime = 0
                self.workoutStartDate = nil

                // End collection
                self.workoutBuilder?.endCollection(withEnd: date) { [weak self] success, error in
                    self?.workoutBuilder?.finishWorkout { workout, error in
                        // Workout saved
                    }
                }
            default:
                break
            }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("Workout session failed: \(error)")
        Task { @MainActor in
            self.isWorkoutActive = false
        }
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  quantityType == HKObjectType.quantityType(forIdentifier: .heartRate) else {
                continue
            }

            let statistics = workoutBuilder.statistics(for: quantityType)
            let heartRateUnit = HKUnit.count().unitDivided(by: .minute())

            if let mostRecent = statistics?.mostRecentQuantity() {
                let heartRate = Int(mostRecent.doubleValue(for: heartRateUnit))

                Task { @MainActor in
                    self.currentHeartRate = heartRate
                    PhoneConnectivityService.shared.sendHeartRate(heartRate)
                }
            }
        }
    }

    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
        // Handle events if needed
    }
}
