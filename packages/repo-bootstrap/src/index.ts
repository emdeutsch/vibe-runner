/**
 * Repo Bootstrap Package
 *
 * Generates the bootstrap files for viberunner gate repos.
 * These files enable HR-gating of Claude Code tools.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '..', 'template');

export interface BootstrapConfig {
  userKey: string;
  publicKey: string;
  ttlSeconds?: number;
}

export interface BootstrapFile {
  path: string;
  content: string;
  executable?: boolean;
}

/**
 * Generate viberunner.config.json content
 */
export function generateConfig(config: BootstrapConfig): string {
  return JSON.stringify({
    version: 1,
    user_key: config.userKey,
    signal_ref_pattern: 'refs/viberunner/hr/{user_key}',
    payload_filename: 'hr-signal.json',
    public_key: config.publicKey,
    public_key_version: 1,
    ttl_seconds: config.ttlSeconds ?? 15,
  }, null, 2);
}

/**
 * Generate .claude/settings.json content
 */
export function generateClaudeSettings(): string {
  return JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: '*',
          hooks: ['./scripts/viberunner-hr-check']
        }
      ]
    }
  }, null, 2);
}

/**
 * Generate CLAUDE.md content
 */
export function generateClaudeMd(config: BootstrapConfig): string {
  const signalRef = `refs/viberunner/hr/${config.userKey}`;

  return `# viberunner HR-Gated Repository

This repository is protected by viberunner. Claude Code tool calls (edit, write, bash, etc.) are gated by the user's live heart rate.

## How it works

- You can **chat anytime** without restrictions
- **Tool calls are blocked** unless the user's heart rate is above their configured threshold
- When tools are locked, you'll see: \`viberunner: HR below threshold — tools locked\`

## When tools are locked

Switch to **planning and review mode**:
- Discuss architecture and design decisions
- Review code and suggest improvements
- Plan implementation steps
- Answer questions about the codebase
- **Don't spam tool calls** — wait for the user to get their HR up!

## Configuration

- User key: \`${config.userKey}\`
- Signal ref: \`${signalRef}\`
- Public key version: 1

## How to disable

To temporarily disable HR gating:
1. Remove or rename the \`.claude/settings.json\` file
2. Tool calls will work normally until you restore the file

## Learn more

Visit [viberunner](https://github.com/viberunner/viberunner) for documentation and support.
`;
}

/**
 * Generate the HR check script
 */
