from pathlib import Path
import os

from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

CREDENTIALS_DIR = ROOT / "credentials"
IMAGES_DIR = ROOT / "images"
OUTPUT_DIR = ROOT / "output"
TOKEN_PATH = CREDENTIALS_DIR / "token.json"
CLIENT_SECRET_PATH = CREDENTIALS_DIR / "client_secret.json"

PHOTOS_SCOPE = "https://www.googleapis.com/auth/photoslibrary.readonly"
PHOTOS_API = "https://photoslibrary.googleapis.com/v1"

RECIPE_SEARCH_TERMS = ["recipe", "recipes", "cooking", "cookbook", "food"]
MAX_PHOTOS = 20

# Server-side API only — never set OPENAI_API_KEY locally
RECIPE_API_URL = os.environ.get(
    "RECIPE_API_URL", "https://recipe-builder-beta.vercel.app"
).rstrip("/")
