import os
import sys
import json
import subprocess
from pytubefix import YouTube

def sanitize_filename(title):
    """Removes invalid characters from a string to make it a valid filename."""
    return "".join(c for c in title if c.isalnum() or c in (' ', '.', '_')).rstrip()

def combine_video_audio_ffmpeg(video_path, audio_path, output_path):
    """Merges video and audio files using FFmpeg."""
    print("Starting FFmpeg merge process...")
    command = [
        'ffmpeg', '-i', video_path, '-i', audio_path,
        '-c:v', 'copy', '-c:a', 'aac', '-y', output_path
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
        print("FFmpeg merge successful!")
        return output_path
    except subprocess.CalledProcessError as e:
        print(f"ERROR: FFmpeg failed: {e.stderr}")
        return None

def update_video_manifest(video_info, manifest_path="public/videos.json"):
    """Adds a new video's metadata to the JSON manifest file."""
    print(f"Updating manifest file at {manifest_path}")
    
    # Create an empty list in the JSON if it doesn't exist or is invalid
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r') as f:
                videos = json.load(f)
            if not isinstance(videos, list):
                videos = []
        except (json.JSONDecodeError, FileNotFoundError):
            videos = []
    else:
        videos = []
        
    # Add new video and write back to the file
    videos.insert(0, video_info) # Add new videos to the top
    with open(manifest_path, 'w') as f:
        json.dump(videos, f, indent=4)
    print("Manifest updated successfully.")

def download_and_process_video(url, output_dir="public/videos"):
    """Downloads the best quality video, merges it, and updates the manifest."""
    print(f"Fetching video details for: {url}")
    yt = YouTube(url)
    print(f"Fetched video: {yt.title}")

    # 1. Get best video and audio streams
    video_stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_video=True).order_by('resolution').desc().first()
    audio_stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_audio=True).order_by('abr').desc().first()
    
    if not video_stream or not audio_stream:
        print("ERROR: Could not find required video/audio streams.")
        sys.exit(1)

    # 2. Download to a temporary directory
    temp_dir = "temp_downloads"
    os.makedirs(temp_dir, exist_ok=True)
    print(f"Downloading video: {video_stream.resolution}...")
    video_filepath = video_stream.download(output_path=temp_dir)
    print(f"Downloading audio: {audio_stream.abr}...")
    audio_filepath = audio_stream.download(output_path=temp_dir)

    # 3. Define final output path and merge
    os.makedirs(output_dir, exist_ok=True)
    sanitized_title = sanitize_filename(yt.title)
    output_filename = f"{sanitized_title}_{video_stream.resolution}.mp4"
    output_filepath = os.path.join(output_dir, output_filename)
    
    final_path = combine_video_audio_ffmpeg(video_filepath, audio_filepath, output_filepath)

    # 4. Clean up and update manifest if successful
    if final_path:
        print(f"Successfully created final video: {final_path}")
        os.remove(video_filepath)
        os.remove(audio_filepath)
        os.rmdir(temp_dir)
        
        # Add video info to our JSON manifest
        video_info = {
            "title": yt.title,
            "author": yt.author,
            "filename": output_filename,
            "path": f"/public/videos/{output_filename}" # URL path
        }
        update_video_manifest(video_info)
    else:
        print("ERROR: Video processing failed.")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/download_video.py <YOUTUBE_URL>")
        sys.exit(1)
    download_and_process_video(sys.argv[1])