"""Export recipe catalog JSON and images for the web UX."""

from __future__ import annotations

import json
import re
import shutil
import sys
from dataclasses import asdict
from pathlib import Path

import config
from recipes_data import CURATED
from recipe_extractor import Recipe, load_recipes_json
from recipe_quality import filter_recipes, score_recipe

ROOT = config.ROOT
RECIPES_WEB_DIR = ROOT / "recipes"
DATA_DIR = RECIPES_WEB_DIR / "data"
IMAGES_DIR = RECIPES_WEB_DIR / "images"


def slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug[:60] or "recipe"


def recipe_to_web(recipe: Recipe, quality: str, recipe_id: str | None = None) -> dict:
    rid = recipe_id or slugify(recipe.title)
    image_name = recipe.source_image or ""
    return {
        "id": rid,
        "title": recipe.title,
        "description": recipe.description,
        "servings": recipe.servings,
        "prep_time": recipe.prep_time,
        "cook_time": recipe.cook_time,
        "ingredients": recipe.ingredients,
        "instructions": recipe.instructions,
        "notes": recipe.notes,
        "source_image": image_name,
        "image": f"/recipes/images/{image_name}" if image_name else None,
        "quality": quality,
        "score": score_recipe(recipe),
    }


def copy_image(filename: str, seen: set[str]) -> None:
    if not filename or filename in seen:
        return
    src = config.IMAGES_DIR / filename
    if not src.exists():
        return
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, IMAGES_DIR / filename)
    seen.add(filename)


def build_catalog() -> list[dict]:
    catalog: list[dict] = []
    seen_ids: set[str] = set()
    seen_images: set[str] = set()

    for recipe in CURATED:
        rid = slugify(recipe.title)
        if rid in seen_ids:
            rid = f"{rid}-{len(seen_ids)}"
        seen_ids.add(rid)
        catalog.append(recipe_to_web(recipe, "curated", rid))
        copy_image(recipe.source_image, seen_images)

    cleaned_path = config.OUTPUT_DIR / "recipes_from_img.json"
    if cleaned_path.exists():
        all_recipes = load_recipes_json(cleaned_path)
        cleaned, partial, _ = filter_recipes(all_recipes)
        curated_titles = {r.title for r in CURATED}

        for recipe in cleaned:
            if recipe.title in curated_titles:
                continue
            rid = slugify(recipe.title)
            base = rid
            n = 1
            while rid in seen_ids:
                rid = f"{base}-{n}"
                n += 1
            seen_ids.add(rid)
            catalog.append(recipe_to_web(recipe, "cleaned", rid))
            copy_image(recipe.source_image, seen_images)

        for recipe in partial[:8]:
            if recipe.title in curated_titles:
                continue
            rid = slugify(recipe.title)
            base = rid
            n = 1
            while rid in seen_ids:
                rid = f"{base}-{n}"
                n += 1
            seen_ids.add(rid)
            catalog.append(recipe_to_web(recipe, "review", rid))
            copy_image(recipe.source_image, seen_images)

    catalog.sort(key=lambda r: (-{"curated": 3, "cleaned": 2, "review": 1}[r["quality"]], -r["score"]))
    return catalog


def main() -> None:
    catalog = build_catalog()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    payload = {
        "generated": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "count": len(catalog),
        "recipes": catalog,
    }

    out = DATA_DIR / "catalog.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Exported {len(catalog)} recipes to {out}")
    print(f"Images in {IMAGES_DIR}")


if __name__ == "__main__":
    main()
