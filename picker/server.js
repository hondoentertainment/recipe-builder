/**
 * Local server for the Google Photos picker UI.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PICKER_DIR = __dirname;
const PORT = 3847;

let state = {
  photos: [],
  albums: [],
};

let selectionResolve = null;
let selectionReject = null;
let loadMoreResolve = null;

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function serveStatic(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    if (req.method === "GET" && url.pathname === "/api/photos") {
      return sendJson(res, 200, state);
    }

    if (req.method === "GET" && url.pathname === "/api/status") {
      return sendJson(res, 200, {
        photoCount: state.photos.length,
        albumCount: state.albums.length,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/select") {
      const body = await readBody(req);
      const selected = state.photos.filter((p) => body.ids?.includes(p.id));
      if (selectionResolve) selectionResolve(selected);
      return sendJson(res, 200, { ok: true, count: selected.length });
    }

    if (req.method === "POST" && url.pathname === "/api/cancel") {
      if (selectionReject) selectionReject(new Error("cancelled"));
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/load-more") {
      if (loadMoreResolve) loadMoreResolve();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/manifest") {
      const body = await readBody(req);
      if (Array.isArray(body)) {
        state.photos = body;
      } else {
        state.photos = body.photos || [];
        state.albums = body.albums || [];
      }
      return sendJson(res, 200, { ok: true, count: state.photos.length });
    }

    const routes = {
      "/": "index.html",
      "/picker.css": "picker.css",
      "/picker.js": "picker.js",
    };

    const file = routes[url.pathname];
    if (file) {
      const types = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };
      return serveStatic(res, path.join(PICKER_DIR, file), types[path.extname(file)]);
    }

    res.writeHead(404);
    res.end("Not found");
  });
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(PORT, "127.0.0.1", () => resolve({ server, port: PORT }));
  });
}

function setManifest(data) {
  if (Array.isArray(data)) {
    state.photos = data;
  } else {
    state.photos = data.photos || [];
    state.albums = data.albums || [];
  }
}

function appendPhotos(newPhotos) {
  const seen = new Set(state.photos.map((p) => p.src));
  for (const p of newPhotos) {
    if (!seen.has(p.src)) {
      seen.add(p.src);
      state.photos.push(p);
    }
  }
}

function waitForSelection() {
  return new Promise((resolve, reject) => {
    selectionResolve = (val) => {
      selectionResolve = null;
      selectionReject = null;
      resolve(val);
    };
    selectionReject = (err) => {
      selectionResolve = null;
      selectionReject = null;
      reject(err);
    };
  });
}

function waitForLoadMore() {
  return new Promise((resolve) => {
    loadMoreResolve = () => {
      loadMoreResolve = null;
      resolve();
    };
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

module.exports = {
  startServer,
  setManifest,
  appendPhotos,
  waitForSelection,
  waitForLoadMore,
  stopServer,
  PORT,
  getState: () => state,
};
