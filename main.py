"""Recipe pipeline: Google Photos -> Vision extraction -> Word document."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import config
from recipe_extractor import Recipe, extract_recipes_from_images, save_recipes_json
from recipe_quality import filter_recipes
from word_exporter import export_recipes_to_word


def select_photos_browser() -> bool:
    script = Path(__file__).parent / "select_photos_browser.js"
    print("=== Step 1: Select photos from Google Photos ===")
    print("A browser will open. Click photos to select, then press Download Selected.\n")
    result = subprocess.run(["node", str(script)], cwd=script.parent)
    return result.returncode == 0


def select_photos_api() -> list[Path]:
    from google_photos import build_service, select_and_download

    print("=== Step 1: Connect to Google Photos ===")
    service = build_service()

    print("\n=== Step 2: Select photos ===")
    return select_and_download(service, config.IMAGES_DIR, interactive=True)


def get_local_images(folder: Path | None = None) -> list[Path]:
    folder = folder or config.IMAGES_DIR
    extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in extensions)


def process_images(
    image_paths: list[Path],
    output_name: str,
    *,
    api_only: bool = False,
    api_delay_seconds: float = 3.0,
) -> Path:
    print(f"\n=== Extract recipes from {len(image_paths)} image(s) ===")
    recipes = extract_recipes_from_images(
        image_paths,
        use_ocr_fallback=not api_only,
        api_delay_seconds=api_delay_seconds,
    )

    if not recipes:
        print("No recipes could be extracted from the images.")
        sys.exit(1)

    stem = Path(output_name).stem
    json_path = config.OUTPUT_DIR / f"{stem}.json"
    save_recipes_json(recipes, json_path)
    print(f"Saved recipe data to {json_path}")

    cleaned, partial, rejected = filter_recipes(recipes)
    print(
        f"Quality filter: {len(cleaned)} cleaned, "
        f"{len(partial)} partial, {len(rejected)} rejected"
    )

    print(f"\n=== Export {len(recipes)} recipe(s) to Word ===")
    output_path = config.OUTPUT_DIR / output_name
    export_recipes_to_word(
        recipes,
        output_path,
        config.IMAGES_DIR,
        doc_title="Recipe Collection (All Extracted)",
        subtitle_note="extracted from photos",
    )

    if cleaned:
        cleaned_path = config.OUTPUT_DIR / f"{stem}_cleaned.docx"
        export_recipes_to_word(
            cleaned,
            cleaned_path,
            config.IMAGES_DIR,
            doc_title="Recipe Collection (Cleaned)",
            subtitle_note="quality-filtered recipes",
        )
        print(f"Cleaned Word document saved to:\n  {cleaned_path}")

    if partial:
        partial_path = config.OUTPUT_DIR / f"{stem}_partial.docx"
        export_recipes_to_word(
            partial,
            partial_path,
            config.IMAGES_DIR,
            doc_title="Recipe Collection (Needs Review)",
            subtitle_note="partial extractions for manual review",
        )
        print(f"Partial review document saved to:\n  {partial_path}")

    print(f"\nDone! Full Word document saved to:\n  {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Build recipes from Google Photos images and export to Word."
    )
    parser.add_argument(
        "--local",
        type=Path,
        help="Skip photo selection; use images from this folder",
    )
    parser.add_argument(
        "--api",
        action="store_true",
        help="Use Google Photos API picker (requires OAuth credentials)",
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Auto-download without selection (legacy behavior)",
    )
    parser.add_argument(
        "--output",
        default="recipes.docx",
        help="Output Word document filename (default: recipes.docx)",
    )
    args = parser.parse_args()

    config.CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    config.IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.local:
        image_paths = get_local_images(args.local)
        if not image_paths:
            print(f"No images found in {args.local}")
            sys.exit(1)
        print(f"Using {len(image_paths)} local image(s)")
    elif args.api:
        image_paths = select_photos_api()
        if not image_paths:
            sys.exit(1)
    elif args.auto:
        from google_photos import build_service, select_and_download
        service = build_service()
        image_paths = select_and_download(service, config.IMAGES_DIR, interactive=False)
        if not image_paths:
            if not select_photos_browser():
                sys.exit(1)
            image_paths = get_local_images()
    else:
        # Default: interactive browser picker
        if not select_photos_browser():
            sys.exit(1)
        image_paths = get_local_images()
        if not image_paths:
            print("No images downloaded.")
            sys.exit(1)

    process_images(image_paths, args.output)


if __name__ == "__main__":
    main()
