"""Re-extract recipes via vision API when quota is available."""

from __future__ import annotations

import argparse
import sys

import requests

import config
from main import get_local_images, process_images
from recipe_extractor import api_endpoint, prepare_image_bytes
import base64


def api_is_ready() -> bool:
    images = [p for p in get_local_images() if p.name.upper().startswith("IMG_")]
    if not images:
        return False

    data, mime = prepare_image_bytes(images[0])
    resp = requests.post(
        api_endpoint(),
        json={
            "imageBase64": base64.b64encode(data).decode(),
            "mimeType": mime,
            "filename": images[0].name,
        },
        timeout=90,
    )
    return resp.status_code == 200


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-extract IMG recipes using vision API.")
    parser.add_argument("--delay", type=float, default=5.0, help="Seconds between API calls")
    parser.add_argument("--force", action="store_true", help="Run even if API test fails")
    args = parser.parse_args()

    if not args.force and not api_is_ready():
        print("Vision API is not ready (rate limit or quota).")
        print("Cleaned exports are already available in output/.")
        print("Retry later with: python retry_api_extraction.py")
        sys.exit(0)

    image_paths = [p for p in get_local_images() if p.name.upper().startswith("IMG_")]
    print(f"Re-extracting {len(image_paths)} IMG image(s) via vision API...")
    process_images(
        image_paths,
        "recipes_from_img.docx",
        api_only=True,
        api_delay_seconds=args.delay,
    )


if __name__ == "__main__":
    main()
