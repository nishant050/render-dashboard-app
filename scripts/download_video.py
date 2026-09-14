import base64
import json
import os
import subprocess
import sys

import requests

# --- Configuration ---
JOB_ID = os.environ.get("JOB_ID")
VIDEO_URL = os.environ.get("VIDEO_URL")
RENDER_APP_URL = os.environ.get("RENDER_APP_URL", "").rstrip("/")
PROGRESS_SECRET = os.environ.get("PROGRESS_UPDATE_SECRET")
PROGRESS_URL = f"{RENDER_APP_URL}/api/ytdownloader/update-progress"


# --- Helper Functions ---
def report_progress(message, progress, finalFile=None):
    """Send progress updates back to the Node.js backend."""
    print(f"[Job {JOB_ID}] Progress: {progress}% - {message}")
    try:
        payload = {
            "jobId": JOB_ID,
            "message": message,
            "progress": progress,
            "secret": PROGRESS_SECRET,
        }
        if finalFile:
            payload["finalFile"] = finalFile
        requests.post(PROGRESS_URL, json=payload, timeout=15)
    except Exception as exc:
        print(f"Warning: Could not report progress to backend: {exc}")


def sanitize_filename(title):
    return "".join(c for c in title if c.isalnum() or c in (" ", ".", "_")).rstrip()


def get_cookie_file_path(temp_dir):
    cookie_b64 = os.environ.get("YOUTUBE_COOKIES_BASE64", "").strip()
    cookie_raw = os.environ.get("YOUTUBE_COOKIES", "").strip()
    if not cookie_b64 and not cookie_raw:
        return None

    cookie_content = cookie_raw
    if cookie_b64:
        try:
            cookie_content = base64.b64decode(cookie_b64).decode("utf-8")
        except Exception as exc:
            raise RuntimeError(f"Invalid YOUTUBE_COOKIES_BASE64 secret: {exc}") from exc

    cookie_path = os.path.join(temp_dir, "youtube_cookies.txt")
    with open(cookie_path, "w", encoding="utf-8", newline="\n") as cookie_file:
        cookie_file.write(cookie_content)
    return cookie_path


def build_yt_dlp_args(cookie_file_path=None):
    args = [
        "--impersonate",
        "chrome:windows-10",
        "--js-runtimes",
        "node",
        "--sleep-interval",
        "2",
        "--max-sleep-interval",
        "5",
        "--limit-rate",
        "15M",
        "--retries",
        "10",
        "--fragment-retries",
        "10",
        "--extractor-retries",
        "5",
        "--no-mtime",
    ]
    if cookie_file_path:
        args.extend(["--cookies", cookie_file_path])
    return args


def update_video_manifest(video_info, manifest_path="public/videos.json"):
    videos = []
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as manifest_file:
                videos = json.load(manifest_file)
            if not isinstance(videos, list):
                videos = []
        except (json.JSONDecodeError, FileNotFoundError):
            videos = []

    videos = [
        item
        for item in videos
        if item.get("videoFile") != video_info.get("videoFile")
        and item.get("audioFile") != video_info.get("audioFile")
    ]
    videos.insert(0, video_info)

    with open(manifest_path, "w", encoding="utf-8") as manifest_file:
        json.dump(videos, manifest_file, indent=4)


# --- Main Logic ---
def main():
    temp_dir = "temp_downloads"
    try:
        output_dir = "public/videos"
        os.makedirs(temp_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)

        cookie_file_path = get_cookie_file_path(temp_dir)
        yt_dlp_args = build_yt_dlp_args(cookie_file_path)

        report_progress("Fetching video metadata...", 10)
        metadata_result = subprocess.run(
            ["yt-dlp", "--dump-json", VIDEO_URL] + yt_dlp_args,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        metadata = json.loads(metadata_result.stdout)

        video_title = metadata.get("title", "Untitled")
        video_author = metadata.get("uploader", "Unknown Author")
        report_progress(f"Details found: {video_title}", 20)

        sanitized_title = sanitize_filename(video_title)
        video_filename = f"{sanitized_title}_video.mp4"
        audio_filename = f"{sanitized_title}_audio.m4a"
        final_video_filename = f"{sanitized_title}.mp4"
        final_audio_filename = f"{sanitized_title}_audio.mp3"

        temp_video_path = os.path.join(temp_dir, video_filename)
        temp_audio_path = os.path.join(temp_dir, audio_filename)
        final_video_path = os.path.join(output_dir, final_video_filename)
        final_audio_path = os.path.join(output_dir, final_audio_filename)

        report_progress("Downloading video stream...", 30)
        subprocess.run(
            ["yt-dlp", "-f", "bestvideo[ext=mp4]", "--output", temp_video_path, VIDEO_URL] + yt_dlp_args,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

        report_progress("Downloading audio stream...", 60)
        subprocess.run(
            ["yt-dlp", "-f", "bestaudio[ext=m4a]", "--output", temp_audio_path, VIDEO_URL] + yt_dlp_args,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

        report_progress("Merging video and audio...", 80)
        subprocess.run(
            ["ffmpeg", "-i", temp_video_path, "-i", temp_audio_path, "-c:v", "copy", "-c:a", "aac", "-y", final_video_path],
            check=True,
            capture_output=True,
        )

        report_progress("Creating separate audio file...", 90)
        subprocess.run(
            ["ffmpeg", "-i", temp_audio_path, "-q:a", "0", "-map", "a", "-y", final_audio_path],
            check=True,
            capture_output=True,
        )

        final_file_info = {
            "title": video_title,
            "author": video_author,
            "videoFile": final_video_filename,
            "audioFile": final_audio_filename,
            "videoPath": f"public/videos/{final_video_filename}",
            "audioPath": f"public/videos/{final_audio_filename}",
        }
        update_video_manifest(final_file_info)
        report_progress("Download complete!", 100, final_file_info)
    except subprocess.CalledProcessError as exc:
        error_output = (exc.stderr or exc.stdout or "").strip()
        error_output = " ".join(error_output.split())
        has_cookie = bool(os.environ.get("YOUTUBE_COOKIES") or os.environ.get("YOUTUBE_COOKIES_BASE64"))
        if "Sign in to confirm you’re not a bot" in error_output and not has_cookie:
            report_progress(
                "An error occurred: yt-dlp failed. YouTube requested bot verification. "
                "Set GitHub secret YOUTUBE_COOKIES or YOUTUBE_COOKIES_BASE64 and retry.",
                100,
            )
        else:
            report_progress(f"An error occurred: yt-dlp failed. {error_output[:1400]}", 100)
        sys.exit(1)
    except Exception as exc:
        report_progress(f"An unexpected error occurred: {exc}", 100)
        sys.exit(1)
    finally:
        if os.path.exists(temp_dir):
            for file_name in os.listdir(temp_dir):
                try:
                    os.remove(os.path.join(temp_dir, file_name))
                except OSError as exc:
                    print(f"Error removing file {file_name}: {exc}")
            try:
                os.rmdir(temp_dir)
            except OSError as exc:
                print(f"Error removing directory {temp_dir}: {exc}")


if __name__ == "__main__":
    main()
