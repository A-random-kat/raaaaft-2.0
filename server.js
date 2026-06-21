const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const WORLD = 9600;
const TILE = 72;
const SPAWN_CLEARANCE = 620;
const ACTIVE_PLAYER_TIMEOUT_MS = 45_000;
const TOMBSTONE_MS = 30_000;
const MAX_BODY_BYTES = 1_500_000;
const SERVER_SHARK_COUNT = 2;
const SERVER_SHARK_SPEED = 110;
const SERVER_SHARK_DAMAGE = 36;

const ISLANDS = [
  { x: 1200, y: 1100, r: 215 },
  { x: 3000, y: 950, r: 260 },
  { x: 5200, y: 1200, r: 285 },
  { x: 8200, y: 1050, r: 330 },
  { x: 1500, y: 3000, r: 300 },
  { x: 4000, y: 3300, r: 430 },
  { x: 6500, y: 3100, r: 245 },
  { x: 8700, y: 3500, r: 275 },
  { x: 1150, y: 5500, r: 260 },
  { x: 3300, y: 5900, r: 225 },
  { x: 6000, y: 5600, r: 380 },
  { x: 8500, y: 5900, r: 230 },
  { x: 1700, y: 8250, r: 315 },
  { x: 4700, y: 8100, r: 260 },
  { x: 7800, y: 8350, r: 390 }
];

const SPAWN_POINTS = [
  { x: 520, y: 520 },
  { x: 9080, y: 520 },
  { x: 520, y: 9080 },
  { x: 9080, y: 9080 },
  { x: 4800, y: 520 },
  { x: 520, y: 4800 },
  { x: 9080, y: 4800 },
  { x: 4800, y: 9080 },
  { x: 2500, y: 470 },
  { x: 7100, y: 470 },
  { x: 470, y: 2500 },
  { x: 9130, y: 2500 },
  { x: 2500, y: 9130 },
  { x: 7100, y: 9130 }
];

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const players = new Map();
let lastTick = Date.now();
let nextProjectileId = 1;
let projectiles = [];

const sharks = Array.from({ length: SERVER_SHARK_COUNT }, (_, index) => ({
  id: `server-shark-${index + 1}`,
  x: 800 + Math.random() * (WORLD - 1600),
  y: 800 + Math.random() * (WORLD - 1600),
  facing: Math.random() * Math.PI * 2,
  targetId: null,
  biteAt: 0
}));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cleanId(value) {
  const id = String(value || "").trim().slice(0, 90);
  return /^[a-zA-Z0-9_.:-]{6,90}$/.test(id) ? id : crypto.randomUUID();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, data, status = 200) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanSlots(slots, limit = 40) {
  const source = Array.isArray(slots) ? slots : [];
  return source.slice(0, limit).map((item) => {
    if (!item || typeof item !== "object") return null;
    const id = String(item.id || "").slice(0, 32);
    if (!id || id === "empty") return null;
    const result = { id, qty: clamp(Math.floor(number(item.qty, 1)), 1, 9999) };
    if (item.durability !== undefined || item.maxDurability !== undefined) {
      result.maxDurability = clamp(number(item.maxDurability, 100), 1, 1000);
      result.durability = clamp(number(item.durability, result.maxDurability), 0, result.maxDurability);
      result.qty = 1;
    }
    return result;
  });
}

function sanitizeWorld(world) {
  if (!world || typeof world !== "object") return null;
  const raft = (Array.isArray(world.raft) ? world.raft : []).slice(0, 300).map((tile) => ({
    gx: Math.floor(number(tile?.gx)),
    gy: Math.floor(number(tile?.gy)),
    hp: clamp(number(tile?.hp, 120), 0, 600),
    maxHp: clamp(number(tile?.maxHp, 120), 1, 600)
  }));
  const structures = (Array.isArray(world.structures) ? world.structures : []).slice(0, 320).map((item) => ({
    id: String(item?.id || "").slice(0, 50),
    type: String(item?.type || "chest").slice(0, 24),
    x: clamp(number(item?.x), 0, WORLD),
    y: clamp(number(item?.y), 0, WORLD),
    angle: number(item?.angle),
    base: item?.base === "island" ? "island" : "raft",
    hp: clamp(number(item?.hp, 80), 0, 800),
    maxHp: clamp(number(item?.maxHp, 80), 1, 800),
    timer: clamp(number(item?.timer), 0, 1200),
    maxTimer: clamp(number(item?.maxTimer), 0, 1200),
    ready: Boolean(item?.ready),
    hasGlass: Boolean(item?.hasGlass),
    planted: Boolean(item?.planted),
    cooking: item?.cooking ? String(item.cooking).slice(0, 32) : null,
    aimOffset: clamp(number(item?.aimOffset), -Math.PI / 2, Math.PI / 2),
    cooldown: clamp(number(item?.cooldown), 0, 20),
    storage: item?.type === "chest" ? cleanSlots(item.storage, 40) : null
  }));
  return {
    version: Math.max(0, Math.floor(number(world.version))),
    raftOffset: {
      x: clamp(number(world.raftOffset?.x), 0, WORLD),
      y: clamp(number(world.raftOffset?.y), 0, WORLD)
    },
    raft,
    structures
  };
}

