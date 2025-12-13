# viberunner

**HR-gated Claude Code tools via repo-local GitHub ref**

viberunner is a workout app + enforcement system that lets users keep chatting with Claude, but blocks Claude Code tool calls (edit/write/bash/git/etc.) unless the user's live heart rate (HR) is above a configurable threshold.

## How It Works

1. **Users can always talk to Claude normally** - chat is never gated
2. **Tool calls are blocked** unless HR >= threshold "right now"
3. **Threshold is configurable** per-user in the app (default: 100 BPM)
4. **Fail-closed enforcement** - missing/expired/invalid signals = tools locked

### The Enforcement Mechanism

Each "gate repo" contains:
- A Claude Code `PreToolUse` hook that runs before every tool call
- A bash script that fetches and verifies a signed HR signal from a git ref
- If verification fails: tools are locked with a clear message

The HR signal lives in a special git ref (`refs/viberunner/hr/<user_key>`) that's updated every ~5 seconds by the viberunner backend while you're working out.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Apple Watch   │────▶│    iPhone App    │────▶│  viberunner API │
│  (HR streaming) │     │ (forward to API) │     │  (stores HR)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Code    │◀────│   Gate Repo      │◀────│  Worker         │
│  (tool calls)   │     │ (PreToolUse hook)│     │ (pushes refs)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Repository Structure

```
viberunner/
├── apps/
│   ├── ios/                    # iOS app (SwiftUI)
│   │   └── viberunner/
│   └── watch/                  # watchOS app (SwiftUI)
│       └── viberunner-watch/
├── services/
│   ├── api/                    # Hono API server
│   └── worker/                 # HR signal ref updater
├── packages/
│   ├── db/                     # Prisma schema + client
│   ├── shared/                 # Types + Ed25519 signing
│   └── repo-bootstrap/         # Gate repo templates
└── docs/                       # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+
- Xcode 15+ (for iOS/watchOS apps)
- Supabase account
- GitHub OAuth App
- GitHub App (for pushing refs)

### 1. Clone and Install

```bash
git clone https://github.com/viberunner/viberunner.git
cd viberunner
npm install
```

### 2. Configure Environment

Create `.env` files for the API and worker services:

```bash
# services/api/.env
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# GitHub OAuth (for user repo creation)
GITHUB_CLIENT_ID=your-oauth-client-id
GITHUB_CLIENT_SECRET=your-oauth-client-secret
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/api/github/callback

# GitHub App (for pushing refs)
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."

# Viberunner signing keys (generate with: npx tsx scripts/generate-keys.ts)
SIGNER_PRIVATE_KEY=your-private-key-hex
SIGNER_PUBLIC_KEY=your-public-key-hex

# Token encryption (generate with: openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY=your-32-byte-hex-key

# HR settings
DEFAULT_HR_THRESHOLD=100
HR_TTL_SECONDS=15
```

### 3. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to Supabase
npm run db:push
```

### 4. Run Services

```bash
# Run both API and worker
npm run dev

# Or run separately
npm run api:dev
npm run worker:dev
```

### 5. Build iOS/watchOS Apps

Open the Xcode projects in `apps/ios` and `apps/watch`, configure your development team, and build.

## Creating a Gate Repo

### From the App

1. Sign in with GitHub (Supabase auth)
2. Connect GitHub (OAuth) in Settings
3. Go to "Repos" tab and tap "Create Gate Repo"
4. Install the viberunner GitHub App on the new repo

### Manually

You can also bootstrap an existing repo:

1. Copy files from `packages/repo-bootstrap/template/` to your repo
2. Update `viberunner.config.json` with your `user_key` and `public_key`
3. Make the hook script executable: `chmod +x scripts/viberunner-hr-check`
4. Install the viberunner GitHub App on the repo

## How Enforcement Works

### The PreToolUse Hook

Every gate repo has `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": ["./scripts/viberunner-hr-check"]
      }
    ]
  }
}
```

This runs `scripts/viberunner-hr-check` before every Claude Code tool call.

### The HR Check Script

The script:
1. Fetches `refs/viberunner/hr/<user_key>` from origin
2. Reads the JSON payload from that ref
3. Verifies the Ed25519 signature
4. Checks that `exp_unix > now` (not expired)
5. Checks that `hr_ok == true` (HR above threshold)
6. Exits 0 (allow) or 2 (block)

### HR Signal Payload

```json
{
  "v": 1,
  "user_key": "octocat",
  "hr_ok": true,
  "bpm": 120,
  "threshold_bpm": 100,
  "exp_unix": 1702500000,
  "nonce": "abc123...",
  "sig": "ed25519-signature-hex"
}
```

The signature is computed over canonicalized JSON (sorted keys, no whitespace).

## Development

### Generate Signing Keys

```bash
npx tsx -e "
import { generateKeyPair } from '@viberunner/shared';
const keys = generateKeyPair();
console.log('SIGNER_PRIVATE_KEY=' + keys.privateKey);
console.log('SIGNER_PUBLIC_KEY=' + keys.publicKey);
"
```

### Testing the Hook Locally

```bash
# In a gate repo
./scripts/viberunner-hr-check
echo $?  # 0 = unlocked, 2 = locked
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/profile` | GET | Get user profile |
| `/api/profile/threshold` | PATCH | Update HR threshold |
| `/api/workout/start` | POST | Start workout session |
| `/api/workout/stop` | POST | Stop workout session |
| `/api/workout/hr` | POST | Ingest HR sample |
| `/api/workout/status` | GET | Get current HR status |
| `/api/github/connect` | GET | Start GitHub OAuth |
| `/api/github/callback` | POST | Complete GitHub OAuth |
| `/api/github/status` | GET | Check GitHub connection |
| `/api/gate-repos` | GET | List gate repos |
| `/api/gate-repos` | POST | Create gate repo |

## Security

- **Ed25519 signatures** prevent tampering with HR signals
- **Short TTL (15s)** ensures signals can't be replayed
- **Fail-closed design** - any verification failure blocks tools
- **GitHub App isolation** - app can only push to signal refs
- **Token encryption** - GitHub OAuth tokens encrypted at rest

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and data flow
- [Setup Guide](docs/SETUP.md) - Detailed setup instructions
- [Contributing](docs/CONTRIBUTING.md) - Contribution guidelines

## License

MIT

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.
