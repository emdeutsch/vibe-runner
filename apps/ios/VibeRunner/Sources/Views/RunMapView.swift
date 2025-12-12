import SwiftUI
import MapKit

/// Map view showing the running route
struct RunMapView: View {
    let routeCoordinates: [CLLocationCoordinate2D]
    let currentLocation: CLLocationCoordinate2D?
    let runState: RunState

    @State private var mapCameraPosition: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $mapCameraPosition) {
            // Route polyline
            if routeCoordinates.count >= 2 {
                MapPolyline(coordinates: routeCoordinates)
                    .stroke(routeColor, lineWidth: 4)
            }

            // Current location marker
            if let location = currentLocation {
                Annotation("", coordinate: location) {
                    CurrentLocationMarker(runState: runState)
                }
            }

            // Start marker
            if let startCoord = routeCoordinates.first {
                Annotation("Start", coordinate: startCoord) {
                    StartMarker()
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
        .onChange(of: currentLocation) { _, newLocation in
            if let location = newLocation {
                withAnimation(.easeInOut(duration: 0.5)) {
                    mapCameraPosition = .camera(MapCamera(
                        centerCoordinate: location,
                        distance: 500,
                        heading: 0,
                        pitch: 0
                    ))
                }
            }
        }
    }

    private var routeColor: Color {
        switch runState {
        case .notRunning:
            return .blue
        case .runningUnlocked:
            return .green
        case .runningLocked:
            return .red
        }
    }
}

// MARK: - Map Markers

struct CurrentLocationMarker: View {
    let runState: RunState

    var body: some View {
        ZStack {
            Circle()
                .fill(markerColor.opacity(0.3))
                .frame(width: 32, height: 32)

            Circle()
                .fill(markerColor)
                .frame(width: 16, height: 16)

            Circle()
                .stroke(.white, lineWidth: 2)
                .frame(width: 16, height: 16)
        }
    }

    private var markerColor: Color {
        switch runState {
        case .notRunning:
            return .blue
        case .runningUnlocked:
            return .green
        case .runningLocked:
            return .red
        }
    }
}

struct StartMarker: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(.green)
                .frame(width: 24, height: 24)

            Image(systemName: "flag.fill")
                .font(.system(size: 12))
                .foregroundStyle(.white)
        }
    }
}

// MARK: - Compact Map for RunView

struct CompactMapView: View {
    @EnvironmentObject var appState: AppState
    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 0) {
            // Map
            RunMapView(
                routeCoordinates: appState.routeCoordinates,
                currentLocation: appState.currentLocation,
                runState: appState.runState
            )
            .frame(height: isExpanded ? 300 : 150)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
            )

            // Expand/collapse button
            Button(action: { withAnimation { isExpanded.toggle() } }) {
                HStack {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    Text(isExpanded ? "Collapse Map" : "Expand Map")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
                .padding(.vertical, 8)
            }
        }
    }
}

// MARK: - Full Screen Map Sheet

struct FullScreenMapView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            RunMapView(
                routeCoordinates: appState.routeCoordinates,
                currentLocation: appState.currentLocation,
                runState: appState.runState
            )
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle("Route")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    // Sample route for preview
    let sampleCoords = [
        CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060),
        CLLocationCoordinate2D(latitude: 40.7135, longitude: -74.0055),
        CLLocationCoordinate2D(latitude: 40.7142, longitude: -74.0048),
        CLLocationCoordinate2D(latitude: 40.7150, longitude: -74.0040),
    ]

    return RunMapView(
        routeCoordinates: sampleCoords,
        currentLocation: sampleCoords.last,
        runState: .runningUnlocked
    )
    .frame(height: 300)
}
