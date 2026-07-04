/**
 * Open photo picker with a pre-loaded manifest (from Google Photos API).
 * Usage: node select_photos_from_manifest.js [manifest.json]
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const {
  startServer,
  setManifest,
  waitForSelection,
  stopServer,
  PORT,
} = require("./picker/server");

const IMAGES_DIR = path.join(__dirname, "images");
const MANIFEST_PATH = process.argv[2] || path.join(__dirname, "photos_manifest.json");

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (!manifest.photos?.length) {
    console.error("No photos in manifest.");
    process.exit(1);
  }

  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const { server } = await startServer();
  setManifest(manifest);

  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });

  console.log("\n" + "=".repeat(52));
  console.log(`  Your Google Photos — ${manifest.photos.length} photos loaded`);
  console.log("  Select photos, then click 'Use selected photos'");
  console.log("=".repeat(52) + "\n");

  let selected;
  try {
    selected = await waitForSelection();
  } catch {
    console.log("Cancelled.");
    await browser.close();
    await stopServer(server);
    return 0;
  }

  await browser.close();

  // Save selection — Python downloads full resolution via API
  const selectionPath = path.join(IMAGES_DIR, ".selection.json");
  fs.writeFileSync(
    selectionPath,
    JSON.stringify({ selected, mode: "api" }, null, 2)
  );

  await stopServer(server);
  console.log(`\n${selected.length} photo(s) selected`);
  return selected.length;
}

main()
  .then((n) => process.exit(n > 0 ? 0 : 1))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
