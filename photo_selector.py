"""Interactive photo selection for Google Photos API."""

from __future__ import annotations

import re
from pathlib import Path

import config
from google_photos import (
    download_photo,
    list_albums,
    safe_filename,
    search_album_photos,
    search_recent_photos,
)


def _prompt(message: str) -> str:
    return input(message).strip()


def _parse_selection(raw: str, max_index: int) -> list[int]:
    """Parse '1,3,5-8' or 'all' into 1-based indices."""
    raw = raw.strip().lower()
    if raw in ("all", "a", "*"):
        return list(range(1, max_index + 1))

    indices: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            for i in range(int(start), int(end) + 1):
                if 1 <= i <= max_index:
                    indices.add(i)
        else:
            i = int(part)
            if 1 <= i <= max_index:
                indices.add(i)
    return sorted(indices)


def select_album(service) -> str | None:
    albums = list_albums(service)
    if not albums:
        print("No albums found.")
        return None

    print("\nYour albums:")
    print("  0. All recent photos (no album filter)")
    for i, album in enumerate(albums, 1):
        count = album.get("mediaItemsCount", "?")
        print(f"  {i}. {album['title']} ({count} photos)")

    choice = _prompt("\nChoose an album number (or 0 for recent): ")
    if choice == "0":
        return None

    idx = int(choice)
    if 1 <= idx <= len(albums):
        return albums[idx - 1]["id"]
    print("Invalid choice.")
    return None


def list_photos_for_selection(service, album_id: str | None, limit: int = 100) -> list[dict]:
    if album_id:
        return search_album_photos(service, album_id, page_size=50, max_items=limit)
    return search_recent_photos(service, limit=limit)


def display_photos(items: list[dict]) -> None:
    print(f"\n{len(items)} photo(s) available:\n")
    for i, item in enumerate(items, 1):
        name = item.get("filename", item["id"][:12])
        date = ""
        meta = item.get("mediaMetadata", {})
        if meta.get("creationTime"):
            date = meta["creationTime"][:10]
        desc = item.get("description", "")
        label = f"{name}"
        if date:
            label += f"  ({date})"
        if desc:
            label += f"  — {desc[:40]}"
        print(f"  {i:3}. {label}")


def interactive_select(service, dest_dir: Path) -> list[Path]:
    """Let user pick one or many photos from Google Photos."""
    dest_dir.mkdir(parents=True, exist_ok=True)

    album_id = select_album(service)
    items = list_photos_for_selection(service, album_id, limit=100)

    if not items:
        print("No photos found in this album.")
        return []

    display_photos(items)

    print("\nEnter photo numbers to select (examples: 1 | 1,3,5 | 2-6 | all):")
    raw = _prompt("> ")
    indices = _parse_selection(raw, len(items))

    if not indices:
        print("No valid selection.")
        return []

    selected = [items[i - 1] for i in indices]
    print(f"\nDownloading {len(selected)} selected photo(s)...")

    paths = []
    for item in selected:
        path = download_photo(item, dest_dir)
        if path:
            paths.append(path)
            print(f"  Saved: {path.name}")

    return paths


def select_by_indices(items: list[dict], indices: list[int], dest_dir: Path) -> list[Path]:
    """Non-interactive selection by 1-based indices."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    selected = [items[i - 1] for i in indices if 1 <= i <= len(items)]
    paths = []
    for item in selected:
        path = download_photo(item, dest_dir)
        if path:
            paths.append(path)
    return paths
