const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const players = new Map();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, data) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function activePlayers() {
  const now = Date.now();
  for (const [id, player] of players) {
    if (now - player.seen > 15_000) players.delete(id);
  }
  return [...players.values()].map(({ id, name, level, xp, health, x, y, facing }) => ({ id, name, level, xp, health, x, y, facing }));
}

function scoreboard() {
  return activePlayers()
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
    .slice(0, 16);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/join") {
    const body = await readBody(req);
    const id = crypto.randomUUID();
    players.set(id, {
      id,
      name: String(body.name || "Player").slice(0, 18),
      level: 1,
      xp: 0,
      health: 100,
      x: 2600,
      y: 2600,
      facing: 0,
      seen: Date.now()
    });
    return sendJson(res, { id, scoreboard: scoreboard(), players: activePlayers() });
  }

  if (req.method === "POST" && req.url === "/api/state") {
    const body = await readBody(req);
    const id = String(body.id || "");
    if (players.has(id)) {
      const player = players.get(id);
      player.name = String(body.name || player.name).slice(0, 18);
      player.level = Number(body.level || player.level || 1);
      player.xp = Number(body.xp || 0);
      player.health = Number(body.health || 0);
      player.x = Number(body.x || player.x || 2600);
      player.y = Number(body.y || player.y || 2600);
      player.facing = Number(body.facing || 0);
      player.seen = Date.now();
    }
    return sendJson(res, { scoreboard: scoreboard(), players: activePlayers() });
  }

  const urlPath = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.normalize(path.join(root, urlPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Raaaaft.io server running on port ${port}`);
});
