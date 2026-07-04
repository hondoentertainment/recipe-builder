"""Launch Google Photos picker — API mode if configured, else browser."""

import subprocess
import sys
from pathlib import Path

import config


def main():
    if config.CLIENT_SECRET_PATH.exists():
        from connect_google_photos import main as connect_main
        connect_main()
        return

    print("No Google API credentials found.")
    print("Run: python connect_google_photos.py  (recommended)")
    print("Or using browser mode...\n")

    script = Path(__file__).parent / "select_photos_browser.js"
    result = subprocess.run(["node", str(script)], cwd=script.parent)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
