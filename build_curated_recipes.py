"""Manually curated versions of the best OCR extractions."""

from pathlib import Path

import config
from recipe_extractor import save_recipes_json
from recipes_data import CURATED
from word_exporter import export_recipes_to_word


def main() -> None:
    output = config.OUTPUT_DIR / "recipes_curated.docx"
    json_output = config.OUTPUT_DIR / "recipes_curated.json"
    save_recipes_json(CURATED, json_output)
    export_recipes_to_word(
        CURATED,
        output,
        config.IMAGES_DIR,
        doc_title="Recipe Collection (Curated)",
        subtitle_note="manually corrected from best OCR extractions",
    )
    print(output.resolve())
    print(json_output.resolve())


if __name__ == "__main__":
    main()