function tileKey(tile) {
  return `${tile.gx},${tile.gy}`;
}

function raftTileRect(world, tile) {
  return {
    x: world.raftOffset.x + tile.gx * TILE,
    y: world.raftOffset.y + tile.gy * TILE,
    w: TILE,
    h: TILE
  };
}

function raftBounds(world) {
  if (!world?.raft?.length) {
    const x = world?.raftOffset?.x || 0;
    const y = world?.raftOffset?.y || 0;
    return { minX: x, minY: y, maxX: x + TILE, maxY: y + TILE };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const tile of world.raft) {
    const rect = raftTileRect(world, tile);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + TILE);
    maxY = Math.max(maxY, rect.y + TILE);
  }
  return { minX, minY, maxX, maxY };
}

function raftCenter(world) {
  const bounds = raftBounds(world);
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
}

function activePlayerRecords() {
  const cutoff = Date.now() - ACTIVE_PLAYER_TIMEOUT_MS;
  for (const [id, player] of players) {
    if (player.seen < cutoff) players.delete(id);
  }
  return [...players.values()];
}

function spawnIsClear(point, ignoreId = null) {
  if (ISLANDS.some((island) => distance(point, island) < island.r + 280)) return false;
  for (const player of activePlayerRecords()) {
    if (player.id === ignoreId) continue;
    const center = player.world ? raftCenter(player.world) : player;
    if (distance(point, center) < SPAWN_CLEARANCE) return false;
  }
  return true;
}

function chooseSpawn(preferred, ignoreId = null) {
  if (preferred && spawnIsClear(preferred, ignoreId)) return preferred;
  for (const point of SPAWN_POINTS) {
    if (spawnIsClear(point, ignoreId)) return point;
  }
  for (let attempt = 0; attempt < 180; attempt++) {
    const point = {
      x: 420 + Math.random() * (WORLD - 840),
      y: 420 + Math.random() * (WORLD - 840)
    };
    if (spawnIsClear(point, ignoreId)) return point;
  }
  return { x: 520 + Math.random() * 700, y: 520 + Math.random() * 700 };
}

function shiftWorldToSpawn(world, player, spawn) {
  if (!world) return;
  const center = raftCenter(world);
  const dx = spawn.x - center.x;
  const dy = spawn.y - center.y;
  world.raftOffset.x = clamp(world.raftOffset.x + dx, 0, WORLD - TILE);
  world.raftOffset.y = clamp(world.raftOffset.y + dy, 0, WORLD - TILE);
  for (const structure of world.structures) {
    if (structure.base === "raft") {
      structure.x = clamp(structure.x + dx, 0, WORLD);
      structure.y = clamp(structure.y + dy, 0, WORLD);
    }
  }
  const shiftedCenter = raftCenter(world);
  player.x = clamp(shiftedCenter.x, 80, WORLD - 80);
  player.y = clamp(shiftedCenter.y, 80, WORLD - 80);
  player.onRaft = true;
  player.onIsland = false;
  player.spawnedAt = Date.now();
}

function cleanTombstones(map) {
  const result = map instanceof Map ? map : new Map();
  const cutoff = Date.now() - TOMBSTONE_MS;
  for (const [key, timestamp] of result) {
    if (timestamp < cutoff) result.delete(key);
  }
  return result;
}

