"""Interactive Google Photos API setup helper."""

import webbrowser
from pathlib import Path

import config

STEPS = """
╔══════════════════════════════════════════════════════════════╗
║         Google Photos API — One-Time Setup                   ║
╚══════════════════════════════════════════════════════════════╝

Follow these steps (takes ~5 minutes):

1. CREATE A GOOGLE CLOUD PROJECT
   → A browser tab will open to Google Cloud Console
   → Click "Create Project", name it "Recipe Builder"

2. ENABLE PHOTOS LIBRARY API
   → Search "Photos Library API" and click Enable

3. CONFIGURE OAUTH CONSENT SCREEN
   → APIs & Services → OAuth consent screen
   → Choose "External", fill in app name "Recipe Builder"
   → Add your email as test user

4. CREATE CREDENTIALS
   → APIs & Services → Credentials → Create Credentials
   → OAuth client ID → Desktop app
   → Download JSON

5. SAVE THE FILE
   → Rename downloaded file to: client_secret.json
   → Move it to: {cred_path}

6. RUN THE PIPELINE
   → python main.py

Press Enter after saving client_secret.json to test the connection...
"""


def main():
    config.CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)

    print(STEPS.format(cred_path=config.CLIENT_SECRET_PATH))

    webbrowser.open("https://console.cloud.google.com/apis/library/photoslibrary.googleapis.com")
    webbrowser.open("https://console.cloud.google.com/apis/credentials")

    input()

    if config.CLIENT_SECRET_PATH.exists():
        print("Found client_secret.json! Running pipeline...")
        import main as pipeline
        pipeline.run_from_google_photos()
    else:
        print(f"\nStill missing: {config.CLIENT_SECRET_PATH}")
        print("Please complete the steps above and run: python setup_google.py")


if __name__ == "__main__":
    main()
