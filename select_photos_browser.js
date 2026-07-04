/**
 * Google Photos picker — multi-source library UI.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");

const {
  startServer,
  setManifest,
  appendPhotos,
  waitForSelection,
  waitForLoadMore,
  stopServer,
  PORT,
} = require("./picker/server");

const IMAGES_DIR = path.join(__dirname, "images");
const PROFILE_DIR = path.join(__dirname, ".browser-profile");
const SELECTION_FILE = path.join(IMAGES_DIR, ".selection.json");

const CHROME_USER_DATA = path.join(
  os.homedir(),
  "AppData/Local/Google/Chrome/User Data"
);

const SOURCES = [
  { id: "library", url: "https://photos.google.com/", category: "all", label: "Library" },
  { id: "recipes", url: "https://photos.google.com/search/recipe", category: "recipes", label: "Recipes" },
  { id: "food", url: "https://photos.google.com/search/food", category: "food", label: "Food" },
  { id: "documents", url: "https://photos.google.com/search/_tra_?type=document", category: "documents", label: "Documents" },
];

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

async function scrapeAlbums(page) {
  await page.goto("https://photos.google.com/albums", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  return page.evaluate(() => {
    const names = new Set();
    document.querySelectorAll("[data-album-title], [role='link'], a, span").forEach((el) => {
      const t = (el.textContent || "").trim();
      if (t.length > 2 && t.length < 60 && !/^\d+$/.test(t)) names.add(t);
    });
    return [...names]
      .filter((n) => !/^(Photos|Albums|Google|Settings|Share)$/i.test(n))
      .slice(0, 20);
  });
}

async function collectFromPage(page, source, seen, limit = 30) {
  const found = [];

  for (let scroll = 0; scroll < 8 && found.length < limit; scroll++) {
    const batch = await page.evaluate(() => {
      return [...document.querySelectorAll("img")]
        .map((img) => ({ src: img.src, alt: img.alt || "" }))
        .filter((p) => p.src?.includes("googleusercontent") && p.src.length > 100);
    });

    for (const p of batch) {
      if (seen.has(p.src)) continue;
      seen.add(p.src);
      found.push({
        id: `photo_${seen.size}`,
        src: p.src,
        thumb: p.src.replace(/=w\d+-h\d+[^/]*/, "=w400-h400-c"),
        filename: p.alt || `${source.label}_${found.length + 1}`,
        source: source.id,
        category: source.category,
        album: source.album || null,
      });
      if (found.length >= limit) break;
    }

    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(900);
  }

  return found;
}

async function collectAllSources(page) {
  const seen = new Set();
  const all = [];

  console.log("Scanning Google Photos sources...");
  for (const source of SOURCES) {
    process.stdout.write(`  ${source.label}… `);
    await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    const batch = await collectFromPage(page, source, seen, 25);
    all.push(...batch);
    console.log(`${batch.length} photos`);
  }

  console.log("  Albums…");
  const albums = await scrapeAlbums(page);
  console.log(`  Found ${albums.length} albums, ${all.length} total photos`);

  return { photos: all, albums };
}

async function loadMorePhotos(page, seen) {
  await page.goto("https://photos.google.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 1500));
    await page.waitForTimeout(800);
  }

  const source = { id: "library", category: "all", label: "Library" };
  return collectFromPage(page, source, seen, 40);
}

async function watchLoadMore(page, seen) {
  while (true) {
    await waitForLoadMore();
    console.log("Loading more photos…");
    const more = await loadMorePhotos(page, seen);
    appendPhotos(more);
    console.log(`  +${more.length} photos (total ${seen.size})`);
  }
}

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const { server } = await startServer();
  const browser = await launchBrowser();
  const seen = new Set();

  try {
    const photosPage = browser.pages()[0] || (await browser.newPage());

    const ok = await loginToPhotos(photosPage);
    if (!ok) {
      console.log("Could not reach Google Photos. Sign in and try again.");
      return 0;
    }

    const manifest = await collectAllSources(photosPage);
    manifest.photos.forEach((p) => seen.add(p.src));

    if (!manifest.photos.length) {
      console.log("No photos found in your library.");
      return 0;
    }

    setManifest(manifest);

    const pickerPage = await browser.newPage();
    await pickerPage.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });

    console.log("\n" + "=".repeat(52));
    console.log("  Google Photos picker is open");
    console.log("  Browse albums · filter · select photos · Load more");
    console.log("=".repeat(52) + "\n");

    watchLoadMore(photosPage, seen).catch(() => {});

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
