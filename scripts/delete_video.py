import json
import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
VIDEOS_DIR = REPO_ROOT / "public" / "videos"
MANIFEST_PATH = REPO_ROOT / "public" / "videos.json"


def parse_env_list(name):
    raw = os.environ.get(name, "")
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed if isinstance(item, str)]


def parse_targets():
    targets = set()
    for item in parse_env_list("VIDEO_FILES"):
        targets.add(item)
    for item in parse_env_list("AUDIO_FILES"):
        targets.add(item)

    single_video = os.environ.get("VIDEO_FILE", "")
    single_audio = os.environ.get("AUDIO_FILE", "")
    if single_video:
        targets.add(single_video)
    if single_audio:
        targets.add(single_audio)

    sanitized = set()
    for name in targets:
        if (
            name
            and "\0" not in name
            and "/" not in name
            and "\\" not in name
            and Path(name).name == name
        ):
            sanitized.add(name)
    return sanitized


def load_manifest():
    if not MANIFEST_PATH.exists():
        return []
    try:
        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return data


def save_manifest(entries):
    MANIFEST_PATH.write_text(json.dumps(entries, indent=4), encoding="utf-8")


def main():
    targets = parse_targets()
    if not targets:
        print("No valid target files provided. Nothing to delete.")
        return

    deleted = []
    for file_name in targets:
        file_path = VIDEOS_DIR / file_name
        if file_path.exists() and file_path.is_file():
            file_path.unlink()
            deleted.append(file_name)

    manifest = load_manifest()
    filtered = [
        item for item in manifest
        if item.get("videoFile") not in targets and item.get("audioFile") not in targets
    ]
    if filtered != manifest:
        save_manifest(filtered)

    print(f"Deleted files: {deleted}")
    print(f"Manifest entries removed: {len(manifest) - len(filtered)}")


if __name__ == "__main__":
    main()
