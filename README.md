# yt-upload

> CLI tool to bulk upload and schedule YouTube videos with one command.

[![npm version](https://img.shields.io/npm/v/yt-upload.svg)](https://www.npmjs.com/package/yt-upload)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Upload an entire folder of videos to YouTube — with scheduling, playlists, deduplication, and dry-run preview. No manual uploading, one video at a time.

## Quick Start

```bash
# 1. Setup (one-time)
npx yt-upload setup --client ./client_secret.json

# 2. Authenticate (opens browser)
npx yt-upload auth

# 3. Upload all videos from a folder
npx yt-upload upload --path ./videos/
```

## Prerequisites

- **Node.js** >= 14
- **Python 3** with pip
- **Google Cloud project** with YouTube Data API v3 enabled

### Get Google Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → APIs & Services → Enable **YouTube Data API v3**
3. Go to Credentials → Create **OAuth 2.0 Client ID** (Desktop app)
4. Download the JSON file (this is your `client_secret.json`)

## Commands

### Setup

```bash
yt-upload setup --client ./client_secret.json
```

Installs Python dependencies and copies credentials to `~/.yt-upload/`.

### Authenticate

```bash
yt-upload auth
```

Opens a browser for one-time Google OAuth login. Token is saved for future use.

### Upload

```bash
# Upload all unuploaded videos from a folder
yt-upload upload --path ./videos/

# Upload a single file
yt-upload upload --file ./my-video.mp4

# Preview without uploading
yt-upload upload --path ./videos/ --dry-run

# Add all uploads to a playlist (creates if not found)
yt-upload upload --path ./videos/ --playlist "JS Tips"
```

### Schedule

```bash
# Schedule 1 video/day starting from a date (6PM UTC)
yt-upload upload --path ./videos/ --schedule 2026-05-01

# Every 2 days
yt-upload upload --path ./videos/ --schedule 2026-05-01 --interval 2

# Auto-schedule 3 videos/day at peak engagement times (8AM, 2PM, 6PM UTC)
yt-upload upload --path ./videos/ --auto

# Auto-schedule starting from a specific date
yt-upload upload --path ./videos/ --auto --auto-from 2026-05-01
```

### List Status

```bash
yt-upload list --path ./videos/
```

Shows which videos have been uploaded, their YouTube URLs, and scheduled times.

## How It Works

1. **Scans** the video folder for `.mp4` files
2. **Deduplicates** — if multiple versions of the same topic exist (by filename), keeps the latest
3. **Skips** already-uploaded videos (tracked in `.yt-upload-history.json` in the videos folder)
4. **Generates metadata** — title from filename, auto-generated description and tags
5. **Uploads** via YouTube Data API v3 with resumable uploads (handles large files)
6. **Optionally schedules** at peak engagement times

### Filename Convention

Videos are expected to follow this naming pattern:

```
YYYYMMDD_HHMMSS_topic_name.mp4
```

The timestamp prefix is stripped to derive the title: `topic_name` → `Topic Name`.

Files without a timestamp prefix are used as-is.

## File Locations

| What | Where |
|------|-------|
| Credentials | `~/.yt-upload/client_secret.json` |
| Auth token | `~/.yt-upload/youtube_token.json` |
| Upload history | `<videos-dir>/.yt-upload-history.json` |

## Related Tools

| Package | Description | Install |
|---------|-------------|---------|
| [load-skill](https://github.com/fix2015/load-skill) | AI coding skills for Claude Code, Cursor, Codex | `npx load-skill` |
| [load-rules](https://github.com/fix2015/load-rules) | AI coding rules for Cursor, Copilot, Claude Code | `npx load-rules` |
| [load-agents](https://github.com/fix2015/load-agents) | AI agent definitions for Claude Code, Codex, Copilot | `npx load-agents` |
| [load-hooks](https://github.com/fix2015/load-hooks) | Hooks for Claude Code and AI coding tools | `npx load-hooks` |
| [load-mcp](https://github.com/fix2015/load-mcp) | MCP servers for Claude Code, Cursor, and more | `npx load-mcp` |

## License

MIT
