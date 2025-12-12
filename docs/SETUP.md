# VibeRunner Setup Guide

This guide walks through setting up VibeRunner from scratch.

## 1. Backend Setup

### Clone and Install

```bash
git clone https://github.com/your-org/viberunner.git
cd viberunner
npm install
```

### Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: VibeRunner
   - **Homepage URL**: http://localhost:3000
   - **Authorization callback URL**: http://localhost:3000/auth/github/callback
4. Click "Register application"
5. Copy the **Client ID**
6. Generate and copy a **Client Secret**

### Configure Environment

```bash
cd services/api
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=generate-a-long-random-string-here-at-least-32-chars
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback
CLIENT_URL=viberunner://
```

### Start the Server

```bash
cd ../..  # back to root
npm run dev:api
```

Server runs at http://localhost:3000

### Verify

```bash
curl http://localhost:3000/health
```

Should return: `{"status":"ok","timestamp":...,"version":"0.1.0"}`

## 2. iOS App Setup

### Prerequisites

- Xcode 15 or later
- Physical iOS device (Screen Time APIs don't work in simulator)
- Apple Developer account

### Request Family Controls Entitlement

The Screen Time APIs require special entitlement from Apple:

1. Go to https://developer.apple.com/contact/request/family-controls-distribution
2. Submit request for Family Controls capability
3. Wait for Apple approval (can take a few days)

### Configure Xcode Project

1. Open `apps/ios/VibeRunner` in Xcode
2. Select the project in navigator
3. Under "Signing & Capabilities":
   - Select your team
   - Add capability: "Family Controls"
4. Update bundle identifier if needed

### Update API URL

Edit `apps/ios/VibeRunner/Sources/Services/APIService.swift`:

```swift
init(baseURL: String = "http://YOUR-SERVER-IP:3000") {
```

For local development, use your Mac's IP address (not localhost).

### Build and Run

1. Connect your iPhone
2. Select your device in Xcode
3. Build and run (Cmd+R)

## 3. First Run

### On the iOS App

1. **Create Account**: Enter your email
2. **Select Claude App**:
   - Tap "Select Claude App"
   - Find and select "Claude" in the picker
   - This grants Screen Time control
3. **Connect GitHub**:
   - Tap "Connect GitHub"
   - Authorize VibeRunner
   - You'll be redirected back to the app
4. **Add Repositories**:
   - Go to Settings > Manage Repositories
   - Select repos to gate

### Test the Flow

1. **Not Running**:
   - Claude app: Should work normally
   - `git push`: Should be rejected with ruleset error

2. **Start a Run**:
   - Tap "Start Run"
   - Claude app: Blocked immediately (running but no pace yet)
   - Wait for GPS to get pace data

3. **Run Fast** (pace < 10:00/mi):
   - Status changes to "Running Fast"
   - Claude app: Unblocked
   - `git push`: Should succeed

4. **Slow Down** (pace > 10:00/mi):
   - Status changes to "Too Slow"
   - Claude app: Blocked again
   - `git push`: Rejected

5. **End Run**:
   - Tap "End Run"
   - Claude app: Unblocked
   - `git push`: Rejected (not running)

## Troubleshooting

### "Family Controls not available"

- Must use physical device, not simulator
- Ensure you have the Family Controls entitlement
- Check device is on iOS 17+

### GitHub push still blocked

- Check API server is running
- Verify heartbeat is being sent (check server logs)
- Ensure repository was added to gating list
- Check GitHub connection in Settings

### Pace not updating

- Ensure location permission is "Always" or "When In Use"
- GPS needs time to get accurate fix
- Try running outdoors with clear sky

### Heartbeat failing

- Check API server URL in iOS app
- Ensure phone has internet connection
- Verify JWT token is valid

## Production Deployment

### Backend

1. Deploy to your preferred platform (Railway, Fly.io, AWS, etc.)
2. Set production environment variables
3. Use a real database (replace in-memory db)
4. Add HTTPS

### iOS App

1. Update API URL to production server
2. Archive and submit to App Store
3. Note: Family Controls requires Apple review
