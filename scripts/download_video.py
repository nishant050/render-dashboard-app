import os
import sys
import json
import subprocess
import requests
from pytubefix import YouTube

# --- Configuration from Environment Variables ---
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
        report_progress("Fetching video details...", 5)
        yt = YouTube(VIDEO_URL)
        
        report_progress(f"Details found: {yt.title}", 10)
        video_stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_video=True).order_by('resolution').desc().first()
        audio_stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_audio=True).order_by('abr').desc().first()

        temp_dir = "temp_downloads"
        os.makedirs(temp_dir, exist_ok=True)
        
        report_progress(f"Downloading video ({video_stream.resolution})...", 25)
        video_filepath = video_stream.download(output_path=temp_dir)
        
        report_progress("Downloading audio...", 50)
        audio_filepath = audio_stream.download(output_path=temp_dir)

        output_dir = "public/videos"
        os.makedirs(output_dir, exist_ok=True)
        sanitized_title = sanitize_filename(yt.title)
        video_filename = f"{sanitized_title}_{video_stream.resolution}.mp4"
        audio_filename = f"{sanitized_title}_audio.mp3"
        
        final_video_path = os.path.join(output_dir, video_filename)

        report_progress("Merging video and audio...", 75)
        subprocess.run(
            ['ffmpeg', '-i', video_filepath, '-i', audio_filepath, '-c:v', 'copy', '-c:a', 'aac', '-y', final_video_path],
            check=True, capture_output=True, text=True
        )
        
        final_audio_path = os.path.join(output_dir, audio_filename)
        subprocess.run(
            ['ffmpeg', '-i', audio_filepath, '-q:a', '0', '-map', 'a', '-y', final_audio_path],
            check=True, capture_output=True, text=True
        )

        report_progress("Cleaning up...", 95)
        os.remove(video_filepath)
        os.remove(audio_filepath)
        os.rmdir(temp_dir)

        final_file_info = {
            "title": yt.title, "author": yt.author, "videoFile": video_filename,
            "audioFile": audio_filename, "videoPath": f"public/videos/{video_filename}",
            "audioPath": f"public/videos/{audio_filename}",
        }
        update_video_manifest(final_file_info)
        
        report_progress("Download complete! ✅", 100, final_file_info)

    except Exception as e:
        error_message = f"An error occurred: {str(e)}"
        report_progress(error_message, 100) # Report 100 to stop polling on failure
        sys.exit(1)

if __name__ == "__main__":
    main()