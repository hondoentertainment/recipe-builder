(function () {
  const state = {
    catalog: null,
    recipes: [],
    filter: "all",
    query: "",
    selectedId: null,
  };

  const els = {
    gridView: document.getElementById("grid-view"),
    detailView: document.getElementById("detail-view"),
    grid: document.getElementById("recipe-grid"),
    search: document.getElementById("search"),
    filterChips: document.querySelectorAll(".chip"),
    count: document.getElementById("recipe-count"),
    stats: document.getElementById("stats"),
    detail: document.getElementById("detail"),
    pageTitle: document.getElementById("page-title"),
    pageSubtitle: document.getElementById("page-subtitle"),
    backBtn: document.getElementById("back-btn"),
  };

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
      const raw = sessionStorage.getItem("sessionRecipes");
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  function mergeRecipes(catalogRecipes, sessionRecipes) {
    const merged = [...sessionRecipes, ...catalogRecipes];
    const seen = new Set();
    return merged.filter((recipe) => {
      const key = recipe.id || recipe.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function matches(recipe) {
    if (state.filter !== "all" && recipe.quality !== state.filter) return false;
    if (!state.query) return true;
    const hay = [
      recipe.title,
      recipe.description,
      ...(recipe.ingredients || []),
    ].join(" ").toLowerCase();
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
          <p>Try a different search or filter.</p>
        </div>`;
      return;
    }

    for (const recipe of list) {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        ${recipe.image ? `<img class="card-image" src="${recipe.image}" alt="" loading="lazy">` : ""}
        <div class="card-body">
          <span class="badge badge-${recipe.quality}">${qualityLabel(recipe.quality)}</span>
          <h3>${escapeHtml(recipe.title)}</h3>
          <p>${escapeHtml(recipe.description || "Recipe extracted from a family photo.")}</p>
          <div class="meta-row">
            ${recipe.servings ? `<span>${escapeHtml(recipe.servings)} servings</span>` : ""}
            ${recipe.ingredients?.length ? `<span>${recipe.ingredients.length} ingredients</span>` : ""}
          </div>
        </div>`;
      card.addEventListener("click", () => openRecipe(recipe.id));
      els.grid.appendChild(card);
    }
  }

  function renderDetail(recipe) {
    const ingredients = (recipe.ingredients || []).filter(Boolean);
    const instructions = (recipe.instructions || []).filter(Boolean);

    els.detail.innerHTML = `
      <div class="detail-hero">
        ${recipe.image ? `<img src="${recipe.image}" alt="${escapeAttr(recipe.title)}">` : ""}
      </div>
      <div class="detail-header">
        <span class="badge badge-${recipe.quality}">${qualityLabel(recipe.quality)}</span>
        <h2>${escapeHtml(recipe.title)}</h2>
        ${recipe.description ? `<p class="lead">${escapeHtml(recipe.description)}</p>` : ""}
        <div class="meta-row">
          ${recipe.servings ? `<span>Servings: ${escapeHtml(recipe.servings)}</span>` : ""}
          ${recipe.prep_time ? `<span>Prep: ${escapeHtml(recipe.prep_time)}</span>` : ""}
          ${recipe.cook_time ? `<span>Cook: ${escapeHtml(recipe.cook_time)}</span>` : ""}
        </div>
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

  function route() {
    const match = location.hash.match(/^#\/recipe\/([^/?#]+)/);
    if (match) {
      openRecipe(decodeURIComponent(match[1]));
    } else {
      showGrid();
    }
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
    els.stats.innerHTML = `
      <div><strong>${state.recipes.length}</strong> total</div>
      <div>${curated} curated · ${cleaned} cleaned · ${review} review</div>
    `;
  }

  els.search?.addEventListener("input", (e) => {
    state.query = e.target.value.trim().toLowerCase();
    if (!state.selectedId) renderGrid();
  });

  els.filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      els.filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.filter = chip.dataset.filter;
      if (!state.selectedId) renderGrid();
    });
  });

  els.backBtn?.addEventListener("click", () => {
    location.hash = "#/";
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
      state.recipes = mergeRecipes(data.recipes || [], session);
      if (session.length && new URLSearchParams(location.search).get("session")) {
        els.pageSubtitle.textContent = `${session.length} new recipe(s) from your latest extraction`;
      }
      updateStats();
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
