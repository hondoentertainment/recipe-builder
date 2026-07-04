/**
 * Download photos from the user's Google Photos library.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");

const IMAGES_DIR = path.join(__dirname, "images");
const MAX_PHOTOS = 15;

const CHROME_USER_DATA = path.join(
  os.homedir(),
  "AppData/Local/Google/Chrome/User Data"
);
const PROFILE_DIR = path.join(__dirname, ".browser-profile");

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

async function launchBrowser() {
  // Prefer saved session from prior runs
  const profilePath = fs.existsSync(path.join(PROFILE_DIR, "Default"))
    ? PROFILE_DIR
    : CHROME_USER_DATA;

  console.log(`Using profile: ${profilePath}`);

  return chromium.launchPersistentContext(profilePath, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1400, height: 900 },
    args: profilePath === CHROME_USER_DATA ? ["--profile-directory=Default"] : [],
  });
}

async function navigateToLibrary(page) {
  const urls = [
    "https://photos.google.com/search/_tra_?type=document",
    "https://photos.google.com/",
    "https://photos.google.com/albums",
  ];

  for (const url of urls) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);

    const current = page.url();
    console.log(`Navigated to: ${current}`);

    if (current.includes("accounts.google.com")) {
      console.log("Sign-in required — complete login in the browser window...");
      try {
        await page.waitForURL("**/photos.google.com/**", { timeout: 120000 });
        await page.waitForTimeout(3000);
        return true;
      } catch {
        console.log("Sign-in timed out.");
        return false;
      }
    }

    if (current.includes("photos.google.com") && !current.includes("/about")) {
      if (!cleared) {
        for (const f of fs.readdirSync(IMAGES_DIR)) {
          fs.unlinkSync(path.join(IMAGES_DIR, f));
        }
        cleared = true;
      }
      return true;
    }
  }
  return false;
}

async function scrollAndCollect(page) {
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(800);
  }

  return page.evaluate(() => {
    return [...new Set(
      [...document.querySelectorAll("img")]
        .map((img) => img.src)
        .filter((s) => s && s.includes("googleusercontent") && s.length > 120)
    )];
  });
}

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  // Only clear if we successfully reach the library
  let cleared = false;

  const browser = await launchBrowser();
  const page = browser.pages()[0] || (await browser.newPage());

  const ok = await navigateToLibrary(page);
  if (!ok) {
    console.log("Library access failed. Trying fallback photo grab...");
    await page.goto("https://photos.google.com/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
  }

  console.log("Collecting photos from your library...");
  const srcs = await scrollAndCollect(page);
  console.log(`Found ${srcs.length} photos`);

  const downloaded = [];
  for (const src of srcs.slice(0, MAX_PHOTOS)) {
    const filename = `google_photo_${downloaded.length + 1}.jpg`;
    const dest = path.join(IMAGES_DIR, filename);
    try {
      const hiRes = src.replace(/=w\d+-h\d+[^/]*/, "=w1200-h1200-no");
      await downloadImage(hiRes, dest);
      if (fs.statSync(dest).size > 5000) {
        downloaded.push(dest);
        console.log(`Downloaded: ${filename} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
      } else {
        fs.unlinkSync(dest);
      }
    } catch (e) {
      console.log(`Skipped: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\nTotal: ${downloaded.length} images saved to images/`);
  return downloaded.length;
}

main()
  .then((n) => process.exit(n > 0 ? 0 : 1))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
