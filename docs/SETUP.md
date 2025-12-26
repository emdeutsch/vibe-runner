# vibeworkout Setup Guide

This guide walks through setting up all components of vibeworkout.

## Prerequisites

- Node.js 20+
- npm 10+
- Xcode 15+ (macOS only, for iOS/watchOS apps)
- Git
- A Supabase account
- A GitHub account

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and keys from Settings > API

### Enable GitHub Auth

1. Go to Authentication > Providers
2. Enable GitHub provider
3. You'll need to create a GitHub OAuth App (see below)

## 2. GitHub OAuth App

This is for user authentication and repo creation.

### Create OAuth App

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - Application name: `vibeworkout`
   - Homepage URL: `https://your-app-domain.com`
   - Authorization callback URL: `https://your-api-domain.com/api/github/callback`
4. Create the app and note the Client ID and Client Secret

### Configure in Supabase

1. Go back to Supabase Authentication > Providers > GitHub
2. Enter your GitHub OAuth Client ID and Secret

## 3. GitHub App

This is for pushing HR signal refs to gate repos.

### Create GitHub App

1. Go to GitHub Settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Fill in:
   - GitHub App name: `vibeworkout`
   - Homepage URL: `https://your-app-domain.com`
   - Webhook URL: `https://your-api-domain.com/api/gate-repos/webhook/installation`
   - Webhook secret: Generate a random string
4. Permissions:
   - Repository permissions:
     - Contents: Read and write (for pushing refs)
     - Metadata: Read
5. Subscribe to events:
   - Installation
   - Installation repositories
6. Create the app
7. Generate a private key and download it
8. Note the App ID

## 4. Backend Setup

### Clone Repository

```bash
git clone https://github.com/evandeutsch/vibe-workout.git
cd vibe-workout
```

### Install Dependencies

```bash
npm install
```

### Generate Signing Keys

```bash
npx tsx -e "
import { generateKeyPair } from '@vibeworkout/shared';
const keys = generateKeyPair();
console.log('SIGNER_PRIVATE_KEY=' + keys.privateKey);
console.log('SIGNER_PUBLIC_KEY=' + keys.publicKey);
"
```

Save these keys - you'll need them for the API config.

### Generate Encryption Key

```bash
openssl rand -hex 32
```

This is for encrypting GitHub tokens at rest.

### Configure API Environment

Create `services/api/.env`:

```bash
PORT=3000
NODE_ENV=development

# Supabase (from Supabase dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Database (from Supabase dashboard > Settings > Database)
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# GitHub OAuth App
GITHUB_CLIENT_ID=Iv1.xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/api/github/callback

# GitHub App
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...your private key...
-----END RSA PRIVATE KEY-----"

# Signing Keys (from step above)
SIGNER_PRIVATE_KEY=your-64-char-hex-private-key
SIGNER_PUBLIC_KEY=your-64-char-hex-public-key

# Encryption Key (from step above)
TOKEN_ENCRYPTION_KEY=your-64-char-hex-key

# HR Settings
DEFAULT_HR_THRESHOLD=100
HR_TTL_SECONDS=15
```

### Configure Worker Environment

Create `services/worker/.env`:

```bash
# Database
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# GitHub App (same as API)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"

# Signing Keys (same as API)
SIGNER_PRIVATE_KEY=your-64-char-hex-private-key
SIGNER_PUBLIC_KEY=your-64-char-hex-public-key

# HR Settings
HR_TTL_SECONDS=15
POLL_INTERVAL_MS=5000
HR_STALE_THRESHOLD_SECONDS=30
```

### Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to Supabase
npm run db:push
```

### Start Services

```bash
# Run both API and worker
npm run dev

# API will be at http://localhost:3000
```

## 5. iOS App Setup

### Open in Xcode

```bash
open apps/ios/vibeworkout/vibeworkout.xcodeproj
```

### Configure App

1. Select your development team in Signing & Capabilities
2. Update bundle identifier if needed
3. Add environment variables or update `Config.swift`:
   - `VIBERUNNER_API_URL`: Your API URL
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key

### Add Capabilities

1. In Signing & Capabilities, add:
   - HealthKit
   - Background Modes (if needed)

### Build and Run

1. Select your iPhone as the target
2. Build and run (Cmd+R)

## 6. watchOS App Setup

### Open in Xcode

The watchOS app should be part of the iOS workspace.

### Configure App

1. Select your development team
2. Ensure HealthKit capability is enabled
3. Build and run on Apple Watch simulator or device

## 7. Testing the Complete Flow

### 1. Sign In

1. Open the iOS app
2. Sign in with GitHub

### 2. Set Threshold

1. Go to Settings
2. Adjust HR threshold (e.g., 100 BPM)

### 3. Connect GitHub

1. In Settings, tap "Connect GitHub"
2. Complete OAuth flow

### 4. Create Gate Repo

1. Go to Repos tab
2. Tap "Create Gate Repo"
3. Enter a name
4. After creation, install the vibeworkout GitHub App

### 5. Start Workout

1. Go to Workout tab
2. Tap "Start Workout"
3. On Apple Watch, the workout should start automatically
4. Your heart rate should begin streaming

### 6. Test Claude Code

1. Clone your gate repo locally
2. Open it in Claude Code
3. With HR below threshold: tool calls should be blocked
4. With HR above threshold: tool calls should work

## Troubleshooting

### "HR signal not found"

- Check that the worker is running
- Verify the GitHub App is installed on the repo
- Check worker logs for errors pushing refs

### "Invalid signature"

- Ensure API and worker use the same signing keys
- Verify the public key in `vibeworkout.config.json` matches

### "HR signal expired"

- Check that the worker is pushing updates (every 5s)
- Verify your workout session is active
- Check for network issues between worker and GitHub

### Watch not sending HR

- Ensure HealthKit permissions are granted
- Check WatchConnectivity status in the iOS app
- Verify the watchOS app is installed and running

## Production Deployment

For production:

1. Deploy API to Cloudflare Workers, Vercel, Railway, etc.
2. Deploy worker as a long-running process
3. Update all callback URLs to production domains
4. Use production Supabase project
5. Submit iOS/watchOS apps to App Store
