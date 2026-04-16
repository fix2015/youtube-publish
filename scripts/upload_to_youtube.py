#!/usr/bin/env python3
"""
YouTube Video Uploader with Scheduling

Uploads videos from a folder to YouTube with title, description,
tags, and optional scheduling. Called by the youtube-publish Node.js CLI.

Config dir: ~/.youtube-publish/ (via YT_UPLOAD_CONFIG_DIR env)
Videos dir: via YT_UPLOAD_VIDEOS_DIR env or ./videos/
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# ============ CONFIG ============
CONFIG_DIR = Path(os.environ.get("YT_UPLOAD_CONFIG_DIR", Path.home() / ".youtube-publish"))
VIDEOS_DIR = Path(os.environ.get("YT_UPLOAD_VIDEOS_DIR", Path.cwd() / "videos"))

CLIENT_SECRET = CONFIG_DIR / "client_secret.json"
TOKEN_FILE = CONFIG_DIR / "youtube_token.json"
UPLOAD_HISTORY = VIDEOS_DIR / ".yt-upload-history.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]

DEFAULT_CATEGORY = "28"
DEFAULT_PRIVACY = "public"
DEFAULT_LANGUAGE = "en"

BEST_TIMES_UTC = [
    (8, 0),
    (14, 0),
    (18, 0),
]


# ============ AUTH ============
def get_youtube_service():
    creds = None

    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CLIENT_SECRET.exists():
                print("client_secret.json not found!")
                print(f"   Expected at: {CLIENT_SECRET}")
                print("   Run: youtube-publish guide")
                sys.exit(1)

            flow = InstalledAppFlow.from_client_secrets_file(
                str(CLIENT_SECRET), SCOPES
            )
            creds = flow.run_local_server(port=8080)

        TOKEN_FILE.write_text(creds.to_json())
        print("Authentication saved!")

    return build("youtube", "v3", credentials=creds)


# ============ HISTORY ============
def load_history():
    if UPLOAD_HISTORY.exists():
        return json.loads(UPLOAD_HISTORY.read_text())
    return {"uploaded": {}}


def save_history(history):
    UPLOAD_HISTORY.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_HISTORY.write_text(json.dumps(history, indent=2, default=str))


# ============ VIDEO METADATA ============
def get_topic_slug(video_path: Path) -> str:
    parts = video_path.stem.split("_", 2)
    if len(parts) >= 3 and parts[0].isdigit() and parts[1].isdigit():
        return parts[2]
    return video_path.stem


def get_video_metadata(video_path: Path) -> dict:
    topic_slug = get_topic_slug(video_path)
    title = topic_slug.replace("_", " ").title()
    description = generate_description(title, topic_slug)
    tags = generate_tags(topic_slug)
    return {"title": title, "description": description, "tags": tags}


def generate_description(title: str, slug: str) -> str:
    return f"""{title} — explained in under 60 seconds.

Subscribe for daily tips!
Code examples in every video
Perfect for interviews and leveling up

#JavaScript #AI #WebDev #Coding #Programming #TechTips"""


def generate_tags(slug: str) -> list:
    base_tags = [
        "javascript", "coding", "programming", "webdev",
        "ai", "machine learning", "tech tips", "coding tips",
        "javascript tutorial", "learn to code", "developer",
        "software engineering", "interview questions"
    ]

    slug_lower = slug.lower()
    tag_rules = {
        "rag": ["RAG", "retrieval augmented generation", "LLM", "vector database"],
        "promise": ["promises", "async await", "javascript promises"],
        "closure": ["closures", "javascript closures", "scope"],
        "react": ["react", "reactjs", "frontend", "hooks"],
        "node": ["nodejs", "backend", "server"],
        "python": ["python", "python tutorial"],
        "type": ["type coercion", "javascript types"],
        "coercion": ["type coercion", "javascript types"],
        "event": ["event loop", "async", "microtask"],
        "loop": ["event loop", "async", "microtask"],
        "css": ["css", "frontend", "web design"],
        "api": ["api", "rest", "backend"],
        "docker": ["docker", "devops", "containers"],
        "git": ["git", "version control", "github"],
        "sql": ["sql", "database", "backend"],
        "mongo": ["mongodb", "nosql", "database"],
        "next": ["nextjs", "react", "fullstack"],
        "vue": ["vuejs", "frontend", "javascript framework"],
        "angular": ["angular", "frontend", "typescript"],
    }

    for keyword, extra_tags in tag_rules.items():
        if keyword in slug_lower:
            base_tags.extend(extra_tags)

    return list(dict.fromkeys(base_tags))[:30]  # dedupe, max 30


