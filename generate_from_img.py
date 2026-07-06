"""Convert IMG_*.HEIC photos and generate recipes from all of them."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import pillow_heif
from PIL import Image

import config
from main import get_local_images, process_images

pillow_heif.register_heif_opener()

IMAGE_EXTENSIONS = {".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp"}


def find_img_files(root: Path) -> list[Path]:
    return sorted(
        p
        for p in root.iterdir()
        if p.is_file()
        and p.suffix.lower() in IMAGE_EXTENSIONS
        and re.match(r"^IMG_", p.name, re.IGNORECASE)
    )


def prepare_jpeg(source: Path, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if source.suffix.lower() in {".heic", ".heif"}:
        with Image.open(source) as img:
            rgb = img.convert("RGB")
            rgb.save(dest, "JPEG", quality=90)
        return dest

    if source.suffix.lower() in {".jpg", ".jpeg"}:
        if source.resolve() != dest.resolve():
            dest.write_bytes(source.read_bytes())
        return dest

    with Image.open(source) as img:
        rgb = img.convert("RGB")
        rgb.save(dest, "JPEG", quality=90)
    return dest


def convert_all_img_to_jpeg(sources: list[Path], output_dir: Path) -> list[Path]:
    prepared: list[Path] = []

    for i, source in enumerate(sources, 1):
        stem = re.sub(r"\s+\(\d+\)$", "", source.stem)
        dest = output_dir / f"{stem}.jpg"
        if dest.exists() and dest.stat().st_mtime >= source.stat().st_mtime:
            prepared.append(dest)
            continue

        print(f"Converting {i}/{len(sources)}: {source.name}")
        try:
            prepared.append(prepare_jpeg(source, dest))
        except Exception as exc:
            print(f"  -> Skipped ({exc})")

    return sorted(set(prepared))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate recipes from IMG photos.")
    parser.add_argument(
        "--api-only",
        action="store_true",
        help="Use vision API only (no OCR fallback)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=3.0,
        help="Seconds to wait between API calls (default: 3)",
    )
    parser.add_argument(
        "--skip-convert",
        action="store_true",
        help="Use existing JPEGs in images/ folder",
    )
    args = parser.parse_args()

    config.IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.skip_convert:
        image_paths = get_local_images()
        image_paths = [p for p in image_paths if p.name.upper().startswith("IMG_")]
        if not image_paths:
            print("No IMG_*.jpg files found in images/")
            sys.exit(1)
        print(f"Using {len(image_paths)} existing JPEG(s)")
    else:
        sources = find_img_files(config.ROOT)
        if not sources:
            print("No IMG_* image files found in project root.")
            sys.exit(1)

        print(f"Found {len(sources)} IMG image(s)")
        image_paths = convert_all_img_to_jpeg(sources, config.IMAGES_DIR)
        if not image_paths:
            print("No images could be prepared for processing.")
            sys.exit(1)
        print(f"Prepared {len(image_paths)} JPEG(s) in {config.IMAGES_DIR}")

    process_images(
        image_paths,
        "recipes_from_img.docx",
        api_only=args.api_only,
        api_delay_seconds=args.delay,
    )


if __name__ == "__main__":
    main()
