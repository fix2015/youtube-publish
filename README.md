# youtube-publish

> CLI tool to bulk upload and schedule YouTube videos with one command.

[![npm version](https://img.shields.io/npm/v/youtube-publish.svg)](https://www.npmjs.com/package/youtube-publish)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Upload an entire folder of videos to YouTube — with scheduling, playlists, filtering, deduplication, and dry-run preview.

## Quick Start

```bash
# 1. Get your Google credentials (step-by-step guide)
npx youtube-publish guide

# 2. Save credentials
npx youtube-publish setup --client ./client_secret.json

# 3. Authenticate (opens browser once)
npx youtube-publish auth

# 4. Upload!
npx youtube-publish upload --path ./videos/
```

## Prerequisites

- **Node.js** >= 14
- **Python 3** with pip
- **Google Cloud project** with YouTube Data API v3 enabled

## Getting Google Credentials

Run `youtube-publish guide` for detailed step-by-step instructions, or:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project
3. Enable **YouTube Data API v3** (APIs & Services → Library)
4. Configure **OAuth consent screen** (External, add yourself as test user)
5. Create **OAuth 2.0 Client ID** (Credentials → Desktop app)
6. Download the JSON file → this is your `client_secret.json`

## Commands

### `guide` — How to get credentials

```bash
youtube-publish guide
```

Prints step-by-step instructions for getting `client_secret.json` from Google Cloud Console.

### `setup` — Save credentials

```bash
youtube-publish setup --client ./client_secret.json
```

Installs Python dependencies and copies your credentials to `~/.youtube-publish/`.

### `auth` — Login with Google

```bash
youtube-publish auth
```

Opens browser for one-time OAuth login. Token auto-refreshes after that.

### `upload` — Upload videos

```bash
# Upload all .mp4 files from a folder
youtube-publish upload --path ./videos/

# Upload a single file
youtube-publish upload --file ./my-video.mp4

# Preview without uploading
youtube-publish upload --path ./videos/ --dry-run

# Only upload videos matching a keyword
youtube-publish upload --path ./videos/ --filter react

# Set privacy (public, unlisted, private)
youtube-publish upload --path ./videos/ --privacy unlisted

# Add to a playlist (creates if not found)
youtube-publish upload --path ./videos/ --playlist "JS Tips"

# Set YouTube category (default: 28 = Science & Tech)
youtube-publish upload --path ./videos/ --category 27
```

### `upload` — Scheduling options

```bash
# Schedule 1 video/day at 6PM UTC starting from a date
youtube-publish upload --path ./videos/ --schedule 2026-05-01

# Every 2 days at 2PM UTC
youtube-publish upload --path ./videos/ --schedule 2026-05-01 --interval 2 --time 14:00

# Auto-schedule 3 videos/day at peak engagement times (8AM, 2PM, 6PM UTC)
youtube-publish upload --path ./videos/ --auto

# Auto-schedule starting from a specific date
youtube-publish upload --path ./videos/ --auto --auto-from 2026-05-01

# Combine filter with schedule
youtube-publish upload --path ./videos/ --filter closure --schedule 2026-05-01
```

### `list` — Check upload status

```bash
youtube-publish list --path ./videos/

# Filter the list
youtube-publish list --path ./videos/ --filter react
```

### `reset` — Clear upload history

```bash
youtube-publish reset --path ./videos/
```

Clears the upload history so videos can be re-uploaded.

## Upload Options Reference

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <dir>` | Videos directory | `./videos` |
| `-f, --file <file>` | Upload single file | — |
| `--filter <keyword>` | Only videos matching keyword in filename | — |
| `-s, --schedule <date>` | Schedule start date (YYYY-MM-DD) | — |
| `-i, --interval <days>` | Days between scheduled uploads | `1` |
| `-t, --time <HH:MM>` | Publish time in UTC | `18:00` |
| `--auto` | Auto-schedule 3/day at peak times | — |
| `--auto-from <date>` | Start date for --auto | tomorrow |
| `--privacy <status>` | public, private, or unlisted | `public` |
| `--playlist <name>` | Playlist name or ID | — |
| `--category <id>` | YouTube category ID | `28` |
| `--dry-run` | Preview without uploading | — |

## YouTube Category IDs

| ID | Category |
|----|----------|
| 22 | People & Blogs |
| 24 | Entertainment |
| 25 | News & Politics |
| 27 | Education |
| 28 | Science & Technology |

## How It Works

1. **Scans** the video folder for `.mp4` files
2. **Filters** by keyword if `--filter` is set
3. **Deduplicates** — keeps only the latest version per topic (by filename)
4. **Skips** already-uploaded videos (tracked in `.yt-upload-history.json`)
5. **Generates metadata** — title from filename, auto-generated description and tags
6. **Uploads** via YouTube Data API v3 with resumable uploads
7. **Optionally schedules** at specified times

### Filename Convention

```
YYYYMMDD_HHMMSS_topic_name.mp4  →  Title: "Topic Name"
my_cool_video.mp4                →  Title: "My Cool Video"
```

## File Locations

| What | Where |
|------|-------|
| Credentials | `~/.youtube-publish/client_secret.json` |
| Auth token | `~/.youtube-publish/youtube_token.json` |
| Upload history | `<videos-dir>/.yt-upload-history.json` |

## License

MIT
