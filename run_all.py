"""End-to-end pipeline: select photos -> extract recipes -> export Word."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import config
from recipe_extractor import extract_recipes_from_images
from word_exporter import export_recipes_to_word


def select_photos() -> bool:
    """Use Google Photos API if configured, else browser scraper."""
    if config.CLIENT_SECRET_PATH.exists():
        print("=" * 60)
        print("STEP 1: Connect your Google Photos library")
        print("=" * 60)
        from connect_google_photos import connect_and_select

        try:
            paths = connect_and_select()
            return len(paths) > 0
        except SystemExit:
            return False
        except FileNotFoundError as e:
            print(e)
            return False

    script = Path(__file__).parent / "select_photos_browser.js"
    print("=" * 60)
    print("STEP 1: Select photos from Google Photos (browser mode)")
    print("  Sign in when prompted, then select your photos.")
    print("  Tip: run 'python connect_google_photos.py' for API access.")
    print("=" * 60)
    result = subprocess.run(["node", str(script)], cwd=script.parent)
    return result.returncode == 0


def get_image_paths() -> list[Path]:
    extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    return sorted(
        p for p in config.IMAGES_DIR.iterdir() if p.suffix.lower() in extensions
    )


def main():
    config.CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    config.IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not select_photos():
        print("\nPhoto selection cancelled or failed.")
        sys.exit(1)

    images = get_image_paths()
    if not images:
        print("No images selected.")
        sys.exit(1)

    print(f"\n{'=' * 60}")
    print(f"STEP 2: Extracting recipes from {len(images)} image(s)")
    print("=" * 60)
    recipes = extract_recipes_from_images(images)

    if not recipes:
        print("No recipes found in the images.")
        sys.exit(1)

    print(f"\n{'=' * 60}")
    print(f"STEP 3: Exporting {len(recipes)} recipe(s) to Word")
    print("=" * 60)
    output = config.OUTPUT_DIR / "recipes.docx"
    export_recipes_to_word(recipes, output, config.IMAGES_DIR)
    print(f"\nRecipe collection saved to:\n  {output}")


if __name__ == "__main__":
    main()
