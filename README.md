# Recipe Builder from Google Photos

Pulls photos from Google Photos, extracts recipes using AI vision, and exports a formatted Word document.

## Quick Start

### 1. Google Cloud OAuth Setup (one-time)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one)
3. Enable the **Photos Library API**
4. Go to **APIs & Services > Credentials**
5. Create **OAuth 2.0 Client ID** → Application type: **Desktop app**
6. Download the JSON file and save it as:
   ```
   credentials/client_secret.json
   ```

### 2. Run the Pipeline

```bash
pip install -r requirements.txt
python run_all.py
```

A browser opens to Google Photos. **Click photos to select one or many**, then press **Download Selected**. Recipes are extracted and saved to Word automatically.

### 3. Output

- Downloaded images: `images/`
- Word document: `output/recipes.docx`

## Options

```bash
# Use local images instead of Google Photos
python main.py --local ./images

# Custom output filename
python main.py --output my-recipes.docx
```

## Connect Your Google Photos

### Recommended: Google Photos API (reliable)

```bash
python connect_google_photos.py
```

**First-time setup (~5 min):**
1. Script opens Google Cloud Console
2. Enable **Photos Library API**
3. Create **OAuth Desktop** credentials
4. Save downloaded JSON as `credentials/client_secret.json`
5. Sign in with your Google account when prompted

Your real albums and photos load in the picker UI.

### Full pipeline

```bash
python run_all.py
```

Uses API automatically if `credentials/client_secret.json` exists.

### Browser fallback (no API setup)

```bash
node select_photos_browser.js
```

Sign in via browser — less reliable than API mode.

## Environment Variables

**OpenAI API key is server-side only** — stored in Vercel, never in code or local `.env`.

| Variable | Where | Purpose |
|----------|-------|---------|
| `OPENAI_API_KEY` | Vercel only | OpenAI access (never commit) |
| `RECIPE_API_URL` | Local `.env` | Points CLI to server API |

Local setup:
```bash
cp .env.example .env
```

## Photo Selection UX

Run the picker:

```bash
python select_photos.py
# or
python run_all.py
```

**UI features:**
- Sidebar with Library, Recipes & menus, Food, Documents
- Album browser
- Search/filter photos
- Click to select · double-click to preview
- Load more from Google Photos
- Select one or many, then **Use selected photos**

**API picker (terminal):** If OAuth credentials are set up:
```bash
python main.py --api
```
Browse albums by number, then enter indices like `1,3,5` or `2-8` or `all`.

**Skip selection:** Use already-downloaded images:
```bash
python main.py --local ./images
```
