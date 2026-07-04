"""Launch the photo picker UI."""

import subprocess
import sys
from pathlib import Path


def main():
    script = Path(__file__).parent / "select_photos_browser.js"
    print("Opening Recipe Photo Picker...")
    print("Select one or more photos, then click 'Use selected photos'.\n")
    result = subprocess.run(["node", str(script)], cwd=script.parent)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
