const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const WORLD = 9600;
const SERVER_AGGRESSIVE_SHARKS = 4;
const SERVER_SHARK_SPEED = 115;
const SERVER_SHARK_DAMAGE = 36;
const SERVER_SHARK_BITE_MS = 1300;
const players = new Map();
let lastSharkTick = Date.now();

const serverSharks = Array.from({ length: SERVER_AGGRESSIVE_SHARKS }, (_, i) => ({
  id: `server-shark-${i + 1}`,
  x: 800 + Math.random() * (WORLD - 1600),
  y: 800 + Math.random() * (WORLD - 1600),
  facing: Math.random() * Math.PI * 2,
  targetId: null,
  biteAt: 0
}));

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

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function playerFromBody(id, body, existing = {}) {
  return {
    id,
    name: String(body.name || existing.name || "Player").slice(0, 18),
    level: Math.max(1, Math.floor(cleanNumber(body.level, existing.level || 1))),
    xp: Math.max(0, cleanNumber(body.xp, existing.xp || 0)),
    health: Math.max(0, Math.min(100, cleanNumber(body.health, existing.health || 100))),
    stamina: Math.max(0, Math.min(100, cleanNumber(body.stamina, existing.stamina || 100))),
    selectedItem: String(body.selectedItem || existing.selectedItem || "empty").slice(0, 24),
    x: cleanNumber(body.x, existing.x || 4800),
    y: cleanNumber(body.y, existing.y || 4800),
    facing: cleanNumber(body.facing, existing.facing || 0),
    seen: Date.now()
  };
}

function activePlayers() {
  const now = Date.now();
  for (const [id, player] of players) {
    if (now - player.seen > 15_000) players.delete(id);
  }
  return [...players.values()].map(({ id, name, level, xp, health, stamina, selectedItem, x, y, facing }) => ({ id, name, level, xp, health, stamina, selectedItem, x, y, facing }));
}

function scoreboard() {
  return activePlayers()
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
    .slice(0, 16);
}

function tickServerSharks() {
  const now = Date.now();
  const dt = Math.min(0.5, Math.max(0.016, (now - lastSharkTick) / 1000));
  lastSharkTick = now;
  const targets = activePlayers().filter((player) => player.health > 0);
  for (const shark of serverSharks) {
    let target = null;
    let best = Infinity;
    for (const player of targets) {
      const d = distance(shark, player);
      if (d < best) {
        best = d;
        target = player;
      }
    }
    if (target) {
      shark.targetId = target.id;
      shark.facing = Math.atan2(target.y - shark.y, target.x - shark.x);
      shark.x = clamp(shark.x + Math.cos(shark.facing) * SERVER_SHARK_SPEED * dt, 80, WORLD - 80);
      shark.y = clamp(shark.y + Math.sin(shark.facing) * SERVER_SHARK_SPEED * dt, 80, WORLD - 80);
      if (best < 46 && now >= shark.biteAt) {
        const player = players.get(target.id);
        if (player) player.health = clamp((player.health || 100) - SERVER_SHARK_DAMAGE, 0, 100);
        shark.biteAt = now + SERVER_SHARK_BITE_MS;
      }
    } else {
      shark.targetId = null;
      shark.facing += (Math.random() - 0.5) * 0.35;
      shark.x = clamp(shark.x + Math.cos(shark.facing) * 34 * dt, 80, WORLD - 80);
      shark.y = clamp(shark.y + Math.sin(shark.facing) * 34 * dt, 80, WORLD - 80);
    }
  }
}

function serverSharkState() {
  return serverSharks.map(({ id, x, y, facing, targetId }) => ({ id, x, y, facing, targetId }));
}

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "POST" && req.url === "/api/join") {
    const body = await readBody(req);
    const id = crypto.randomUUID();
    players.set(id, playerFromBody(id, body));
    tickServerSharks();
    return sendJson(res, { id, scoreboard: scoreboard(), players: activePlayers(), serverSharks: serverSharkState() });
  }

  if (req.method === "POST" && req.url === "/api/state") {
    const body = await readBody(req);
    const id = String(body.id || crypto.randomUUID());
    players.set(id, playerFromBody(id, body, players.get(id)));
    tickServerSharks();
    return sendJson(res, { id, scoreboard: scoreboard(), players: activePlayers(), serverSharks: serverSharkState() });
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
