"""Extract structured recipes from images using OpenAI Vision or OCR fallback."""

from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

import requests
from openai import OpenAI

try:
    import pytesseract
    from PIL import Image

    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    HAS_OCR = True
except ImportError:
    HAS_OCR = False

RECIPE_SCHEMA = """{
  "title": "Recipe name",
  "description": "Brief description of the dish",
  "servings": "Number of servings if visible, else null",
  "prep_time": "Prep time if visible, else null",
  "cook_time": "Cook time if visible, else null",
  "ingredients": ["ingredient with amount"],
  "instructions": ["step by step instructions"],
  "notes": "Any tips or notes, else empty string",
  "is_recipe": true
}"""

SYSTEM_PROMPT = """You are a recipe transcription expert. Analyze the image and determine if it contains a recipe (cookbook page, handwritten recipe card, screenshot, food photo with recipe text, etc.).

If the image IS a recipe or contains recipe information, extract it into structured JSON matching this schema:
""" + RECIPE_SCHEMA + """

If the image is NOT a recipe (random photo, landscape, portrait, etc.), return:
{"is_recipe": false, "title": "", "description": "Not a recipe image", "ingredients": [], "instructions": [], "notes": ""}

Return ONLY valid JSON, no markdown fences."""


@dataclass
class Recipe:
    title: str
    description: str = ""
    servings: str | None = None
    prep_time: str | None = None
    cook_time: str | None = None
    ingredients: list[str] = field(default_factory=list)
    instructions: list[str] = field(default_factory=list)
    notes: str = ""
    source_image: str = ""
    is_recipe: bool = True

    @classmethod
    def from_dict(cls, data: dict, source_image: str = "") -> "Recipe":
        return cls(
            title=data.get("title") or "Untitled Recipe",
            description=data.get("description") or "",
            servings=data.get("servings"),
            prep_time=data.get("prep_time"),
            cook_time=data.get("cook_time"),
            ingredients=data.get("ingredients") or [],
            instructions=data.get("instructions") or [],
            notes=data.get("notes") or "",
            source_image=source_image,
            is_recipe=data.get("is_recipe", True),
        )


def encode_image(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("utf-8")


def mime_type(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, "image/jpeg")


def parse_json_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def extract_recipe_ocr(image_path: Path) -> Recipe:
    if not HAS_OCR:
        raise RuntimeError("OCR not available")

    img = Image.open(image_path)
    text = pytesseract.image_to_string(img)
    if len(text.strip()) < 20:
        return Recipe(
            title="Untitled Recipe",
            description="Insufficient text detected via OCR",
            is_recipe=False,
            source_image=image_path.name,
        )

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    title = lines[0] if lines else "Untitled Recipe"

    ingredients = []
    instructions = []
    section = None

    for line in lines[1:]:
        lower = line.lower()
        if re.match(r"^(ingredients?|what you.?ll need)", lower):
            section = "ingredients"
            continue
        if re.match(r"^(instructions?|directions?|method|steps?)", lower):
            section = "instructions"
            continue
        if section == "ingredients":
            ingredients.append(line.lstrip("•-* "))
        elif section == "instructions":
            instructions.append(re.sub(r"^\d+[\.\)]\s*", "", line))

    if not ingredients and not instructions:
        mid = len(lines) // 2
        ingredients = lines[1:mid] if len(lines) > 2 else []
        instructions = lines[mid:] if len(lines) > 2 else lines[1:]

    return Recipe(
        title=title,
        description="Extracted via OCR from recipe image",
        ingredients=ingredients,
        instructions=instructions,
        source_image=image_path.name,
        is_recipe=bool(ingredients or instructions),
    )


def extract_recipe_from_api(image_path: Path) -> Recipe:
    api_url = os.environ.get("RECIPE_API_URL", "").rstrip("/")
    if not api_url.endswith("/extract-recipe"):
        api_url = f"{api_url}/api/extract-recipe" if api_url else ""

    if not api_url:
        raise RuntimeError("RECIPE_API_URL not configured")

    b64 = encode_image(image_path)
    resp = requests.post(
        api_url,
        json={
            "imageBase64": b64,
            "mimeType": mime_type(image_path),
            "filename": image_path.name,
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(data["error"])
    return Recipe.from_dict(data, source_image=image_path.name)


def extract_recipe_from_image(client: OpenAI | None, image_path: Path) -> Recipe:
    api_url = os.environ.get("RECIPE_API_URL")
    if api_url and not os.environ.get("OPENAI_API_KEY"):
        return extract_recipe_from_api(image_path)

    if client is None:
        client = OpenAI()

    try:
        b64 = encode_image(image_path)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract the recipe from this image. If it's a food photo without written recipe text, infer a plausible recipe based on what you see.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type(image_path)};base64,{b64}",
                                "detail": "high",
                            },
                        },
                    ],
                },
            ],
            max_tokens=2000,
            temperature=0.2,
        )

        raw = response.choices[0].message.content or "{}"
        data = parse_json_response(raw)
        return Recipe.from_dict(data, source_image=image_path.name)
    except Exception as exc:
        if "insufficient_quota" in str(exc).lower() or "429" in str(exc):
            print("  -> OpenAI quota exceeded, falling back to OCR...")
            return extract_recipe_ocr(image_path)
        raise


def extract_recipes_from_images(image_paths: list[Path]) -> list[Recipe]:
    use_api = bool(os.environ.get("RECIPE_API_URL")) and not os.environ.get("OPENAI_API_KEY")
    client = None if use_api else OpenAI()
    recipes = []

    for i, path in enumerate(image_paths, 1):
        print(f"Analyzing image {i}/{len(image_paths)}: {path.name}")
        try:
            recipe = extract_recipe_from_image(client, path)
            if recipe.is_recipe:
                recipes.append(recipe)
                print(f"  -> Recipe: {recipe.title}")
            else:
                print(f"  -> Skipped (not a recipe)")
        except Exception as exc:
            print(f"  -> Error: {exc}")

    return recipes
