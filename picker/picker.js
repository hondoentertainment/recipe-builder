let photos = [];
const selected = new Map();
let currentFilter = "all";
let currentAlbum = null;
let searchQuery = "";
let lightboxIndex = -1;

const IS_LOCAL_PICKER = ["127.0.0.1", "localhost"].includes(window.location.hostname);
const USE_LOCAL_SELECTION =
  IS_LOCAL_PICKER && (typeof DEMO_MODE === "undefined" || !DEMO_MODE);
const EXTRACT_DELAY_MS = 3500;

const $ = (id) => document.getElementById(id);

const grid = $("grid");
const loading = $("loading");
const empty = $("empty");
const tray = $("tray");
const statusEl = $("status");
const viewTitle = $("view-title");
const viewSubtitle = $("view-subtitle");
const albumList = $("album-list");
const lightbox = $("lightbox");
const lightboxImg = $("lightbox-img");
const lightboxCaption = $("lightbox-caption");

const FILTER_LABELS = {
  all: "All photos",
  recipes: "Recipes & menus",
  food: "Food",
  documents: "Documents",
};

function filteredPhotos() {
  let list = photos;

  if (currentAlbum) {
    list = list.filter((p) => p.album === currentAlbum);
  } else if (currentFilter !== "all") {
    list = list.filter((p) => p.category === currentFilter || p.source === currentFilter);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(
      (p) =>
        (p.filename || "").toLowerCase().includes(q) ||
        (p.album || "").toLowerCase().includes(q)
    );
  }

  return list;
}

function updateCounts() {
  $("count-all").textContent = photos.length;
  $("count-recipes").textContent = photos.filter((p) => p.category === "recipes" || p.source === "recipes").length;
  $("count-food").textContent = photos.filter((p) => p.category === "food" || p.source === "food").length;
  $("count-documents").textContent = photos.filter((p) => p.category === "documents" || p.source === "documents").length;
}

function updateUI() {
  const n = selected.size;
  $("count").textContent = n;
  $("count-label").textContent = n === 1 ? "photo selected" : "photos selected";
  $("btn-confirm").disabled = n === 0;
  $("btn-clear").disabled = n === 0;

  const thumbs = $("tray-thumbs");
  thumbs.innerHTML = "";
  let order = 1;
  for (const photo of selected.values()) {
    const img = document.createElement("img");
    img.src = photo.thumb || photo.src;
    img.alt = `Selected ${order}`;
    img.title = photo.filename || `Photo ${order}`;
    thumbs.appendChild(img);
    order++;
  }

  document.querySelectorAll(".photo-card").forEach((card) => {
    const id = card.dataset.id;
    const isSelected = selected.has(id);
    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-selected", isSelected ? "true" : "false");
    const badge = card.querySelector(".index");
    if (badge && isSelected) {
      badge.textContent = `#${[...selected.keys()].indexOf(id) + 1}`;
    }
  });

  const lbPhoto = filteredPhotos()[lightboxIndex];
  if (lbPhoto && !lightbox.classList.contains("hidden")) {
    const btn = $("lightbox-select");
    btn.textContent = selected.has(lbPhoto.id) ? "Deselect" : "Select this photo";
  }
}

function togglePhoto(photo) {
  if (selected.has(photo.id)) selected.delete(photo.id);
  else selected.set(photo.id, photo);
  updateUI();
}

function renderGrid() {
  const visible = filteredPhotos();
  grid.innerHTML = "";

  loading.classList.add("hidden");

  if (!photos.length) {
    empty.classList.remove("hidden");
    tray.classList.add("hidden");
    return;
  }

  if (!visible.length) {
    empty.classList.remove("hidden");
    tray.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  tray.classList.remove("hidden");

  visible.forEach((photo, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "photo-card";
    card.dataset.id = photo.id;
    card.setAttribute("role", "option");
    card.title = photo.filename || photo.album || `Photo ${i + 1}`;

    card.innerHTML = `
      <img src="${photo.thumb || photo.src}" alt="" loading="lazy" />
      <span class="check" aria-hidden="true">✓</span>
      <span class="index"></span>
      <span class="preview-hint">Preview</span>
    `;

    card.addEventListener("click", () => togglePhoto(photo));
    card.addEventListener("dblclick", (e) => {
      e.preventDefault();
      openLightbox(visible.indexOf(photo));
    });

    grid.appendChild(card);
  });

  updateUI();
}

function renderAlbums(albums) {
  albumList.innerHTML = "";
  if (!albums?.length) {
    $("albums-section").classList.add("hidden");
    return;
  }
  $("albums-section").classList.remove("hidden");

  albums.forEach((name) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "album-item";
    btn.textContent = name;
    btn.addEventListener("click", () => setAlbum(name));
    albumList.appendChild(btn);
  });
}

