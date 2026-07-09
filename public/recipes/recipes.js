(function () {
  const STORAGE_KEYS = {
    favorites: "recipeFavorites",
    edits: "recipeEdits",
    saved: "savedRecipes",
    session: "sessionRecipes",
  };

  const state = {
    catalog: null,
    recipes: [],
    filter: "all",
    tag: "all",
    query: "",
    selectedId: null,
    favorites: new Set(loadJson(STORAGE_KEYS.favorites, [])),
    edits: loadJson(STORAGE_KEYS.edits, {}),
  };

  const els = {
    gridView: document.getElementById("grid-view"),
    detailView: document.getElementById("detail-view"),
    grid: document.getElementById("recipe-grid"),
    search: document.getElementById("search"),
    qualityChips: document.querySelectorAll("#quality-chips .chip"),
    tagChips: document.getElementById("tag-chips"),
    count: document.getElementById("recipe-count"),
    stats: document.getElementById("stats"),
    detail: document.getElementById("detail"),
    pageTitle: document.getElementById("page-title"),
    pageSubtitle: document.getElementById("page-subtitle"),
    backBtn: document.getElementById("back-btn"),
    btnFavorite: document.getElementById("btn-favorite"),
    btnEdit: document.getElementById("btn-edit"),
    btnShare: document.getElementById("btn-share"),
    btnPrint: document.getElementById("btn-print"),
    btnExport: document.getElementById("btn-export"),
    editModal: document.getElementById("edit-modal"),
    editForm: document.getElementById("edit-form"),
    editClose: document.getElementById("edit-close"),
    editCancel: document.getElementById("edit-cancel"),
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function qualityLabel(q) {
    return {
      curated: "Curated",
      cleaned: "Cleaned",
      review: "Needs review",
      extracted: "Just extracted",
    }[q] || q;
  }

  function loadSessionRecipes() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.session);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  function persistSessionToSaved(sessionRecipes) {
    if (!sessionRecipes.length) return;
    const saved = loadJson(STORAGE_KEYS.saved, []);
    const byId = new Map(saved.map((r) => [r.id, r]));
    for (const recipe of sessionRecipes) {
      byId.set(recipe.id, { ...recipe, quality: recipe.quality || "extracted" });
    }
    saveJson(STORAGE_KEYS.saved, [...byId.values()]);
    sessionStorage.removeItem(STORAGE_KEYS.session);
  }

  function applyEdits(recipe) {
    const edit = state.edits[recipe.id];
    return edit ? { ...recipe, ...edit } : recipe;
  }

  function mergeRecipes(catalogRecipes, sessionRecipes, savedRecipes) {
    const merged = [...sessionRecipes, ...savedRecipes, ...catalogRecipes];
    const seen = new Set();
    return merged
      .map(applyEdits)
      .filter((recipe) => {
        const key = recipe.id || recipe.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function allTags() {
    const counts = new Map();
    for (const recipe of state.recipes) {
      for (const tag of recipe.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function renderTagChips() {
    const tags = allTags();
    els.tagChips.innerHTML = `<button class="chip ${state.tag === "all" ? "active" : ""}" data-tag="all" type="button">All tags</button>`;
    for (const [tag, count] of tags) {
      const btn = document.createElement("button");
      btn.className = `chip ${state.tag === tag ? "active" : ""}`;
      btn.dataset.tag = tag;
      btn.type = "button";
      btn.textContent = `${tag} (${count})`;
      els.tagChips.appendChild(btn);
    }
    els.tagChips.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.tag = chip.dataset.tag;
        renderTagChips();
        if (!state.selectedId) renderGrid();
      });
    });
  }

  function matches(recipe) {
    if (state.filter === "favorites" && !state.favorites.has(recipe.id)) return false;
    if (state.filter !== "all" && state.filter !== "favorites" && recipe.quality !== state.filter) {
      return false;
    }
    if (state.tag !== "all" && !(recipe.tags || []).includes(state.tag)) return false;
    if (!state.query) return true;
    const hay = [
      recipe.title,
      recipe.description,
      ...(recipe.ingredients || []),
      ...(recipe.tags || []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(state.query);
  }

  function renderGrid() {
    const list = state.recipes.filter(matches);
    els.count.textContent = `${list.length} recipe${list.length === 1 ? "" : "s"}`;
    els.grid.innerHTML = "";

    if (!list.length) {
      els.grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <h3>No recipes match</h3>
          <p>Try a different search, tag, or filter.</p>
        </div>`;
      return;
    }

    for (const recipe of list) {
      const card = document.createElement("article");
      card.className = "card";
      const fav = state.favorites.has(recipe.id);
      card.innerHTML = `
        ${recipe.image ? `<img class="card-image" src="${recipe.image}" alt="" loading="lazy">` : `<div class="card-image placeholder"></div>`}
        <div class="card-body">
          <div class="card-top">
            <span class="badge badge-${recipe.quality}">${qualityLabel(recipe.quality)}</span>
            <button class="fav-btn ${fav ? "on" : ""}" type="button" data-id="${escapeAttr(recipe.id)}" aria-label="Toggle favorite">${fav ? "★" : "☆"}</button>
          </div>
          <h3>${escapeHtml(recipe.title)}</h3>
          <p>${escapeHtml(recipe.description || "Recipe extracted from a family photo.")}</p>
          <div class="meta-row">
            ${recipe.servings ? `<span>${escapeHtml(String(recipe.servings))}</span>` : ""}
            ${recipe.ingredients?.length ? `<span>${recipe.ingredients.length} ingredients</span>` : ""}
          </div>
          ${(recipe.tags || []).length ? `<div class="tag-row">${recipe.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        </div>`;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".fav-btn")) return;
        openRecipe(recipe.id);
      });
      card.querySelector(".fav-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(recipe.id);
        renderGrid();
      });
      els.grid.appendChild(card);
    }
  }

  function renderDetail(recipe) {
    const ingredients = (recipe.ingredients || []).filter(Boolean);
    const instructions = (recipe.instructions || []).filter(Boolean);
    const fav = state.favorites.has(recipe.id);

    els.btnFavorite.textContent = fav ? "★ Favorited" : "☆ Favorite";
    els.btnFavorite.classList.toggle("on", fav);

    els.detail.innerHTML = `
      <div class="detail-hero">
        ${recipe.image ? `<img src="${recipe.image}" alt="${escapeAttr(recipe.title)}">` : ""}
      </div>
      <div class="detail-header">
        <span class="badge badge-${recipe.quality}">${qualityLabel(recipe.quality)}</span>
        <h2>${escapeHtml(recipe.title)}</h2>
        ${recipe.description ? `<p class="lead">${escapeHtml(recipe.description)}</p>` : ""}
        <div class="meta-row">
          ${recipe.servings ? `<span>Servings: ${escapeHtml(String(recipe.servings))}</span>` : ""}
          ${recipe.prep_time ? `<span>Prep: ${escapeHtml(recipe.prep_time)}</span>` : ""}
          ${recipe.cook_time ? `<span>Cook: ${escapeHtml(recipe.cook_time)}</span>` : ""}
        </div>
        ${(recipe.tags || []).length ? `<div class="tag-row">${recipe.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="panel">
        <h3>Ingredients</h3>
        ${ingredients.length ? `<ul>${ingredients.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : `<p class="muted">No ingredients listed.</p>`}
      </div>
      <div class="panel">
        <h3>Instructions</h3>
        ${instructions.length ? `<ol>${instructions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>` : `<p class="muted">No instructions listed.</p>`}
      </div>
      ${recipe.notes ? `<div class="panel"><h3>Notes</h3><p>${escapeHtml(recipe.notes)}</p></div>` : ""}
    `;

    els.pageTitle.textContent = recipe.title;
    els.pageSubtitle.textContent = qualityLabel(recipe.quality);
  }

  function showGrid() {
    state.selectedId = null;
    els.gridView.classList.remove("hidden");
    els.detailView.classList.add("hidden");
    els.pageTitle.textContent = "Recipe Collection";
    els.pageSubtitle.textContent = "Browse extracted and curated family recipes";
    document.title = "Recipes — Recipe Builder";
    renderGrid();
  }

  function openRecipe(id) {
    const recipe = state.recipes.find((r) => r.id === id);
    if (!recipe) return;
    state.selectedId = id;
    location.hash = `#/recipe/${id}`;
    els.gridView.classList.add("hidden");
    els.detailView.classList.remove("hidden");
    renderDetail(recipe);
    document.title = `${recipe.title} — Recipe Builder`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function currentRecipe() {
    return state.recipes.find((r) => r.id === state.selectedId);
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    saveJson(STORAGE_KEYS.favorites, [...state.favorites]);
    updateStats();
    if (state.selectedId === id) {
      const recipe = currentRecipe();
      if (recipe) renderDetail(recipe);
    }
  }

  function openEditor() {
    const recipe = currentRecipe();
    if (!recipe) return;
    document.getElementById("edit-title").value = recipe.title || "";
    document.getElementById("edit-description").value = recipe.description || "";
    document.getElementById("edit-servings").value = recipe.servings || "";
    document.getElementById("edit-prep").value = recipe.prep_time || "";
    document.getElementById("edit-cook").value = recipe.cook_time || "";
    document.getElementById("edit-tags").value = (recipe.tags || []).join(", ");
    document.getElementById("edit-ingredients").value = (recipe.ingredients || []).join("\n");
    document.getElementById("edit-instructions").value = (recipe.instructions || []).join("\n");
    document.getElementById("edit-notes").value = recipe.notes || "";
    els.editModal.classList.remove("hidden");
  }

  function closeEditor() {
    els.editModal.classList.add("hidden");
  }

  function saveEditor(e) {
    e.preventDefault();
    const recipe = currentRecipe();
    if (!recipe) return;

    const patch = {
      title: document.getElementById("edit-title").value.trim(),
      description: document.getElementById("edit-description").value.trim(),
      servings: document.getElementById("edit-servings").value.trim() || null,
      prep_time: document.getElementById("edit-prep").value.trim() || null,
      cook_time: document.getElementById("edit-cook").value.trim() || null,
      tags: document
        .getElementById("edit-tags")
        .value.split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      ingredients: document
        .getElementById("edit-ingredients")
        .value.split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      instructions: document
        .getElementById("edit-instructions")
        .value.split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      notes: document.getElementById("edit-notes").value.trim(),
    };

    state.edits[recipe.id] = patch;
    saveJson(STORAGE_KEYS.edits, state.edits);

    const idx = state.recipes.findIndex((r) => r.id === recipe.id);
    if (idx >= 0) state.recipes[idx] = { ...state.recipes[idx], ...patch };

    // Also update saved recipes collection
    const saved = loadJson(STORAGE_KEYS.saved, []);
    const savedIdx = saved.findIndex((r) => r.id === recipe.id);
    if (savedIdx >= 0) {
      saved[savedIdx] = { ...saved[savedIdx], ...patch };
      saveJson(STORAGE_KEYS.saved, saved);
    } else {
      saved.unshift({ ...state.recipes[idx], quality: "extracted" });
      saveJson(STORAGE_KEYS.saved, saved);
    }

    closeEditor();
    renderTagChips();
    renderDetail(state.recipes[idx]);
    updateStats();
  }

  async function shareRecipe() {
    const recipe = currentRecipe();
    if (!recipe) return;
    const url = `${location.origin}${location.pathname}#/recipe/${recipe.id}`;
    const text = `${recipe.title}\n\n${(recipe.ingredients || []).map((i) => `• ${i}`).join("\n")}\n\n${(recipe.instructions || [])
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n")}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.title, text, url });
        return;
      }
    } catch {
      /* fall through */
    }

    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      els.pageSubtitle.textContent = "Recipe copied to clipboard";
    } catch {
      prompt("Copy this recipe link:", url);
    }
  }

  function exportJson() {
    const payload = {
      exported: new Date().toISOString(),
      favorites: [...state.favorites],
      recipes: state.recipes.filter(matches),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "recipes-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function route() {
    const match = location.hash.match(/^#\/recipe\/([^/?#]+)/);
    if (match) openRecipe(decodeURIComponent(match[1]));
    else showGrid();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function updateStats() {
    const curated = state.recipes.filter((r) => r.quality === "curated").length;
    const cleaned = state.recipes.filter((r) => r.quality === "cleaned").length;
    const review = state.recipes.filter((r) => r.quality === "review").length;
    const extracted = state.recipes.filter((r) => r.quality === "extracted").length;
    els.stats.innerHTML = `
      <div><strong>${state.recipes.length}</strong> total · <strong>${state.favorites.size}</strong> favorites</div>
      <div>${curated} curated · ${cleaned} cleaned · ${review} review · ${extracted} new</div>
    `;
  }

  els.search?.addEventListener("input", (e) => {
    state.query = e.target.value.trim().toLowerCase();
    if (!state.selectedId) renderGrid();
  });

  els.qualityChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      els.qualityChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.filter = chip.dataset.filter;
      if (!state.selectedId) renderGrid();
    });
  });

  els.backBtn?.addEventListener("click", () => {
    location.hash = "#/";
  });
  els.btnFavorite?.addEventListener("click", () => {
    if (state.selectedId) toggleFavorite(state.selectedId);
  });
  els.btnEdit?.addEventListener("click", openEditor);
  els.btnShare?.addEventListener("click", shareRecipe);
  els.btnPrint?.addEventListener("click", () => window.print());
  els.btnExport?.addEventListener("click", exportJson);
  els.editClose?.addEventListener("click", closeEditor);
  els.editCancel?.addEventListener("click", closeEditor);
  els.editForm?.addEventListener("submit", saveEditor);
  els.editModal?.addEventListener("click", (e) => {
    if (e.target === els.editModal) closeEditor();
  });

  window.addEventListener("hashchange", route);

  fetch("/recipes/data/catalog.json")
    .then((r) => {
      if (!r.ok) throw new Error("Catalog not found");
      return r.json();
    })
    .then((data) => {
      state.catalog = data;
      const session = loadSessionRecipes();
      if (session.length) persistSessionToSaved(session);
      const saved = loadJson(STORAGE_KEYS.saved, []);
      state.recipes = mergeRecipes(data.recipes || [], session, saved);
      if (new URLSearchParams(location.search).get("session") && session.length) {
        els.pageSubtitle.textContent = `${session.length} new recipe(s) saved to this browser`;
      }
      updateStats();
      renderTagChips();
      route();
    })
    .catch(() => {
      els.grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <h3>Recipe catalog not loaded</h3>
          <p>Run <code>python export_web_recipes.py</code> then <code>npm run build</code>.</p>
        </div>`;
    });
})();
