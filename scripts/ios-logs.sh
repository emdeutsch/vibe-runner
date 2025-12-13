#!/bin/bash
# Stream logs from iOS device for viberunner app
# Requires: brew install libimobiledevice

if ! command -v idevicesyslog &> /dev/null; then
    echo "❌ idevicesyslog not found. Install with:"
    echo "   brew install libimobiledevice"
    exit 1
fi

echo "📱 Streaming viberunner logs (Ctrl+C to stop)"
echo "----------------------------------------"

idevicesyslog --no-kernel 2>&1 | grep --line-buffered -iE "(viberunner|AuthService|LoginView|\[App\])"