export function generateHrCheckScript(): string {
  return `#!/usr/bin/env bash
#
# viberunner HR check script
# Verifies HR signal is valid before allowing Claude Code tool execution
#
# Exit codes:
#   0 - HR OK, tools unlocked
#   2 - HR check failed, tools locked (Claude Code PreToolUse block code)
#

set -e

CONFIG_FILE="viberunner.config.json"
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Check for required tools
command -v jq >/dev/null 2>&1 || { echo "viberunner: jq not installed — tools locked" >&2; exit 2; }
command -v openssl >/dev/null 2>&1 || { echo "viberunner: openssl not installed — tools locked" >&2; exit 2; }
command -v xxd >/dev/null 2>&1 || { echo "viberunner: xxd not installed — tools locked" >&2; exit 2; }

# Read config
if [[ ! -f "$REPO_ROOT/$CONFIG_FILE" ]]; then
  echo "viberunner: config not found — tools locked" >&2
  exit 2
fi

USER_KEY=$(jq -r '.user_key' "$REPO_ROOT/$CONFIG_FILE")
PUBLIC_KEY=$(jq -r '.public_key' "$REPO_ROOT/$CONFIG_FILE")
TTL_SECONDS=$(jq -r '.ttl_seconds' "$REPO_ROOT/$CONFIG_FILE")
SIGNAL_REF="refs/viberunner/hr/$USER_KEY"

# Validate config values
if [[ -z "$USER_KEY" || "$USER_KEY" == "null" ]]; then
  echo "viberunner: invalid user_key in config — tools locked" >&2
  exit 2
fi

if [[ -z "$PUBLIC_KEY" || "$PUBLIC_KEY" == "null" ]]; then
  echo "viberunner: invalid public_key in config — tools locked" >&2
  exit 2
fi

# Fetch the signal ref from origin
# Use a temporary local ref to avoid conflicts
TEMP_REF="refs/viberunner-check/hr-signal"
if ! git fetch origin "$SIGNAL_REF:$TEMP_REF" --quiet 2>/dev/null; then
  echo "viberunner: HR signal not found (fetch failed) — tools locked" >&2
  exit 2
fi

# Read payload from the ref
PAYLOAD=$(git show "$TEMP_REF:hr-signal.json" 2>/dev/null)
if [[ -z "$PAYLOAD" ]]; then
  echo "viberunner: HR payload missing — tools locked" >&2
  exit 2
fi

# Clean up temp ref
git update-ref -d "$TEMP_REF" 2>/dev/null || true

# Extract fields from payload
V=$(echo "$PAYLOAD" | jq -r '.v')
PAYLOAD_USER_KEY=$(echo "$PAYLOAD" | jq -r '.user_key')
HR_OK=$(echo "$PAYLOAD" | jq -r '.hr_ok')
BPM=$(echo "$PAYLOAD" | jq -r '.bpm')
THRESHOLD_BPM=$(echo "$PAYLOAD" | jq -r '.threshold_bpm')
EXP_UNIX=$(echo "$PAYLOAD" | jq -r '.exp_unix')
NONCE=$(echo "$PAYLOAD" | jq -r '.nonce')
SIG=$(echo "$PAYLOAD" | jq -r '.sig')

# Validate payload structure
if [[ "$V" == "null" || "$PAYLOAD_USER_KEY" == "null" || "$HR_OK" == "null" || \\
      "$BPM" == "null" || "$THRESHOLD_BPM" == "null" || "$EXP_UNIX" == "null" || \\
      "$NONCE" == "null" || "$SIG" == "null" ]]; then
  echo "viberunner: malformed payload — tools locked" >&2
  exit 2
fi

# Validate user_key matches
if [[ "$PAYLOAD_USER_KEY" != "$USER_KEY" ]]; then
  echo "viberunner: user_key mismatch — tools locked" >&2
  exit 2
fi

# Check expiration
NOW=$(date +%s)
if [[ "$EXP_UNIX" -le "$NOW" ]]; then
  EXPIRED_AGO=$((NOW - EXP_UNIX))
  echo "viberunner: HR signal expired \${EXPIRED_AGO}s ago — tools locked" >&2
  exit 2
fi

# Build canonical payload for signature verification
# Must match the signing canonicalization: sorted keys, no whitespace
CANONICAL=$(echo "$PAYLOAD" | jq -cS '{bpm,exp_unix,hr_ok,nonce,threshold_bpm,user_key,v}')

# Create temporary files for signature verification
SIG_BIN=$(mktemp)
PUB_KEY_BIN=$(mktemp)
PUB_KEY_PEM=$(mktemp)
MSG_FILE=$(mktemp)

# Cleanup function
cleanup() {
  rm -f "$SIG_BIN" "$PUB_KEY_BIN" "$PUB_KEY_PEM" "$MSG_FILE"
}
trap cleanup EXIT

# Convert hex signature to binary
echo -n "$SIG" | xxd -r -p > "$SIG_BIN"

# Convert hex public key to binary
echo -n "$PUBLIC_KEY" | xxd -r -p > "$PUB_KEY_BIN"

# Create PEM formatted public key
# Ed25519 public key needs OID prefix: 302a300506032b6570032100
{
  echo "-----BEGIN PUBLIC KEY-----"
  (echo -n "302a300506032b6570032100"; cat "$PUB_KEY_BIN" | xxd -p -c 32) | xxd -r -p | base64
  echo "-----END PUBLIC KEY-----"
} > "$PUB_KEY_PEM"

# Write message to file
echo -n "$CANONICAL" > "$MSG_FILE"

# Verify Ed25519 signature
if ! openssl pkeyutl -verify -pubin -inkey "$PUB_KEY_PEM" -sigfile "$SIG_BIN" -in "$MSG_FILE" -rawin 2>/dev/null; then
  echo "viberunner: invalid signature — tools locked" >&2
  exit 2
fi

# Check hr_ok flag
if [[ "$HR_OK" != "true" ]]; then
  echo "viberunner: HR $BPM below threshold $THRESHOLD_BPM — tools locked" >&2
  exit 2
fi

# All checks passed
# Optionally show status (comment out for silent operation)
# echo "viberunner: HR $BPM >= $THRESHOLD_BPM — tools unlocked"
exit 0
`;
}

/**
 * Generate all bootstrap files for a gate repo
 */
export function generateBootstrapFiles(config: BootstrapConfig): BootstrapFile[] {
  return [
    {
      path: 'viberunner.config.json',
      content: generateConfig(config),
    },
    {
      path: '.claude/settings.json',
      content: generateClaudeSettings(),
    },
    {
      path: 'scripts/viberunner-hr-check',
      content: generateHrCheckScript(),
      executable: true,
    },
    {
      path: 'CLAUDE.md',
      content: generateClaudeMd(config),
    },
  ];
}

/**
 * Read a template file (for files that don't need interpolation)
 */
export function readTemplate(filename: string): string {
  return readFileSync(join(TEMPLATE_DIR, filename), 'utf-8');
}
