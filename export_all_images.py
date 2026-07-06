"""Export all images from the images/ folder to a Word document."""

import config
from word_exporter import export_images_to_word


def main() -> None:
    output_path = config.OUTPUT_DIR / "all_images.docx"
    result = export_images_to_word(config.IMAGES_DIR, output_path)
    print(f"Exported all images to:")
    print(result.resolve())


if __name__ == "__main__":
    main()
