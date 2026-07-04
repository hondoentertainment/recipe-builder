"""Google Photos Library API — OAuth and photo download."""

from __future__ import annotations

import json
import re
from pathlib import Path

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

import config


def get_credentials() -> Credentials:
    creds = None
    if config.TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(
            str(config.TOKEN_PATH), [config.PHOTOS_SCOPE]
        )

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not config.CLIENT_SECRET_PATH.exists():
                raise FileNotFoundError(
                    f"Missing OAuth credentials at {config.CLIENT_SECRET_PATH}.\n"
                    "See README.md for setup instructions."
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(config.CLIENT_SECRET_PATH), [config.PHOTOS_SCOPE]
            )
            creds = flow.run_local_server(port=0)

        config.CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
        config.TOKEN_PATH.write_text(creds.to_json())

    return creds


def build_service():
    return build("photoslibrary", "v1", credentials=get_credentials(), static_discovery=False)


def list_albums(service) -> list[dict]:
    albums = []
    token = None
    while True:
        resp = (
            service.albums()
            .list(pageSize=50, pageToken=token)
            .execute()
        )
        albums.extend(resp.get("albums", []))
        token = resp.get("nextPageToken")
        if not token:
            break
    return albums


def find_recipe_albums(albums: list[dict]) -> list[dict]:
    matches = []
    for album in albums:
        title = album.get("title", "").lower()
        if any(term in title for term in config.RECIPE_SEARCH_TERMS):
            matches.append(album)
    return matches


def search_album_photos(service, album_id: str, page_size: int = 50, max_items: int | None = None) -> list[dict]:
    cap = max_items if max_items is not None else config.MAX_PHOTOS
    items = []
    token = None
    while len(items) < cap:
        body = {
            "albumId": album_id,
            "pageSize": min(page_size, cap - len(items)),
        }
        if token:
            body["pageToken"] = token

        resp = service.mediaItems().search(body=body).execute()
        items.extend(resp.get("mediaItems", []))
        token = resp.get("nextPageToken")
        if not token:
            break
    return items[:cap]


def search_recent_photos(service, limit: int | None = None) -> list[dict]:
    limit = limit or config.MAX_PHOTOS
    body = {
        "pageSize": min(limit, 100),
        "filters": {
            "mediaTypeFilter": {"mediaTypes": ["PHOTO"]},
        },
    }
    resp = service.mediaItems().search(body=body).execute()
    return resp.get("mediaItems", [])[:limit]


def safe_filename(name: str, fallback: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "_", name).strip()
    return cleaned or fallback


def download_photo(item: dict, dest_dir: Path) -> Path | None:
    base_url = item.get("baseUrl")
    if not base_url:
        return None

    media_id = item["id"]
    filename = item.get("filename", f"{media_id}.jpg")
    dest = dest_dir / safe_filename(filename, f"{media_id}.jpg")

    if dest.exists():
        return dest

    url = f"{base_url}=d"
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    return dest


def select_and_download(service, dest_dir: Path, interactive: bool = True) -> list[Path]:
    """Download photos — interactively if interactive=True, else auto-select recipe albums."""
    if interactive:
        from photo_selector import interactive_select
        return interactive_select(service, dest_dir)

    dest_dir.mkdir(parents=True, exist_ok=True)

    albums = list_albums(service)
    recipe_albums = find_recipe_albums(albums)

    items: list[dict] = []
    if recipe_albums:
        print(f"Found {len(recipe_albums)} recipe-related album(s):")
        for album in recipe_albums:
            print(f"  - {album['title']} ({album.get('mediaItemsCount', '?')} photos)")
            items.extend(search_album_photos(service, album["id"]))
    else:
        print("No recipe-named albums found. Fetching recent photos instead.")
        items = search_recent_photos(service)

    seen = set()
    unique_items = []
    for item in items:
        if item["id"] not in seen:
            seen.add(item["id"])
            unique_items.append(item)

    unique_items = unique_items[: config.MAX_PHOTOS]
    print(f"Downloading {len(unique_items)} photo(s)...")

    paths = []
    for item in unique_items:
        path = download_photo(item, dest_dir)
        if path:
            paths.append(path)
            print(f"  Saved: {path.name}")

    return paths
