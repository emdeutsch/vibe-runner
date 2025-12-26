# vibeworkout Architecture

## Overview

vibeworkout is a distributed system that gates Claude Code tool execution based on real-time heart rate data. This document describes the architecture and data flow.

## Components

### 1. Mobile Apps

#### iOS App (`apps/ios/vibeworkout`)
- **Technology**: SwiftUI, Supabase Swift SDK
- **Responsibilities**:
  - User authentication via Supabase (GitHub OAuth)
  - HR threshold configuration
  - Workout session management
  - Gate repo creation and management
  - Receiving HR data from Watch and forwarding to API
  - GitHub OAuth flow for repo creation

#### watchOS App (`apps/watch/vibeworkout-watch`)
- **Technology**: SwiftUI, HealthKit, WatchConnectivity
- **Responsibilities**:
  - Starting/stopping HKWorkoutSession
  - Reading live heart rate from HealthKit
  - Streaming HR samples to iPhone via WatchConnectivity

### 2. Backend Services

#### API Service (`services/api`)
- **Technology**: Hono (Node.js), Prisma
- **Responsibilities**:
  - JWT authentication (Supabase tokens)
  - Profile management (HR threshold)
  - Workout session lifecycle
  - HR sample ingestion and status calculation
  - GitHub OAuth token management
  - Gate repo CRUD operations
  - GitHub App webhook handling

#### Worker Service (`services/worker`)
- **Technology**: Node.js, Prisma
- **Responsibilities**:
  - Polling for users with active workouts
  - Creating signed HR signal payloads
  - Pushing signal refs to gate repos via GitHub App

### 3. Packages

#### Database Package (`packages/db`)
- Prisma schema for Supabase Postgres
- Generated Prisma client

#### Shared Package (`packages/shared`)
- TypeScript types for API payloads
- Ed25519 signing/verification utilities
- Constants and helpers

#### Repo Bootstrap (`packages/repo-bootstrap`)
- Template files for gate repos
- HR check script
- Claude Code hook configuration

## Data Flow

### HR Capture Flow

```
Apple Watch                 iPhone                    API
    │                         │                        │
    │  Start Workout          │                        │
    │◀────────────────────────│                        │
    │                         │  POST /workout/start   │
    │                         │───────────────────────▶│
    │                         │                        │
    │  HR Sample (BPM)        │                        │
    │────────────────────────▶│  POST /workout/hr      │
    │                         │───────────────────────▶│
    │                         │                        │
    │  (repeat every ~1s)     │                        │
    │                         │                        │
```

### Signal Update Flow

```
Worker                      GitHub
   │                          │
   │  Query active sessions   │
   │  (from database)         │
   │                          │
   │  For each user:          │
   │  - Get latest HR status  │
   │  - Create signed payload │
   │                          │
   │  Push to signal ref      │
   │─────────────────────────▶│
   │  (via GitHub App token)  │
   │                          │
   │  (repeat every ~5s)      │
   │                          │
```

### Tool Execution Flow

```
Claude Code              Gate Repo                GitHub
    │                       │                       │
    │  Tool Call            │                       │
    │──────────────────────▶│                       │
    │                       │                       │
    │  PreToolUse hook      │                       │
    │  vibeworkout-hr-check  │                       │
    │                       │  Fetch signal ref     │
    │                       │──────────────────────▶│
    │                       │◀──────────────────────│
    │                       │                       │
    │                       │  Verify:              │
    │                       │  - Signature          │
    │                       │  - TTL                │
    │                       │  - hr_ok flag         │
    │                       │                       │
    │  Exit 0 (allow)       │                       │
    │◀──────────────────────│  OR                   │
    │                       │                       │
    │  Exit 2 (block)       │                       │
    │◀──────────────────────│                       │
    │                       │                       │
```

## Database Schema

```
profiles
├── user_id (PK, Supabase auth)
├── hr_threshold_bpm
└── timestamps

workout_sessions
├── id (PK)
├── user_id (FK)
├── started_at
├── ended_at
├── source (watch/ble)
└── active

hr_samples
├── id (PK)
├── user_id (FK)
├── session_id (FK)
├── bpm
├── ts
└── source

hr_status (current state, denormalized)
├── user_id (PK)
├── bpm
├── threshold_bpm
├── hr_ok
└── expires_at

github_accounts
├── user_id (PK)
├── github_user_id
└── username

github_tokens (encrypted)
├── user_id (PK)
├── encrypted_access_token
└── scopes

gate_repos
├── id (PK)
├── user_id (FK)
├── owner
├── name
├── user_key
├── signal_ref
├── github_app_installation_id
└── active
```

## Security Considerations

### Authentication
- All API calls require valid Supabase JWT
- JWTs are validated against Supabase service

### GitHub Integration
- User OAuth tokens encrypted with AES-256-GCM
- GitHub App uses installation tokens (short-lived)
- App permissions limited to ref write access

### HR Signal Integrity
- Ed25519 signatures prevent tampering
- 15-second TTL prevents replay attacks
- Nonce provides uniqueness guarantee

### Fail-Closed Design
- Missing signal ref = locked
- Invalid signature = locked
- Expired signal = locked
- hr_ok=false = locked
- Any exception = locked

## Deployment

### Recommended Setup

1. **Database**: Supabase Postgres
2. **API**: Cloudflare Workers / Vercel / Railway
3. **Worker**: Long-running process on Railway / Render
4. **iOS/watchOS**: App Store

### Environment Requirements

- Node.js 20+
- PostgreSQL (via Supabase)
- GitHub OAuth App
- GitHub App with ref write permissions
