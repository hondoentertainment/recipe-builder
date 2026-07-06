"""Build cleaned recipe exports from an existing Word document or JSON file."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import config
from recipe_extractor import Recipe, load_recipes_json, save_recipes_json
from recipe_quality import filter_recipes, score_recipe
from word_exporter import export_recipes_to_word


def recipes_from_docx(docx_path: Path) -> list[Recipe]:
    from docx import Document

    doc = Document(str(docx_path))
    recipes: list[Recipe] = []
    current: dict | None = None

    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        style = paragraph.style.name if paragraph.style else ""

        if style == "Heading 1":
            if current:
                current.pop("_section", None)
                recipes.append(Recipe(**current))
            current = {
                "title": text,
                "description": "",
                "servings": None,
                "prep_time": None,
                "cook_time": None,
                "ingredients": [],
                "instructions": [],
                "notes": "",
                "source_image": "",
                "is_recipe": True,
            }
        elif current and style == "Heading 2":
            current["_section"] = text.lower()
        elif current and style == "List Bullet":
            current["ingredients"].append(text)
        elif current and current.get("_section") == "instructions":
            if text and text[0].isdigit():
                step = text.split(". ", 1)[-1] if ". " in text else text
                current["instructions"].append(step)
        elif current and ("Servings:" in text or "Prep:" in text or "Cook:" in text):
            for part in text.split(" | "):
                if part.startswith("Servings:"):
                    current["servings"] = part.replace("Servings:", "").strip()
                elif part.startswith("Prep:"):
                    current["prep_time"] = part.replace("Prep:", "").strip()
                elif part.startswith("Cook:"):
                    current["cook_time"] = part.replace("Cook:", "").strip()

    if current:
        current.pop("_section", None)
        recipes.append(Recipe(**current))

    return recipes


def load_source_image_map(log_path: Path | None = None) -> dict[str, str]:
    """Map recipe titles to source filenames from an extraction log."""
    mapping: dict[str, str] = {}
    candidates = [
        log_path,
        config.OUTPUT_DIR / "extraction.log",
        config.ROOT / "extraction.log",
    ]
    for path in candidates:
        if not path or not path.exists():
            continue
        current_image = ""
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if "Analyzing image" in line and ": IMG_" in line:
                current_image = line.rsplit(": ", 1)[-1].strip()
            elif "-> Recipe:" in line and current_image:
                title = line.split("-> Recipe:", 1)[1].strip()
                mapping[title] = current_image
        if mapping:
            break
    return mapping


def apply_source_images(recipes: list[Recipe], mapping: dict[str, str]) -> None:
    for recipe in recipes:
        if not recipe.source_image and recipe.title in mapping:
            recipe.source_image = mapping[recipe.title]


def export_filtered_sets(recipes: list[Recipe], stem: str) -> None:
    apply_source_images(recipes, load_source_image_map())
    cleaned, partial, rejected = filter_recipes(recipes)
    json_path = config.OUTPUT_DIR / f"{stem}.json"
    save_recipes_json(recipes, json_path)

    print(f"Loaded {len(recipes)} recipes")
    print(
        f"Quality filter: {len(cleaned)} cleaned, "
        f"{len(partial)} partial, {len(rejected)} rejected"
    )

    if cleaned:
        path = config.OUTPUT_DIR / f"{stem}_cleaned.docx"
        export_recipes_to_word(
            cleaned,
            path,
            config.IMAGES_DIR,
            doc_title="Recipe Collection (Cleaned)",
            subtitle_note="quality-filtered recipes",
        )
        print(f"Cleaned: {path.resolve()}")
        print("Top cleaned recipes:")
        for recipe in cleaned[:10]:
            print(f"  - {recipe.title} (score {score_recipe(recipe)})")

    if partial:
        path = config.OUTPUT_DIR / f"{stem}_partial.docx"
        export_recipes_to_word(
            partial,
            path,
            config.IMAGES_DIR,
            doc_title="Recipe Collection (Needs Review)",
            subtitle_note="partial extractions for manual review",
        )
        print(f"Partial: {path.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build cleaned recipe Word exports.")
    parser.add_argument(
        "--input",
        type=Path,
        default=config.OUTPUT_DIR / "recipes_from_img.docx",
        help="Source Word document or JSON file",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Input not found: {args.input}")
        sys.exit(1)

    if args.input.suffix.lower() == ".json":
        recipes = load_recipes_json(args.input)
        stem = args.input.stem
    else:
        recipes = recipes_from_docx(args.input)
        stem = args.input.stem

    if not recipes:
        print("No recipes found in input.")
        sys.exit(1)

    export_filtered_sets(recipes, stem)


if __name__ == "__main__":
    main()
