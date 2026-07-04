const DEMO_MODE = !["127.0.0.1", "localhost"].includes(window.location.hostname);

let photos = [];
const selected = new Map();
let currentFilter = "all";
let currentAlbum = null;
let searchQuery = "";
let lightboxIndex = -1;

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
  if (DEMO_MODE) {
    photos = [{"id":"d1","thumb":"https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop","src":"https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800","filename":"Recipe card","category":"recipes","source":"recipes"},{"id":"d2","thumb":"https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=400&h=400&fit=crop","src":"https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800","filename":"Cookbook page","category":"recipes","source":"recipes"},{"id":"d3","thumb":"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop","src":"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800","filename":"Food photo","category":"food","source":"food"},{"id":"d4","thumb":"https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=400&fit=crop","src":"https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800","filename":"Ingredients","category":"food","source":"food"},{"id":"d5","thumb":"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop","src":"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800","filename":"Salad bowl","category":"food","source":"food"},{"id":"d6","thumb":"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop","src":"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800","filename":"Pizza","category":"food","source":"food"}];
    renderAlbums(["Family Recipes", "Cookbook Scans"]);
    updateCounts();
    statusEl.textContent = "Demo preview — run python run_all.py locally for Google Photos";
    loading.classList.add("hidden");
    setFilter("all");
    return;
  }

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
    if (DEMO_MODE) { statusEl.textContent = "Demo mode — connect Google Photos locally"; return; }
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
  await fetch("/api/cancel", { method: "POST" });
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

$("btn-confirm").addEventListener("click", () => {
  submitSelection([...selected.keys()]);
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
