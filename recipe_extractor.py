"""Extract structured recipes from images via server API or OCR fallback."""

from __future__ import annotations

import base64
import io
import json
import re
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

import requests

import config

try:
    import pytesseract
    from PIL import Image

    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


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
    tags: list[str] = field(default_factory=list)

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
            source_image=source_image or data.get("source_image") or "",
            is_recipe=data.get("is_recipe", True),
            tags=list(data.get("tags") or []),
        )


API_MAX_DIMENSION = 1600
API_JPEG_QUALITY = 85
API_DELAY_SECONDS = 3.0
API_MAX_RETRIES = 5


def prepare_image_bytes(path: Path) -> tuple[bytes, str]:
    """Resize large photos before upload to reduce tokens and payload size."""
    with Image.open(path) as img:
        rgb = img.convert("RGB")
        width, height = rgb.size
        longest = max(width, height)
        if longest > API_MAX_DIMENSION:
            scale = API_MAX_DIMENSION / longest
            rgb = rgb.resize(
                (int(width * scale), int(height * scale)),
                Image.LANCZOS,
            )
        buf = io.BytesIO()
        rgb.save(buf, format="JPEG", quality=API_JPEG_QUALITY)
        return buf.getvalue(), "image/jpeg"


def encode_image(path: Path) -> str:
    data, _ = prepare_image_bytes(path)
    return base64.b64encode(data).decode("utf-8")


def mime_type(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, "image/jpeg")


def api_endpoint() -> str:
    base = config.RECIPE_API_URL
    return base if base.endswith("/extract-recipe") else f"{base}/api/extract-recipe"


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
    image_bytes, mime = prepare_image_bytes(image_path)
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "imageBase64": b64,
        "mimeType": mime,
        "filename": image_path.name,
    }

    last_error = "Recipe extraction failed"
    for attempt in range(API_MAX_RETRIES):
        resp = requests.post(api_endpoint(), json=payload, timeout=120)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", API_DELAY_SECONDS * (attempt + 2)))
            print(f"  -> Rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue

        if resp.status_code >= 500:
            last_error = f"Server error {resp.status_code}"
            time.sleep(API_DELAY_SECONDS * (attempt + 1))
            continue

        resp.raise_for_status()
        data = resp.json()
        if data.get("error"):
            raise RuntimeError(data["error"])
        return Recipe.from_dict(data, source_image=image_path.name)

    raise RuntimeError(last_error)


def extract_recipe_from_image(image_path: Path, *, use_ocr_fallback: bool = True) -> Recipe:
    try:
        return extract_recipe_from_api(image_path)
    except Exception as exc:
        err = str(exc).lower()
        if use_ocr_fallback and HAS_OCR and (
            "quota" in err or "429" in err or "502" in err or "failed" in err
        ):
            print("  -> Server API unavailable, falling back to OCR...")
            return extract_recipe_ocr(image_path)
        raise


def save_recipes_json(recipes: list[Recipe], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps([asdict(r) for r in recipes], indent=2),
        encoding="utf-8",
    )
    return path


def load_recipes_json(path: Path) -> list[Recipe]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Recipe(**item) for item in data]


def extract_recipes_from_images(
    image_paths: list[Path],
    *,
    use_ocr_fallback: bool = True,
    api_delay_seconds: float = API_DELAY_SECONDS,
) -> list[Recipe]:
    recipes = []
    log_path = config.OUTPUT_DIR / "extraction.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("", encoding="utf-8")

    for i, path in enumerate(image_paths, 1):
        line = f"Analyzing image {i}/{len(image_paths)}: {path.name}"
        print(line)
        with log_path.open("a", encoding="utf-8") as log:
            log.write(line + "\n")

        try:
            recipe = extract_recipe_from_image(path, use_ocr_fallback=use_ocr_fallback)
            if recipe.is_recipe:
                recipes.append(recipe)
                result = f"  -> Recipe: {recipe.title}"
                print(result)
                with log_path.open("a", encoding="utf-8") as log:
                    log.write(result + "\n")
            else:
                result = "  -> Skipped (not a recipe)"
                print(result)
                with log_path.open("a", encoding="utf-8") as log:
                    log.write(result + "\n")
        except Exception as exc:
            result = f"  -> Error: {exc}"
            print(result)
            with log_path.open("a", encoding="utf-8") as log:
                log.write(result + "\n")

        if i < len(image_paths) and api_delay_seconds > 0:
            time.sleep(api_delay_seconds)

    return recipes