function setFilter(filter) {
  currentFilter = filter;
  currentAlbum = null;
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.filter === filter);
  });
  document.querySelectorAll(".album-item").forEach((el) => el.classList.remove("active"));
  viewTitle.textContent = FILTER_LABELS[filter] || filter;
  viewSubtitle.textContent = `${filteredPhotos().length} photos · Click to select`;
  renderGrid();
}

function setAlbum(name) {
  currentAlbum = name;
  currentFilter = "all";
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".album-item").forEach((el) => {
    el.classList.toggle("active", el.textContent === name);
  });
  viewTitle.textContent = name;
  viewSubtitle.textContent = `${filteredPhotos().length} photos in album`;
  renderGrid();
}

function openLightbox(index) {
  const visible = filteredPhotos();
  if (index < 0 || index >= visible.length) return;
  lightboxIndex = index;
  const photo = visible[index];
  lightboxImg.src = photo.src || photo.thumb;
  lightboxCaption.textContent = photo.filename || photo.album || "Photo";
  lightbox.classList.remove("hidden");
  updateUI();
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxIndex = -1;
}

async function loadPhotos() {
  loading.classList.remove("hidden");
  empty.classList.add("hidden");
  statusEl.textContent = "Loading library…";

  try {
    const res = await fetch("/api/photos");
    const data = await res.json();
    photos = data.photos || data;
    renderAlbums(data.albums);
    updateCounts();
    statusEl.textContent = `${photos.length} photos loaded`;
  } catch {
    photos = [];
    statusEl.textContent = "Could not load photos";
  }

  setFilter("all");
}

async function pollPhotos() {
  try {
    const res = await fetch("/api/photos");
    const data = await res.json();
    const incoming = data.photos || data;
    if (incoming.length > photos.length) {
      photos = incoming;
      renderAlbums(data.albums);
      updateCounts();
      statusEl.textContent = `${photos.length} photos loaded`;
      renderGrid();
    }
  } catch (_) {}
}

async function requestLoadMore() {
  $("btn-load-more").disabled = true;
  statusEl.textContent = "Loading more from Google Photos…";
  try {
    await fetch("/api/load-more", { method: "POST" });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      await pollPhotos();
      if (photos.length) break;
    }
    statusEl.textContent = `${photos.length} photos loaded`;
  } catch {
    statusEl.textContent = "Load more failed";
  }
  $("btn-load-more").disabled = false;
  renderGrid();
}

async function submitSelection(ids) {
  await fetch("/api/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

async function submitCancel() {
  if (USE_LOCAL_SELECTION) {
    await fetch("/api/cancel", { method: "POST" });
    return;
  }
  selected.clear();
  updateUI();
}

function slugify(text) {
  return String(text || "recipe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "recipe";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function showExtractModal(total) {
  const modal = $("extract-modal");
  modal.classList.remove("hidden");
  $("extract-progress").style.width = "0%";
  $("extract-status").textContent = `Starting extraction for ${total} photo(s)…`;
  $("extract-log").innerHTML = "";
}

function hideExtractModal() {
  $("extract-modal").classList.add("hidden");
}

function updateExtractProgress(current, total, label) {
  const pct = Math.round((current / total) * 100);
  $("extract-progress").style.width = `${pct}%`;
  $("extract-status").textContent = `Extracting ${current} of ${total}: ${label || "photo"}`;
}

function appendExtractLog(message, type = "") {
  const log = $("extract-log");
  const line = document.createElement("div");
  line.className = `extract-log-line ${type}`;
  line.textContent = message;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

async function fetchImageBlob(photo) {
  const res = await fetch(photo.src || photo.thumb);
  if (!res.ok) throw new Error("Could not load image");
  return res.blob();
}

async function extractRecipeFromPhoto(photo, index) {
  const blob = await fetchImageBlob(photo);
  const b64 = await blobToBase64(blob);
  const filename = photo.filename || `photo-${index + 1}.jpg`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const apiRes = await fetch("/api/extract-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: b64,
        mimeType: blob.type || "image/jpeg",
        filename,
      }),
    });

    if (apiRes.status === 429) {
      appendExtractLog("Rate limited — waiting…", "warn");
      await sleep(EXTRACT_DELAY_MS * (attempt + 2));
      continue;
    }

    if (!apiRes.ok) {
      throw new Error(`API error ${apiRes.status}`);
    }

    return apiRes.json();
  }

  throw new Error("Rate limit exceeded");
}