function mergeWorld(existingPlayer, incoming) {
  if (!incoming) return existingPlayer?.world || null;
  const destroyedStructures = cleanTombstones(existingPlayer?.destroyedStructures);
  const destroyedTiles = cleanTombstones(existingPlayer?.destroyedTiles);
  incoming.structures = incoming.structures.filter((item) => !destroyedStructures.has(item.id));
  incoming.raft = incoming.raft.filter((tile) => !destroyedTiles.has(tileKey(tile)));
  if (!existingPlayer?.world) return incoming;

  const oldStructures = new Map(existingPlayer.world.structures.map((item) => [item.id, item]));
  for (const structure of incoming.structures) {
    const old = oldStructures.get(structure.id);
    if (!old) continue;
    structure.hp = Math.min(structure.hp, old.hp);
    if (old.timer > 0 || old.ready) {
      structure.timer = old.timer;
      structure.maxTimer = old.maxTimer;
      structure.ready = old.ready;
      structure.hasGlass = old.hasGlass;
      structure.planted = old.planted;
      structure.cooking = old.cooking;
    }
    structure.cooldown = Math.max(structure.cooldown, old.cooldown);
    if (structure.type === "chest" && old.storage) structure.storage = structure.storage || old.storage;
  }

  const oldTiles = new Map(existingPlayer.world.raft.map((tile) => [tileKey(tile), tile]));
  for (const tile of incoming.raft) {
    const old = oldTiles.get(tileKey(tile));
    if (old) tile.hp = Math.min(tile.hp, old.hp);
  }
  return incoming;
}

function playerFromBody(id, body, existing = null) {
  const world = mergeWorld(existing, sanitizeWorld(body.world || existing?.world));
  return {
    id,
    name: String(body.name || existing?.name || "Player").slice(0, 18),
    level: Math.max(1, Math.floor(number(body.level, existing?.level || 1))),
    xp: Math.max(0, number(body.xp, existing?.xp || 0)),
    health: clamp(number(body.health, existing?.health || 100), 0, 100),
    stamina: clamp(number(body.stamina, existing?.stamina || 100), 0, 100),
    selectedItem: String(body.selectedItem || existing?.selectedItem || "empty").slice(0, 24),
    x: clamp(number(body.x, existing?.x || WORLD / 2), 0, WORLD),
    y: clamp(number(body.y, existing?.y || WORLD / 2), 0, WORLD),
    facing: number(body.facing, existing?.facing || 0),
    onIsland: Boolean(body.onIsland),
    onRaft: Boolean(body.onRaft),
    spawnedAt: existing?.spawnedAt || number(body.spawnedAt),
    seen: Date.now(),
    world,
    destroyedStructures: cleanTombstones(existing?.destroyedStructures),
    destroyedTiles: cleanTombstones(existing?.destroyedTiles)
  };
}

function publicPlayers() {
  return activePlayerRecords().map((player) => ({
    id: player.id,
    name: player.name,
    level: player.level,
    xp: player.xp,
    health: player.health,
    stamina: player.stamina,
    selectedItem: player.selectedItem,
    x: player.x,
    y: player.y,
    facing: player.facing,
    onIsland: player.onIsland,
    onRaft: player.onRaft,
    spawnedAt: player.spawnedAt
  }));
}

function publicWorlds(viewerId) {
  const result = {};
  const viewer = players.get(viewerId);
  const active = activePlayerRecords().sort((a, b) => (a.id === viewerId ? -1 : b.id === viewerId ? 1 : 0));
  let included = 0;
  for (const player of active) {
    if (player.id !== viewerId && viewer && distance(player, viewer) > 3200) continue;
    if (player.world) result[player.id] = player.world;
    included += 1;
    if (included >= 18) break;
  }
  return result;
}

function scoreboard() {
  return publicPlayers()
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 16);
}

function removeStructure(owner, structure) {
  owner.world.structures = owner.world.structures.filter((item) => item !== structure);
  owner.destroyedStructures.set(structure.id, Date.now());
}

function removeRaftTile(owner, tile) {
  const rect = raftTileRect(owner.world, tile);
  const destroyedStructures = owner.world.structures.filter(
    (item) =>
      item.base === "raft" &&
      item.x >= rect.x &&
      item.x <= rect.x + rect.w &&
      item.y >= rect.y &&
      item.y <= rect.y + rect.h
  );
  for (const structure of destroyedStructures) owner.destroyedStructures.set(structure.id, Date.now());
  owner.world.structures = owner.world.structures.filter((item) => !destroyedStructures.includes(item));
  owner.world.raft = owner.world.raft.filter((item) => item !== tile);
  owner.destroyedTiles.set(tileKey(tile), Date.now());
}

function applyRaftCommands(commands) {
  for (const command of Array.isArray(commands) ? commands.slice(0, 24) : []) {
    const owner = players.get(String(command?.ownerId || ""));
    if (!owner?.world) continue;
    const dx = clamp(number(command.dx), -180, 180);
    const dy = clamp(number(command.dy), -180, 180);
    owner.world.raftOffset.x = clamp(owner.world.raftOffset.x + dx, 0, WORLD - TILE);
    owner.world.raftOffset.y = clamp(owner.world.raftOffset.y + dy, 0, WORLD - TILE);
    for (const structure of owner.world.structures) {
      if (structure.base === "raft") {
        structure.x = clamp(structure.x + dx, 0, WORLD);
        structure.y = clamp(structure.y + dy, 0, WORLD);
      }
    }
  }
}

