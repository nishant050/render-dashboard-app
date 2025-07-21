import os
import sys
import json
import subprocess
import requests

# --- Configuration ---
JOB_ID = os.environ.get('JOB_ID')
VIDEO_URL = os.environ.get('VIDEO_URL')
RENDER_APP_URL = os.environ.get('RENDER_APP_URL', '').rstrip('/')
PROGRESS_SECRET = os.environ.get('PROGRESS_UPDATE_SECRET')
PROGRESS_URL = f"{RENDER_APP_URL}/api/ytdownloader/update-progress"

# --- Helper Functions ---
def report_progress(message, progress, finalFile=None):
    """Sends a progress update to the Node.js backend."""
    print(f"[Job {JOB_ID}] Progress: {progress}% - {message}")
    try:
        payload = {
            "jobId": JOB_ID, "message": message, "progress": progress,
            "secret": PROGRESS_SECRET
        }
        if finalFile: payload['finalFile'] = finalFile
        requests.post(PROGRESS_URL, json=payload, timeout=10)
    except Exception as e:
        print(f"Warning: Could not report progress to backend: {e}")

def sanitize_filename(title):
    return "".join(c for c in title if c.isalnum() or c in (' ','.','_')).rstrip()

def update_video_manifest(video_info, manifest_path="public/videos.json"):
    videos = []
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r') as f:
                videos = json.load(f)
            if not isinstance(videos, list): videos = []
        except: videos = []
    videos.insert(0, video_info)
    with open(manifest_path, 'w') as f:
        json.dump(videos, f, indent=4)

# --- Main Logic ---
def main():
    if not all([JOB_ID, VIDEO_URL, RENDER_APP_URL, PROGRESS_SECRET]):
        error_msg = "ERROR: Missing one or more environment variables."
        print(error_msg)
        report_progress(error_msg, 100)
        sys.exit(1)

    try:
        temp_dir = "temp_downloads"
        output_dir = "public/videos"
        os.makedirs(temp_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. Get video metadata using yt-dlp
        report_progress("Fetching video metadata...", 10)
        try:
            result = subprocess.run(
                ['yt-dlp', '--dump-json', VIDEO_URL],
                check=True, capture_output=True, text=True, encoding='utf-8'
            )
            metadata = json.loads(result.stdout)
        except subprocess.CalledProcessError as e:
            # THIS IS THE NEW ERROR HANDLING BLOCK
            error_output = e.stderr.strip()
            # Provide a user-friendly error message
            raise Exception(f"Invalid URL or video is unavailable. yt-dlp failed: {error_output}")

        video_title = metadata.get('title', 'Untitled')
        video_author = metadata.get('uploader', 'Unknown Author')
        
        report_progress(f"Details found: {video_title}", 20)
        sanitized_title = sanitize_filename(video_title)
        
        # Define file paths
        video_filename = f"{sanitized_title}_video.mp4"
        audio_filename = f"{sanitized_title}_audio.mp4"
        final_video_filename = f"{sanitized_title}.mp4"
        final_audio_filename = f"{sanitized_title}_audio.mp3"

        temp_video_path = os.path.join(temp_dir, video_filename)
        temp_audio_path = os.path.join(temp_dir, audio_filename)
        final_video_path = os.path.join(output_dir, final_video_filename)
        final_audio_path = os.path.join(output_dir, final_audio_filename)

        # Download best video and audio separately
        report_progress("Downloading video stream...", 30)
        subprocess.run(
            ['yt-dlp', '-f', 'bestvideo[ext=mp4]', '--output', temp_video_path, VIDEO_URL],
            check=True
        )
        
        report_progress("Downloading audio stream...", 60)
        subprocess.run(
            ['yt-dlp', '-f', 'bestaudio[ext=m4a]', '--output', temp_audio_path, VIDEO_URL],
            check=True
        )

        # Merge video and audio with ffmpeg
        report_progress("Merging video and audio...", 80)
        subprocess.run(
            ['ffmpeg', '-i', temp_video_path, '-i', temp_audio_path, '-c:v', 'copy', '-c:a', 'aac', '-y', final_video_path],
            check=True, capture_output=True
        )
        
        # Convert audio to MP3 for separate download
        report_progress("Creating separate audio file...", 90)
        subprocess.run(
            ['ffmpeg', '-i', temp_audio_path, '-q:a', '0', '-map', 'a', '-y', final_audio_path],
            check=True, capture_output=True
        )

        report_progress("Cleaning up...", 95)
        os.remove(temp_video_path)
        os.remove(temp_audio_path)
        os.rmdir(temp_dir)

        final_file_info = {
            "title": video_title, "author": video_author, "videoFile": final_video_filename,
            "audioFile": final_audio_filename, "videoPath": f"public/videos/{final_video_filename}",
            "audioPath": f"public/videos/{final_audio_filename}",
        }
        update_video_manifest(final_file_info)
        
        report_progress("Download complete! ✅", 100, final_file_info)

    except Exception as e:
        error_message = f"An error occurred: {e}"
        report_progress(error_message, 100) # Report 100 to stop polling on failure
        sys.exit(1)

if __name__ == "__main__":
    main()