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

**Flow:**
1. Signs in to Google Photos (if needed)
2. Scans your library for photos
3. Opens a **Recipe Photo Picker** grid — click thumbnails to select one or many
4. Use **Select all** / **Clear** as needed
5. Click **Use selected photos** to download and continue

**API picker (terminal):** If OAuth credentials are set up:
```bash
python main.py --api
```
Browse albums by number, then enter indices like `1,3,5` or `2-8` or `all`.

**Skip selection:** Use already-downloaded images:
```bash
python main.py --local ./images
```