function applyWorldCommands(commands) {
  for (const command of Array.isArray(commands) ? commands.slice(0, 80) : []) {
    const owner = players.get(String(command?.ownerId || ""));
    if (!owner?.world) continue;
    if (command.type === "damageStructure") {
      const structure = owner.world.structures.find((item) => item.id === String(command.structureId || ""));
      if (!structure) continue;
      structure.hp = clamp(structure.hp - clamp(number(command.damage), 0, 220), 0, structure.maxHp);
      if (structure.hp <= 0) removeStructure(owner, structure);
    } else if (command.type === "damageRaftTile") {
      const gx = Math.floor(number(command.gx));
      const gy = Math.floor(number(command.gy));
      const tile = owner.world.raft.find((item) => item.gx === gx && item.gy === gy);
      if (!tile) continue;
      tile.hp = clamp(tile.hp - clamp(number(command.damage), 0, 240), 0, tile.maxHp);
      if (tile.hp <= 0) removeRaftTile(owner, tile);
    } else if (command.type === "patchStructure") {
      const structure = owner.world.structures.find((item) => item.id === String(command.structureId || ""));
      const patch = command.patch;
      if (!structure || !patch || typeof patch !== "object") continue;
      if (patch.timer !== undefined) structure.timer = clamp(number(patch.timer), 0, 1200);
      if (patch.maxTimer !== undefined) structure.maxTimer = clamp(number(patch.maxTimer), 0, 1200);
      if (patch.ready !== undefined) structure.ready = Boolean(patch.ready);
      if (patch.hasGlass !== undefined) structure.hasGlass = Boolean(patch.hasGlass);
      if (patch.planted !== undefined) structure.planted = Boolean(patch.planted);
      if (patch.cooking !== undefined) structure.cooking = patch.cooking ? String(patch.cooking).slice(0, 32) : null;
      if (patch.aimOffset !== undefined) structure.aimOffset = clamp(number(patch.aimOffset), -Math.PI / 2, Math.PI / 2);
      if (patch.cooldown !== undefined) structure.cooldown = clamp(number(patch.cooldown), 0, 20);
      if (structure.type === "chest" && Array.isArray(patch.storage)) structure.storage = cleanSlots(patch.storage, 40);
    }
  }
}

function applyPlayerHits(attackerId, hits) {
  for (const hit of Array.isArray(hits) ? hits.slice(0, 24) : []) {
    const targetId = String(hit?.targetId || "");
    if (!targetId || targetId === attackerId) continue;
    const target = players.get(targetId);
    if (!target) continue;
    target.health = clamp(target.health - clamp(number(hit.damage), 0, 120), 0, 100);
  }
}

function applyProjectileCommands(commands) {
  for (const command of Array.isArray(commands) ? commands.slice(0, 24) : []) {
    const type = String(command?.type || "");
    if (type !== "musketBall" && type !== "cannonball") continue;
    projectiles.push({
      id: `projectile-${nextProjectileId++}`,
      type,
      x: clamp(number(command.x), 0, WORLD),
      y: clamp(number(command.y), 0, WORLD),
      vx: clamp(number(command.vx), -900, 900),
      vy: clamp(number(command.vy), -900, 900),
      life: clamp(number(command.life, 1), 0.05, 4),
      damage: clamp(number(command.damage, 20), 1, 120),
      radius: clamp(number(command.radius, 8), 1, 120)
    });
  }
  if (projectiles.length > 160) projectiles = projectiles.slice(-160);
}

function shortAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function steerAroundIslands(entity, desired) {
  let angle = desired;
  for (const island of ISLANDS) {
    const gap = distance(entity, island);
    const look = {
      x: entity.x + Math.cos(angle) * 150,
      y: entity.y + Math.sin(angle) * 150
    };
    if (gap > island.r + 250 && distance(look, island) > island.r + 105) continue;
    const away = Math.atan2(entity.y - island.y, entity.x - island.x);
    const side = shortAngle(angle - away) >= 0 ? 1 : -1;
    const target = gap < island.r + 82 ? away : away + side * Math.PI / 2;
    angle += shortAngle(target - angle) * 0.72;
  }
  return angle;
}