async function extractSelectedRecipes() {
  const items = [...selected.values()];
  if (!items.length) return;

  $("btn-confirm").disabled = true;
  showExtractModal(items.length);
  const results = [];

  for (let i = 0; i < items.length; i++) {
    const photo = items[i];
    updateExtractProgress(i + 1, items.length, photo.filename || `Photo ${i + 1}`);

    try {
      const data = await extractRecipeFromPhoto(photo, i);
      if (data.is_recipe !== false && data.title) {
        results.push({
          id: slugify(data.title) + (i ? `-${i}` : ""),
          title: data.title,
          description: data.description || "",
          servings: data.servings,
          prep_time: data.prep_time,
          cook_time: data.cook_time,
          ingredients: data.ingredients || [],
          instructions: data.instructions || [],
          notes: data.notes || "",
          source_image: photo.filename || "",
          image: photo.src || photo.thumb,
          quality: "extracted",
          score: 10,
        });
        appendExtractLog(`✓ ${data.title}`, "ok");
      } else {
        appendExtractLog(`– Skipped (not a recipe): ${photo.filename || "photo"}`, "muted");
      }
    } catch (err) {
      appendExtractLog(`✗ ${photo.filename || "photo"}: ${err.message}`, "err");
    }

    if (i < items.length - 1) await sleep(EXTRACT_DELAY_MS);
  }

  hideExtractModal();
  $("btn-confirm").disabled = false;

  if (!results.length) {
    statusEl.textContent = "No recipes extracted — try different photos";
    return;
  }

  sessionStorage.setItem("sessionRecipes", JSON.stringify(results));
  statusEl.textContent = `${results.length} recipe(s) extracted — opening library…`;
  window.location.href = "/recipes/?session=1";
}

function addUploadedFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith("image/"));
  if (!files.length) return;

  for (const file of files) {
    const url = URL.createObjectURL(file);
    const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    photos.unshift({
      id,
      thumb: url,
      src: url,
      filename: file.name,
      category: "recipes",
      source: "recipes",
      album: "Uploaded",
    });
  }

  updateCounts();
  setFilter("all");
  statusEl.textContent = `${files.length} photo(s) uploaded — select and extract`;
}

async function handleConfirm() {
  if (USE_LOCAL_SELECTION) {
    await submitSelection([...selected.keys()]);
    return;
  }
  await extractSelectedRecipes();
}

// Events
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

$("search").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  renderGrid();
});

$("btn-select-all").addEventListener("click", () => {
  filteredPhotos().forEach((p) => selected.set(p.id, p));
  updateUI();
});

$("btn-clear").addEventListener("click", () => {
  selected.clear();
  updateUI();
});

$("btn-confirm").addEventListener("click", () => handleConfirm());

if (!USE_LOCAL_SELECTION) {
  $("btn-confirm").textContent = "Extract recipes";
  viewSubtitle.textContent = "Select photos · Upload files · Extract recipes with AI";
}

$("btn-upload")?.addEventListener("click", () => $("file-upload").click());
$("file-upload")?.addEventListener("change", (e) => {
  addUploadedFiles(e.target.files || []);
  e.target.value = "";
});

$("btn-cancel").addEventListener("click", () => submitCancel());
$("btn-load-more").addEventListener("click", requestLoadMore);

$("lightbox-close").addEventListener("click", closeLightbox);
$("lightbox").addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

$("lightbox-prev").addEventListener("click", () => {
  const visible = filteredPhotos();
  openLightbox((lightboxIndex - 1 + visible.length) % visible.length);
});

$("lightbox-next").addEventListener("click", () => {
  const visible = filteredPhotos();
  openLightbox((lightboxIndex + 1) % visible.length);
});

$("lightbox-select").addEventListener("click", () => {
  const photo = filteredPhotos()[lightboxIndex];
  if (photo) togglePhoto(photo);
});

document.addEventListener("keydown", (e) => {
  if (lightbox.classList.contains("hidden")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") $("lightbox-prev").click();
  if (e.key === "ArrowRight") $("lightbox-next").click();
});

loadPhotos();
setInterval(pollPhotos, 2000);
