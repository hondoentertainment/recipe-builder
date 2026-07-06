# Recipe Builder

Turn family recipe photos into a browsable collection and Word cookbook.

**Live app:** https://recipe-builder-beta.vercel.app

| Page | Purpose |
|------|---------|
| [/recipes/](https://recipe-builder-beta.vercel.app/recipes/) | Browse 27+ recipes (curated, cleaned, review) |
| [/picker/](https://recipe-builder-beta.vercel.app/picker/) | Upload photos → extract recipes with AI |
| [/setup/](https://recipe-builder-beta.vercel.app/setup/) | Google Photos connection guide |

## Quick Start (Web)

1. Open [recipe-builder-beta.vercel.app/recipes/](https://recipe-builder-beta.vercel.app/recipes/)
2. To add recipes: [picker](https://recipe-builder-beta.vercel.app/picker/) → **Upload photos** → select → **Extract recipes**

## Quick Start (Local CLI)

```bash
pip install -r requirements.txt
npm install

# Process IMG photos already in project folder
python generate_from_img.py --skip-convert

# Refresh web catalog + deploy assets
python export_web_recipes.py
npm run build
```

Outputs:
- `output/recipes_from_img.docx` — all extractions
- `output/recipes_from_img_cleaned.docx` — quality-filtered
- `output/recipes_curated.docx` — 3 hand-corrected recipes
- `recipes/data/catalog.json` — web recipe library

## Google Photos (optional)

```bash
python connect_google_photos.py
```

Save OAuth credentials to `credentials/client_secret.json`, then:

```bash
python run_all.py
```

See [/setup/](https://recipe-builder-beta.vercel.app/setup/) for full instructions.

## Commands

```bash
# Full pipeline (Google Photos → Word)
python run_all.py

# Local images folder
python main.py --local ./images

# Re-extract IMG photos (when OpenAI quota available)
python retry_api_extraction.py

# Export all images to Word
python export_all_images.py

# Build curated Word + JSON
python build_curated_recipes.py

# Build static site for Vercel
npm run build
vercel deploy --prod
```

## Environment

OpenAI key is **server-side only** (Vercel env `OPENAI_API_KEY`).

Local `.env`:
```
RECIPE_API_URL=https://recipe-builder-beta.vercel.app
```

## Project Structure

```
api/              Vercel serverless (vision extraction)
picker/           Photo picker UI source
recipes/          Recipe browse UX + catalog.json + images
scripts/          Build pipeline
output/           Generated Word docs (local, gitignored)
images/           Downloaded/converted photos (local, gitignored)
```

## Deploy

```bash
npm run build
vercel deploy --prod
```

Git push to `main` also deploys via Vercel if connected.