function tickWorld() {
  const now = Date.now();
  const dt = clamp((now - lastTick) / 1000, 0.016, 0.5);
  lastTick = now;

  for (const player of activePlayerRecords()) {
    if (!player.world) continue;
    for (const structure of player.world.structures) {
      if (structure.timer > 0) {
        structure.timer = Math.max(0, structure.timer - dt);
        if (structure.timer === 0) structure.ready = true;
      }
      structure.cooldown = Math.max(0, structure.cooldown - dt);
    }
  }

  const targets = activePlayerRecords().filter(
    (player) => player.health > 0 && !player.onIsland && (!player.spawnedAt || now - player.spawnedAt > 5000)
  );
  for (const shark of sharks) {
    let target = null;
    let best = Infinity;
    for (const player of targets) {
      const gap = distance(shark, player);
      if (gap < best) {
        best = gap;
        target = player;
      }
    }
    if (target) {
      shark.targetId = target.id;
      const desired = steerAroundIslands(shark, Math.atan2(target.y - shark.y, target.x - shark.x));
      shark.facing += shortAngle(desired - shark.facing) * Math.min(1, dt * 3);
      const speed = best < 46 && now < shark.biteAt ? SERVER_SHARK_SPEED * 0.3 : SERVER_SHARK_SPEED;
      shark.x = clamp(shark.x + Math.cos(shark.facing) * speed * dt, 80, WORLD - 80);
      shark.y = clamp(shark.y + Math.sin(shark.facing) * speed * dt, 80, WORLD - 80);
      if (best < 46 && now >= shark.biteAt) {
        const victim = players.get(target.id);
        if (victim) victim.health = clamp(victim.health - SERVER_SHARK_DAMAGE, 0, 100);
        shark.biteAt = now + 1300;
      }
    } else {
      shark.targetId = null;
      if (Math.random() < dt * 0.3) shark.facing += (Math.random() - 0.5) * 0.35;
      shark.facing = steerAroundIslands(shark, shark.facing);
      shark.x = clamp(shark.x + Math.cos(shark.facing) * 34 * dt, 80, WORLD - 80);
      shark.y = clamp(shark.y + Math.sin(shark.facing) * 34 * dt, 80, WORLD - 80);
    }
  }

  for (const projectile of projectiles) {
    projectile.life -= dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
  }
  projectiles = projectiles.filter(
    (item) => item.life > 0 && item.x >= 0 && item.x <= WORLD && item.y >= 0 && item.y <= WORLD
  );
}

function snapshot(id) {
  return {
    id,
    scoreboard: scoreboard(),
    players: publicPlayers(),
    worlds: publicWorlds(id),
    serverSharks: sharks.map(({ id: sharkId, x, y, facing, targetId }) => ({ id: sharkId, x, y, facing, targetId })),
    serverProjectiles: projectiles.map(({ id: projectileId, type, x, y, vx, vy, life, damage, radius }) => ({
      id: projectileId,
      type,
      x,
      y,
      vx,
      vy,
      life,
      damage,
      radius
    }))
  };
}

async function handleRequest(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, { ok: true, players: activePlayerRecords().length });
    return;
  }

  if (req.method === "POST" && req.url === "/api/join") {
    const body = await readBody(req);
    let id = cleanId(body.id || body.clientId);
    const resume = Boolean(body.resume);
    if (!resume && players.has(id)) id = crypto.randomUUID();
    const existing = players.get(id) || null;
    const player = playerFromBody(id, body, existing);
    if (!existing) {
      const preferred = player.world ? raftCenter(player.world) : player;
      shiftWorldToSpawn(player.world, player, chooseSpawn(preferred, id));
    }
    players.set(id, player);
    tickWorld();
    sendJson(res, snapshot(id));
    return;
  }

  if (req.method === "POST" && req.url === "/api/state") {
    const body = await readBody(req);
    const id = cleanId(body.id || body.clientId);
    const existing = players.get(id) || null;
    const player = playerFromBody(id, body, existing);
    if (!existing && player.world) {
      const preferred = raftCenter(player.world);
      shiftWorldToSpawn(player.world, player, chooseSpawn(preferred, id));
    }
    players.set(id, player);
    applyRaftCommands(body.raftCommands);
    applyWorldCommands(body.worldCommands);
    applyProjectileCommands(body.projectileCommands);
    applyPlayerHits(id, body.playerHits);
    tickWorld();
    sendJson(res, snapshot(id));
    return;
  }

  const urlPath = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.normalize(path.join(root, urlPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=300"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("Request failed:", error);
    sendJson(res, { error: "Server request failed" }, 500);
  });
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

if (require.main === module) {
  server.listen(port, host, () => {
    console.log(`Raaaaft.io server running on ${host}:${port}`);
  });
}

module.exports = {
  players,
  sanitizeWorld,
  playerFromBody,
  raftCenter,
  chooseSpawn,
  shiftWorldToSpawn
};
