"""Build picker manifest from Google Photos Library API."""

from __future__ import annotations

import re

import config

RECIPE_ALBUM_PATTERN = re.compile(
    r"recipe|recipes|cook|food|meal|menu|kitchen|baking|dish",
    re.I,
)


def _thumb_url(base_url: str, size: int = 400) -> str:
    return f"{base_url}=w{size}-h{size}-c"


def _full_url(base_url: str, size: int = 1600) -> str:
    return f"{base_url}=w{size}-h{size}"


def item_to_photo(item: dict, album: str | None = None, category: str = "all") -> dict | None:
    base = item.get("baseUrl")
    if not base:
        return None

    filename = item.get("filename", item["id"][:12])
    return {
        "id": item["id"],
        "src": _full_url(base),
        "thumb": _thumb_url(base),
        "filename": filename,
        "album": album,
        "category": category,
        "source": category,
        "apiItem": item,
    }


def _album_category(title: str) -> str:
    if RECIPE_ALBUM_PATTERN.search(title):
        return "recipes"
    return "all"


def fetch_album_photos(service, album: dict, max_per_album: int = 50) -> list[dict]:
    from google_photos import search_album_photos

    title = album.get("title", "Album")
    category = _album_category(title)
    items = search_album_photos(
        service, album["id"], page_size=50, max_items=max_per_album
    )
    photos = []
    for item in items:
        photo = item_to_photo(item, album=title, category=category)
        if photo:
            photos.append(photo)
    return photos


def fetch_recent(service, limit: int = 80) -> list[dict]:
    from google_photos import search_recent_photos

    items = search_recent_photos(service, limit=limit)
    photos = []
    for item in items:
        photo = item_to_photo(item, album=None, category="all")
        if photo:
            photos.append(photo)
    return photos


def fetch_library_manifest(service, max_photos: int = 200) -> dict:
    from google_photos import list_albums

    print("Connecting to your Google Photos library...")

    albums_raw = list_albums(service)
    album_names = [a["title"] for a in albums_raw]
    print(f"  Found {len(albums_raw)} albums")

    seen_ids: set[str] = set()
    photos: list[dict] = []

    # Recent photos first
    print("  Loading recent photos...")
    for photo in fetch_recent(service, limit=80):
        if photo["id"] not in seen_ids:
            seen_ids.add(photo["id"])
            photos.append(photo)

    # Album photos (prioritize recipe-related albums)
    sorted_albums = sorted(
        albums_raw,
        key=lambda a: (0 if RECIPE_ALBUM_PATTERN.search(a.get("title", "")) else 1),
    )

    for album in sorted_albums:
        if len(photos) >= max_photos:
            break
        title = album.get("title", "Album")
        count = album.get("mediaItemsCount", "?")
        print(f"  Loading album: {title} ({count} photos)")
        for photo in fetch_album_photos(service, album, max_per_album=30):
            if photo["id"] in seen_ids:
                continue
            seen_ids.add(photo["id"])
            photos.append(photo)
            if len(photos) >= max_photos:
                break

    # Tag recipe-related for sidebar counts
    recipe_albums = [a["title"] for a in albums_raw if _album_category(a.get("title", "")) == "recipes"]

    print(f"  Loaded {len(photos)} photos from your library")

    return {
        "photos": photos[:max_photos],
        "albums": album_names[:30],
        "recipeAlbums": recipe_albums,
    }
