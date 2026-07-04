const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "picker");
const dest = path.join(__dirname, "..", "public", "picker");

fs.mkdirSync(dest, { recursive: true });

for (const file of ["index.html", "picker.css", "picker.js"]) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

// Demo mode for Vercel static preview
const demoPhotos = [
  { id: "d1", thumb: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop", src: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800", filename: "Recipe card", category: "recipes", source: "recipes" },
  { id: "d2", thumb: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=400&h=400&fit=crop", src: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800", filename: "Cookbook page", category: "recipes", source: "recipes" },
  { id: "d3", thumb: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop", src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800", filename: "Food photo", category: "food", source: "food" },
  { id: "d4", thumb: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=400&fit=crop", src: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800", filename: "Ingredients", category: "food", source: "food" },
  { id: "d5", thumb: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop", src: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800", filename: "Salad bowl", category: "food", source: "food" },
  { id: "d6", thumb: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop", src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800", filename: "Pizza", category: "food", source: "food" },
];

let pickerJs = fs.readFileSync(path.join(dest, "picker.js"), "utf8");

if (!pickerJs.includes("DEMO_MODE")) {
  pickerJs = `const DEMO_MODE = !["127.0.0.1", "localhost"].includes(window.location.hostname);

` + pickerJs;

  pickerJs = pickerJs.replace(
    "async function loadPhotos() {",
    `async function loadPhotos() {
  if (DEMO_MODE) {
    photos = ${JSON.stringify(demoPhotos)};
    renderAlbums(["Family Recipes", "Cookbook Scans"]);
    updateCounts();
    statusEl.textContent = "Demo preview — run python run_all.py locally for Google Photos";
    loading.classList.add("hidden");
    setFilter("all");
    return;
  }
`
  );

  pickerJs = pickerJs.replace(
    'await fetch("/api/load-more", { method: "POST" });',
    `if (DEMO_MODE) { statusEl.textContent = "Demo mode — connect Google Photos locally"; return; }
    await fetch("/api/load-more", { method: "POST" });`
  );

  fs.writeFileSync(path.join(dest, "picker.js"), pickerJs);
}

console.log("Built public/ for Vercel");
