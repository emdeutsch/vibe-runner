#!/bin/bash
# Stream logs from iOS device for vibeworkout app
# Requires: brew install libimobiledevice

if ! command -v idevicesyslog &> /dev/null; then
    echo "❌ idevicesyslog not found. Install with:"
    echo "   brew install libimobiledevice"
    exit 1
fi

echo "📱 Streaming vibeworkout logs (Ctrl+C to stop)"
echo "----------------------------------------"

idevicesyslog --no-kernel 2>&1 | grep --line-buffered -iE "(vibeworkout|AuthService|LoginView|\[App\])"
