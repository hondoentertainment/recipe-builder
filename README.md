# Recipe Builder

Turn family recipe photos into a browsable collection and Word cookbook.

**Live app:** https://recipe-builder-beta.vercel.app

| Page | Purpose |
|------|---------|
| [/recipes/](https://recipe-builder-beta.vercel.app/recipes/) | Browse, favorite, edit, print, share recipes |
| [/picker/](https://recipe-builder-beta.vercel.app/picker/) | Upload photos → extract recipes with AI |
| [/setup/](https://recipe-builder-beta.vercel.app/setup/) | Google Photos + OpenAI quota guide |

## Features

- Recipe library with search, quality filters, and tags
- Favorites (saved in browser)
- Edit recipes in-browser (persisted locally)
- Print and share views
- Upload photos and extract via vision API
- Newly extracted recipes persist in `localStorage`
- Curated + cleaned catalog from family IMG photos
- Word export pipeline for offline cookbooks

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
- `output/recipes_curated.docx` — hand-corrected recipes
- `recipes/data/catalog.json` — web recipe library

## Google Photos (optional)

1. Save OAuth Desktop credentials to `credentials/client_secret.json`
2. Run:

```bash
python connect_google_photos.py
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
credentials/      OAuth secret (gitignored except README)
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
