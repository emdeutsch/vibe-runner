# VibeRunner

A "gatekeeper" app that enforces productivity through running. Run fast to unlock Claude and GitHub write access.

## How It Works

VibeRunner tracks your running pace and controls access to:

1. **Claude iOS App** - Blocked via Screen Time when you're running too slow
2. **GitHub Writes** - Push/branch updates blocked unless you're running fast enough

### Rules

| State | Claude | GitHub Writes |
|-------|--------|---------------|
| Not running | Allowed | **Blocked** |
| Running, pace < 10:00/mi | Allowed | Allowed |
| Running, pace ≥ 10:00/mi | **Blocked** | **Blocked** |

**Fail-closed**: If the phone stops heartbeating, GitHub writes become blocked.

## Architecture

```
viberunner/
├── apps/ios/           # SwiftUI app with Screen Time controls
├── services/api/       # Backend API (auth, heartbeat, GitHub rulesets)
├── packages/shared/    # Pace calculation, state machine, types
├── packages/github/    # GitHub OAuth and ruleset management
└── docs/               # Setup guides
```

## Quick Start

### Prerequisites

- Node.js 20+
- Xcode 15+ (for iOS app)
- GitHub OAuth App credentials
- Apple Developer account with Screen Time entitlement

### Backend Setup

```bash
# Install dependencies
npm install

# Configure environment
cp services/api/.env.example services/api/.env
# Edit .env with your credentials

# Run development server
npm run dev:api
```

### iOS App Setup

1. Open `apps/ios/VibeRunner` in Xcode
2. Configure signing with your Apple Developer account
3. Request the Family Controls entitlement from Apple
4. Build and run on device (Screen Time APIs require physical device)

## Configuration

### GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set callback URL to your API's `/auth/github/callback` endpoint
4. Copy Client ID and Secret to `.env`

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# JWT Secret (min 32 characters)
JWT_SECRET=your-secret-key-at-least-32-characters-long

# GitHub OAuth
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback

# iOS App URL scheme
CLIENT_URL=viberunner://

# Heartbeat settings
HEARTBEAT_TIMEOUT_MS=30000
HEARTBEAT_CHECK_INTERVAL_MS=10000
```

## API Endpoints

### Authentication

- `POST /auth/register` - Create account
- `GET /auth/me` - Get current user
- `GET /auth/github` - Start GitHub OAuth
- `GET /auth/github/callback` - GitHub OAuth callback

### Repositories

- `GET /repos/available` - List repos available for gating
- `GET /repos` - List gated repos
- `POST /repos` - Add repo for gating
- `DELETE /repos/:id` - Remove repo from gating

### Heartbeat

- `POST /heartbeat` - Send heartbeat with run state
- `GET /heartbeat/status` - Get current session status
- `POST /heartbeat/start` - Start run session
- `POST /heartbeat/end` - End run session

## How GitHub Gating Works

1. When you add a repository, VibeRunner creates a [GitHub Ruleset](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) that blocks:
   - Branch creation
   - Branch updates (pushes)
   - Branch deletion

2. The ruleset starts **enabled** (writes blocked)

3. During a run, when your pace is fast enough:
   - iOS app sends heartbeat with `RUNNING_UNLOCKED` state
   - Backend disables the ruleset (writes allowed)

4. When you slow down or stop:
   - iOS app sends updated state
   - Backend enables the ruleset (writes blocked)

5. **Fail-closed**: If heartbeats stop, the backend automatically enables the ruleset

## Pace Calculation

The app uses GPS to calculate pace with:

- **Rolling window**: Averages last 5 segments for smoothing
- **Hysteresis**: ±15 seconds buffer around 10:00/mi threshold
- **Consecutive readings**: Requires 3 readings to change state
- **GPS filtering**: Ignores unrealistic speed jumps

## Development

```bash
# Build all packages
npm run build

# Run tests
npm run test

# Type check
npm run typecheck

# Development server with hot reload
npm run dev:api
```

## License

MIT
