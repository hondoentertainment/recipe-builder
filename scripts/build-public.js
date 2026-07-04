const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "picker");
const dest = path.join(__dirname, "..", "public", "picker");

fs.mkdirSync(dest, { recursive: true });

for (const file of ["index.html", "picker.css", "picker.js"]) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

// Static demo version for Vercel (no local server)
const pickerJs = fs.readFileSync(path.join(dest, "picker.js"), "utf8");
if (!pickerJs.includes("DEMO_MODE")) {
  const demo = pickerJs.replace(
    "async function loadPhotos() {",
    `const DEMO_MODE = !window.location.hostname.includes("127.0.0.1");

async function loadPhotos() {`
  ).replace(
    "    const res = await fetch(\"/api/photos\");",
    `    if (DEMO_MODE) {
      photos = [];
      loading.classList.add("hidden");
      empty.classList.remove("hidden");
      empty.innerHTML = "<p><strong>Photo picker preview</strong></p><p>Run <code>python run_all.py</code> locally to connect Google Photos and select images.</p>";
      return;
    }
    const res = await fetch("/api/photos");`
  );
  fs.writeFileSync(path.join(dest, "picker.js"), demo);
}

console.log("Built public/ for Vercel");
