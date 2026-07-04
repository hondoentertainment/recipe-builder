/**
 * Google Photos picker with dedicated selection UI.
 * 1. Loads photos from your library
 * 2. Opens a local picker to select one or many
 * 3. Downloads your selection
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");

const {
  startServer,
  setManifest,
  waitForSelection,
  stopServer,
  PORT,
} = require("./picker/server");

const IMAGES_DIR = path.join(__dirname, "images");
const PROFILE_DIR = path.join(__dirname, ".browser-profile");
const SELECTION_FILE = path.join(IMAGES_DIR, ".selection.json");
const MAX_COLLECT = 80;

const CHROME_USER_DATA = path.join(
  os.homedir(),
  "AppData/Local/Google/Chrome/User Data"
);

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadImage(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          fs.writeFileSync(dest, Buffer.concat(chunks));
          resolve(dest);
        });
      })
      .on("error", reject);
  });
}

function safeName(name, index) {
  const cleaned = (name || `photo_${index}`)
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return cleaned.match(/\.(jpe?g|png|webp|gif)$/i)
    ? cleaned
    : `${cleaned || `photo_${index}`}.jpg`;
}

async function launchBrowser() {
  const profilePath = fs.existsSync(path.join(PROFILE_DIR, "Default"))
    ? PROFILE_DIR
    : CHROME_USER_DATA;

  return chromium.launchPersistentContext(profilePath, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1400, height: 900 },
    args: profilePath === CHROME_USER_DATA ? ["--profile-directory=Default"] : [],
  });
}

async function loginToPhotos(page) {
  await page.goto("https://photos.google.com/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(3000);

  if (page.url().includes("accounts.google.com")) {
    console.log("Sign in to Google in the browser window...");
    try {
      await page.waitForURL("**/photos.google.com/**", { timeout: 180000 });
      await page.waitForTimeout(3000);
    } catch {
      return false;
    }
  }

  return page.url().includes("photos.google.com") && !page.url().includes("/about");
}

async function collectPhotos(page) {
  console.log("Scanning your Google Photos library...");

  const seen = new Set();
  const photos = [];

  for (let scroll = 0; scroll < 12 && photos.length < MAX_COLLECT; scroll++) {
    const batch = await page.evaluate(() => {
      return [...document.querySelectorAll("img")]
        .map((img) => ({
          src: img.src,
          alt: img.alt || "",
          w: img.naturalWidth || img.width,
          h: img.naturalHeight || img.height,
        }))
        .filter((p) => p.src?.includes("googleusercontent") && p.src.length > 100);
    });

    for (const p of batch) {
      if (seen.has(p.src)) continue;
      seen.add(p.src);
      photos.push({
        id: `photo_${photos.length + 1}`,
        src: p.src,
        thumb: p.src.replace(/=w\d+-h\d+[^/]*/, "=w400-h400-c"),
        filename: p.alt || `photo_${photos.length + 1}`,
      });
      if (photos.length >= MAX_COLLECT) break;
    }

    process.stdout.write(`\r  Found ${photos.length} photos...`);
    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.waitForTimeout(1200);
  }

  console.log(`\n  Collected ${photos.length} photos for selection.`);
  return photos;
}

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const { server } = await startServer();
  const browser = await launchBrowser();

  try {
    const photosPage = browser.pages()[0] || (await browser.newPage());

    const ok = await loginToPhotos(photosPage);
    if (!ok) {
      console.log("Could not reach Google Photos. Sign in and try again.");
      return 0;
    }

    const manifest = await collectPhotos(photosPage);
    if (!manifest.length) {
      console.log("No photos found in your library.");
      return 0;
    }

    setManifest(manifest);

    const pickerPage = await browser.newPage();
    await pickerPage.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });

    console.log("\n" + "=".repeat(50));
    console.log("  Photo picker is open — select one or many photos");
    console.log("  Click thumbnails to toggle, then 'Use selected photos'");
    console.log("=".repeat(50) + "\n");

    let selected;
    try {
      selected = await waitForSelection();
    } catch {
      console.log("Selection cancelled.");
      return 0;
    }

    await browser.close();

    for (const f of fs.readdirSync(IMAGES_DIR)) {
      if (!f.startsWith(".")) fs.unlinkSync(path.join(IMAGES_DIR, f));
    }

    console.log(`Downloading ${selected.length} selected photo(s)...`);
    const downloaded = [];

    for (let i = 0; i < selected.length; i++) {
      const photo = selected[i];
      const dest = path.join(IMAGES_DIR, safeName(photo.filename, i + 1));
      try {
        const hiRes = photo.src.replace(/=w\d+-h\d+[^/]*/, "=w1600-h1600-no");
        await downloadImage(hiRes, dest);
        if (fs.statSync(dest).size > 3000) {
          downloaded.push(dest);
          console.log(`  ✓ ${path.basename(dest)}`);
        } else {
          fs.unlinkSync(dest);
        }
      } catch (e) {
        console.log(`  ✗ Skipped: ${e.message}`);
      }
    }

    fs.writeFileSync(
      SELECTION_FILE,
      JSON.stringify(
        { count: downloaded.length, files: downloaded.map((p) => path.basename(p)) },
        null,
        2
      )
    );

    console.log(`\n${downloaded.length} photo(s) saved to images/`);
    return downloaded.length;
  } finally {
    await stopServer(server);
  }
}

main()
  .then((n) => process.exit(n > 0 ? 0 : 1))
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  });
