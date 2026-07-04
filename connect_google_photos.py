"""Connect Google Photos via API and open the picker UI."""

from __future__ import annotations

import json
import subprocess
import sys
import webbrowser
from pathlib import Path

import config
from google_photos import build_service, download_photo, get_credentials
from google_photos_manifest import fetch_library_manifest

MANIFEST_PATH = config.ROOT / "photos_manifest.json"
SETUP_URLS = [
    "https://console.cloud.google.com/apis/library/photoslibrary.googleapis.com",
    "https://console.cloud.google.com/apis/credentials",
]


def has_api_credentials() -> bool:
    return config.CLIENT_SECRET_PATH.exists()


def has_active_session() -> bool:
    return config.TOKEN_PATH.exists()


def print_setup_guide() -> None:
    print(
        """
╔══════════════════════════════════════════════════════════════╗
║       Connect Your Google Photos (one-time setup)            ║
╚══════════════════════════════════════════════════════════════╝

1. Open Google Cloud Console (opening in browser...)
2. Create a project → enable "Photos Library API"
3. OAuth consent screen → External → add your Gmail as test user
4. Credentials → Create OAuth Client ID → Desktop app
5. Download JSON → save as:

   """
        + str(config.CLIENT_SECRET_PATH)
        + """

Then run again:

   python connect_google_photos.py

"""
    )


def run_setup_wizard() -> bool:
    config.CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    print_setup_guide()
    for url in SETUP_URLS:
        webbrowser.open(url)

    print("Waiting for client_secret.json...")
    print(f"Save the downloaded file to:\n  {config.CLIENT_SECRET_PATH}\n")

    try:
        input("Press Enter after saving client_secret.json (or Ctrl+C to cancel)...")
    except KeyboardInterrupt:
        return False

    return config.CLIENT_SECRET_PATH.exists()


def authorize() -> None:
    print("\nOpening Google sign-in...")
    print("Complete login in the browser window.\n")
    get_credentials()
    print("Google Photos connected.\n")


def download_selection_api(selected: list[dict]) -> list[Path]:
    config.IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    for f in config.IMAGES_DIR.iterdir():
        if f.is_file() and not f.name.startswith("."):
            f.unlink()

    paths = []
    print(f"Downloading {len(selected)} photo(s) at full resolution...")
    for i, photo in enumerate(selected, 1):
        item = photo.get("apiItem")
        if not item:
            continue
        path = download_photo(item, config.IMAGES_DIR)
        if path:
            paths.append(path)
            print(f"  [{i}/{len(selected)}] {path.name}")

    return paths


def open_picker(manifest: dict) -> bool:
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    script = config.ROOT / "select_photos_from_manifest.js"
    result = subprocess.run(
        ["node", str(script), str(MANIFEST_PATH)],
        cwd=config.ROOT,
    )
    return result.returncode == 0


def connect_and_select() -> list[Path]:
    if not has_api_credentials():
        if not run_setup_wizard():
            print("Setup incomplete.")
            sys.exit(1)

    authorize()

    service = build_service()
    manifest = fetch_library_manifest(service)

    if not manifest["photos"]:
        print("No photos found in your Google Photos library.")
        sys.exit(1)

    if not open_picker(manifest):
        print("Selection cancelled.")
        sys.exit(1)

    # Re-download at full resolution via API
    selection_file = config.IMAGES_DIR / ".selection.json"
    if selection_file.exists():
        data = json.loads(selection_file.read_text(encoding="utf-8"))
        selected = data.get("selected", [])
        if selected:
            return download_selection_api(selected)

    # Fallback: use files already in images/
    extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    return sorted(p for p in config.IMAGES_DIR.iterdir() if p.suffix.lower() in extensions)


def main() -> None:
    paths = connect_and_select()
    if paths:
        print(f"\n{len(paths)} photo(s) ready in images/")
    else:
        print("No photos selected.")
        sys.exit(1)


if __name__ == "__main__":
    main()
