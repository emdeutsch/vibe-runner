#!/bin/bash
set -e

# iOS Build, Install, and Launch Script
# Usage: ./scripts/ios-deploy.sh

cd "$(dirname "$0")/../apps/ios/vibeworkout"

SCHEME="Vibeworkout (Local)"
DEVICE_ID=$(xcrun xctrace list devices 2>&1 | grep -E "iPhone.*\(" | grep -v Simulator | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')

if [ -z "$DEVICE_ID" ]; then
    echo "❌ No iPhone connected. Please connect your device."
    exit 1
fi

echo "📱 Found device: $DEVICE_ID"

# Regenerate project if needed
if [ "$1" == "--regen" ] || [ "$1" == "-r" ]; then
    echo "🔄 Regenerating Xcode project..."
    xcodegen generate
fi

# Build
echo "🔨 Building $SCHEME..."
xcodebuild -project vibeworkout.xcodeproj \
    -scheme "$SCHEME" \
    -destination "platform=iOS,id=$DEVICE_ID" \
    -allowProvisioningUpdates \
    build 2>&1 | grep -E "(Compiling|Linking|BUILD|error:|warning:.*error)" | tail -20

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build succeeded"

# Find the built app
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/vibeworkout-*/Build/Products/Debug\ \(Local\)-iphoneos -name "Vibeworkout Local.app" -type d 2>/dev/null | head -1)

if [ -z "$APP_PATH" ]; then
    echo "❌ Could not find built app"
    exit 1
fi

# Install
echo "📲 Installing app..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH" 2>&1 | grep -v "^$"

# Launch
echo "🚀 Launching app..."
xcrun devicectl device process launch --device "$DEVICE_ID" com.vibeworkout.app.local 2>&1 | grep -v "^$"

echo "✅ Done!"
