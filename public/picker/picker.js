let photos = [];
const selected = new Map();

const grid = document.getElementById("grid");
const loading = document.getElementById("loading");
const empty = document.getElementById("empty");
const tray = document.getElementById("tray");
const countEl = document.getElementById("count");
const countLabel = document.getElementById("count-label");
const trayThumbs = document.getElementById("tray-thumbs");
const btnConfirm = document.getElementById("btn-confirm");
const btnClear = document.getElementById("btn-clear");
const btnSelectAll = document.getElementById("btn-select-all");
const btnCancel = document.getElementById("btn-cancel");

function updateUI() {
  const n = selected.size;
  countEl.textContent = n;
  countLabel.textContent = n === 1 ? "photo selected" : "photos selected";
  btnConfirm.disabled = n === 0;
  btnClear.disabled = n === 0;

  trayThumbs.innerHTML = "";
  let order = 1;
  for (const photo of selected.values()) {
    const img = document.createElement("img");
    img.src = photo.thumb || photo.src;
    img.alt = `Selected ${order}`;
    img.title = photo.filename || `Photo ${order}`;
    trayThumbs.appendChild(img);
    order++;
  }

  document.querySelectorAll(".photo-card").forEach((card) => {
    const id = card.dataset.id;
    const isSelected = selected.has(id);
    card.classList.toggle("selected", isSelected);
    const badge = card.querySelector(".index");
    if (badge && isSelected) {
      badge.textContent = `#${[...selected.keys()].indexOf(id) + 1}`;
    }
  });
}

function togglePhoto(photo) {
  if (selected.has(photo.id)) {
    selected.delete(photo.id);
  } else {
    selected.set(photo.id, photo);
  }
  updateUI();
}

function renderGrid() {
  grid.innerHTML = "";
  if (!photos.length) {
    empty.classList.remove("hidden");
    tray.classList.add("hidden");
    return;
  }

  empty.classList.add("hidden");
  tray.classList.remove("hidden");

  photos.forEach((photo, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "photo-card";
    card.dataset.id = photo.id;
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", "false");
    card.title = photo.filename || `Photo ${i + 1}`;

    card.innerHTML = `
      <img src="${photo.thumb || photo.src}" alt="" loading="lazy" />
      <span class="check" aria-hidden="true">✓</span>
      <span class="index"></span>
    `;

    card.addEventListener("click", () => togglePhoto(photo));
    card.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        togglePhoto(photo);
      }
    });

    grid.appendChild(card);
  });

  updateUI();
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

const DEMO_MODE = !window.location.hostname.includes("127.0.0.1");

async function loadPhotos() {
  loading.classList.remove("hidden");
  try {
    if (DEMO_MODE) {
      photos = [];
      loading.classList.add("hidden");
      empty.classList.remove("hidden");
      empty.innerHTML = "<p><strong>Photo picker preview</strong></p><p>Run <code>python run_all.py</code> locally to connect Google Photos and select images.</p>";
      return;
    }
    const res = await fetch("/api/photos");
    photos = await res.json();
  } catch {
    photos = [];
  }
  loading.classList.add("hidden");
  renderGrid();
}

btnSelectAll.addEventListener("click", () => {
  photos.forEach((p) => selected.set(p.id, p));
  updateUI();
});

btnClear.addEventListener("click", () => {
  selected.clear();
  updateUI();
});

btnConfirm.addEventListener("click", () => {
  submitSelection([...selected.keys()]);
});

btnCancel.addEventListener("click", () => {
  submitCancel();
});

loadPhotos();