# ============ UPLOAD ============
def upload_video(youtube, video_path: Path, metadata: dict,
                 publish_at=None, dry_run=False, privacy="public", category="28"):
    actual_privacy = "private" if publish_at else privacy

    body = {
        "snippet": {
            "title": metadata["title"][:100],
            "description": metadata["description"][:5000],
            "tags": metadata["tags"],
            "categoryId": category,
            "defaultLanguage": DEFAULT_LANGUAGE,
        },
        "status": {
            "privacyStatus": actual_privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    if publish_at:
        body["status"]["publishAt"] = publish_at.isoformat()
        body["status"]["privacyStatus"] = "private"

    if dry_run:
        print(f"\n{'='*50}")
        print(f"  WOULD UPLOAD: {video_path.name}")
        print(f"  Title: {metadata['title']}")
        print(f"  Privacy: {actual_privacy}")
        if publish_at:
            print(f"  Scheduled: {publish_at.strftime('%Y-%m-%d %H:%M UTC')}")
        print(f"  Category: {category}")
        print(f"  Tags: {', '.join(metadata['tags'][:5])}...")
        print(f"  Description: {metadata['description'][:80]}...")
        print(f"{'='*50}")
        return None

    print(f"  Uploading: {video_path.name}...")
    print(f"  Title: {metadata['title']}")
    if publish_at:
        print(f"  Scheduled: {publish_at.strftime('%Y-%m-%d %H:%M UTC')}")

    media = MediaFileUpload(
        str(video_path),
        mimetype="video/mp4",
        resumable=True,
        chunksize=1024 * 1024 * 10,
    )

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            pct = int(status.progress() * 100)
            print(f"    {pct}% uploaded...")

    video_id = response["id"]
    print(f"  Uploaded! https://youtube.com/watch?v={video_id}")
    return video_id


# ============ PLAYLIST ============
def find_playlist_by_name(youtube, name: str) -> str:
    request = youtube.playlists().list(part="snippet", mine=True, maxResults=50)
    response = request.execute()
    for item in response.get("items", []):
        if item["snippet"]["title"].lower() == name.lower():
            return item["id"]
    return None


def create_playlist(youtube, name: str) -> str:
    request = youtube.playlists().insert(
        part="snippet,status",
        body={
            "snippet": {"title": name, "description": f"{name} — video series"},
            "status": {"privacyStatus": "public"},
        },
    )
    response = request.execute()
    playlist_id = response["id"]
    print(f"  Created playlist '{name}' ({playlist_id})")
    return playlist_id


def add_to_playlist(youtube, playlist_id: str, video_id: str):
    try:
        youtube.playlistItems().insert(
            part="snippet",
            body={
                "snippet": {
                    "playlistId": playlist_id,
                    "resourceId": {"kind": "youtube#video", "videoId": video_id},
                },
            },
        ).execute()
        print(f"  Added to playlist")
    except Exception as e:
        print(f"  Playlist error: {e}")


def resolve_playlist(youtube, playlist_arg: str) -> str:
    if playlist_arg.startswith("PL"):
        return playlist_arg
    playlist_id = find_playlist_by_name(youtube, playlist_arg)
    if playlist_id:
        print(f"  Found playlist '{playlist_arg}' ({playlist_id})")
        return playlist_id
    return create_playlist(youtube, playlist_arg)


# ============ AUTO SCHEDULE ============
def calculate_auto_schedule(num_videos: int, start_date: datetime = None) -> list:
    if not start_date:
        start_date = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)

    schedule = []
    video_idx = 0
    current_day = start_date

    while video_idx < num_videos:
        for hour, minute in BEST_TIMES_UTC:
            if video_idx >= num_videos:
                break
            publish_time = current_day.replace(hour=hour, minute=minute)
            if publish_time <= datetime.now(timezone.utc):
                continue
            schedule.append(publish_time)
            video_idx += 1
        current_day += timedelta(days=1)

    return schedule


# ============ COLLECT VIDEOS ============
def collect_videos(history, filter_keyword=None):
    all_mp4s = sorted(VIDEOS_DIR.glob("*.mp4"))

    # Apply filter
    if filter_keyword:
        kw = filter_keyword.lower()
        all_mp4s = [v for v in all_mp4s if kw in v.stem.lower()]

    # Deduplicate: keep latest version per topic
    topic_latest = {}
    for v in all_mp4s:
        topic_slug = get_topic_slug(v)
        topic_latest[topic_slug] = v

    # Filter out already uploaded
    uploaded_topics = set()
    for fname in history.get("uploaded", {}):
        parts = fname.replace(".mp4", "").split("_", 2)
        if len(parts) >= 3 and parts[0].isdigit() and parts[1].isdigit():
            uploaded_topics.add(parts[2])
        else:
            uploaded_topics.add(fname.replace(".mp4", ""))

    videos = [v for slug, v in sorted(topic_latest.items()) if slug not in uploaded_topics]

    if videos:
        print(f"  {len(all_mp4s)} files -> {len(topic_latest)} unique topics -> {len(videos)} to upload")

    return videos, all_mp4s


# ============ MAIN ============
def main():
    parser = argparse.ArgumentParser(description="YouTube Video Uploader")
    parser.add_argument("--auth", action="store_true", help="Authenticate only")
    parser.add_argument("--file", type=str, help="Upload specific video file")
    parser.add_argument("--filter", type=str, help="Only process videos matching keyword")
    parser.add_argument("--schedule", type=str, help="Schedule start date (YYYY-MM-DD)")
    parser.add_argument("--auto", action="store_true", help="Auto-upload 3/day at peak times")
    parser.add_argument("--auto-from", type=str, help="Auto schedule start date (YYYY-MM-DD)")
    parser.add_argument("--interval", type=int, default=1, help="Days between uploads (default: 1)")
    parser.add_argument("--time", type=str, default="18:00", help="Publish time UTC (HH:MM, default: 18:00)")
    parser.add_argument("--privacy", type=str, default="public", help="Privacy: public, private, unlisted")
    parser.add_argument("--category", type=str, default="28", help="YouTube category ID (default: 28)")
    parser.add_argument("--playlist", type=str, help="Add to playlist (name or ID)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without uploading")
    parser.add_argument("--list", action="store_true", help="Show upload status")
    args = parser.parse_args()

    # Ensure videos dir exists
    if not args.auth and not VIDEOS_DIR.exists():
        print(f"Videos directory not found: {VIDEOS_DIR}")
        print(f"   Create it or use: youtube-publish upload --path /your/videos/")
        sys.exit(1)

    history = load_history()

    # ---- LIST MODE ----
    if args.list:
        mp4s = sorted(VIDEOS_DIR.glob("*.mp4"))
        if args.filter:
            kw = args.filter.lower()
            mp4s = [v for v in mp4s if kw in v.stem.lower()]

        print(f"\nVideos in {VIDEOS_DIR} ({len(mp4s)} total):\n")
        for v in mp4s:
            status_icon = "[uploaded]" if v.name in history["uploaded"] else "[pending] "
            meta = get_video_metadata(v)
            info = history["uploaded"].get(v.name, {})
            yt_url = info.get("url", "")
            sched = info.get("scheduled_for", "")
            print(f"  {status_icon} {meta['title']}")
            if yt_url:
                print(f"              {yt_url}")
            if sched:
                print(f"              Scheduled: {sched[:16]}")
        uploaded = sum(1 for v in mp4s if v.name in history["uploaded"])
        print(f"\n  {uploaded}/{len(mp4s)} uploaded")
        return

    # ---- AUTH MODE ----
    youtube = get_youtube_service()
    if args.auth:
        print("Authenticated successfully!")
        return

    # ---- COLLECT VIDEOS ----
    if args.file:
        video_path = Path(args.file)
        if not video_path.exists():
            video_path = VIDEOS_DIR / args.file
        if not video_path.exists():
            print(f"File not found: {args.file}")
            sys.exit(1)
        videos = [video_path]
    else:
        videos, _ = collect_videos(history, args.filter)
        if not videos:
            print("All videos already uploaded!")
            return

    print(f"\n{len(videos)} video(s) to upload\n")

    # Resolve playlist
    playlist_id = None
    if args.playlist:
        if not args.dry_run:
            playlist_id = resolve_playlist(youtube, args.playlist)
        else:
            print(f"Would add to playlist: '{args.playlist}'\n")

    # Parse time
    try:
        time_parts = args.time.split(":")
        schedule_hour = int(time_parts[0])
        schedule_minute = int(time_parts[1]) if len(time_parts) > 1 else 0
    except (ValueError, IndexError):
        print(f"Invalid time format: {args.time}. Use HH:MM (e.g. 14:00)")
        sys.exit(1)

    # ---- AUTO MODE ----
    if args.auto:
        start_date = None
        if args.auto_from:
            start_date = datetime.strptime(args.auto_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)

        schedule_times = calculate_auto_schedule(len(videos), start_date)
        total_days = (schedule_times[-1] - schedule_times[0]).days + 1 if schedule_times else 0

        print(f"Auto-schedule: 3 videos/day at peak times")
        print(f"   Times (UTC): {', '.join(f'{h}:{m:02d}' for h, m in BEST_TIMES_UTC)}")
        print(f"   Start: {schedule_times[0].strftime('%Y-%m-%d') if schedule_times else 'N/A'}")
        print(f"   End:   {schedule_times[-1].strftime('%Y-%m-%d') if schedule_times else 'N/A'}")
        print(f"   Videos: {len(videos)} over {total_days} days\n")

        for i, video_path in enumerate(videos):
            metadata = get_video_metadata(video_path)
            publish_at = schedule_times[i]

            video_id = upload_video(
                youtube, video_path, metadata,
                publish_at=publish_at, dry_run=args.dry_run,
                privacy=args.privacy, category=args.category,
            )

            if video_id and not args.dry_run:
                if playlist_id:
                    add_to_playlist(youtube, playlist_id, video_id)
                history["uploaded"][video_path.name] = {
                    "id": video_id,
                    "url": f"https://youtube.com/watch?v={video_id}",
                    "title": metadata["title"],
                    "uploaded_at": datetime.now(timezone.utc).isoformat(),
                    "scheduled_for": publish_at.isoformat(),
                    "playlist": args.playlist or "",
                }
                save_history(history)

        print(f"\nDone! {len(videos)} video(s) scheduled across {total_days} days.")
        return

    # ---- SCHEDULE MODE ----
    schedule_date = None
    if args.schedule:
        schedule_date = datetime.strptime(args.schedule, "%Y-%m-%d").replace(
            hour=schedule_hour, minute=schedule_minute, second=0, tzinfo=timezone.utc
        )

    # Upload each video
    for i, video_path in enumerate(videos):
        metadata = get_video_metadata(video_path)
        publish_at = None
        if schedule_date:
            publish_at = schedule_date + timedelta(days=i * args.interval)

        video_id = upload_video(
            youtube, video_path, metadata,
            publish_at=publish_at, dry_run=args.dry_run,
            privacy=args.privacy, category=args.category,
        )

        if video_id and not args.dry_run:
            if playlist_id:
                add_to_playlist(youtube, playlist_id, video_id)
            history["uploaded"][video_path.name] = {
                "id": video_id,
                "url": f"https://youtube.com/watch?v={video_id}",
                "title": metadata["title"],
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "scheduled_for": publish_at.isoformat() if publish_at else None,
                "playlist": args.playlist or "",
            }
            save_history(history)

    print(f"\nDone! {len(videos)} video(s) processed.")


if __name__ == "__main__":
    main()
