/**
 * Local server for the photo picker UI.
 * Serves picker page and coordinates selection with Playwright.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PICKER_DIR = __dirname;
const PORT = 3847;

let photoManifest = [];
let selectionResolve = null;
let selectionReject = null;

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

function createServer() {
  return http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.method === "GET" && req.url === "/api/photos") {
      return sendJson(res, 200, photoManifest);
    }

    if (req.method === "POST" && req.url === "/api/select") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const { ids } = JSON.parse(body || "{}");
        const selected = photoManifest.filter((p) => ids.includes(p.id));
        if (selectionResolve) selectionResolve(selected);
        sendJson(res, 200, { ok: true, count: selected.length });
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/cancel") {
      if (selectionReject) selectionReject(new Error("cancelled"));
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/api/manifest") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        photoManifest = JSON.parse(body || "[]");
        sendJson(res, 200, { ok: true, count: photoManifest.length });
      });
      return;
    }

    const routes = {
      "/": "index.html",
      "/picker.css": "picker.css",
      "/picker.js": "picker.js",
    };

    const file = routes[req.url?.split("?")[0]];
    if (file) {
      const types = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };
      const ext = path.extname(file);
      return serveStatic(res, path.join(PICKER_DIR, file), types[ext]);
    }

    res.writeHead(404);
    res.end("Not found");
  });
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(PORT, "127.0.0.1", () => {
      resolve({ server, port: PORT });
    });
  });
}

function setManifest(photos) {
  photoManifest = photos;
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

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

module.exports = { startServer, setManifest, waitForSelection, stopServer, PORT };
