const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const WORLD = 9600;
const TILE = 72;
const SPAWN_CLEARANCE = 520;
const SERVER_ISLANDS = [
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
const SERVER_AGGRESSIVE_SHARKS = 2;
const SERVER_SHARK_SPEED = 115;
const SERVER_SHARK_DAMAGE = 36;
const SERVER_SHARK_BITE_MS = 1300;
const TOMBSTONE_MS = 5000;
const players = new Map();
let lastSharkTick = Date.now();
let lastWorldTick = Date.now();
let nextProjectileId = 1;
let serverProjectiles = [];

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
      if (body.length > 1_000_000) req.destroy();
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

function shortAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function steerServerSharkAroundIslands(shark, desiredAngle) {
  let angle = desiredAngle;
  for (const island of SERVER_ISLANDS) {
    const d = distance(shark, island);
    const look = {
      x: shark.x + Math.cos(angle) * 150,
      y: shark.y + Math.sin(angle) * 150
    };
    const aboutToHit = distance(look, island) < island.r + 105;
    if (d > island.r + 250 && !aboutToHit) continue;
    const away = Math.atan2(shark.y - island.y, shark.x - island.x);
    const side = shortAngle(angle - away) >= 0 ? 1 : -1;
    const tangent = away + side * Math.PI / 2;
    const target = d < island.r + 86 ? away : tangent;
    angle += shortAngle(target - angle) * (aboutToHit ? 0.82 : 0.4);
  }
  return angle;
}

function keepServerSharkOffLand(shark) {
  for (const island of SERVER_ISLANDS) {
    const d = distance(shark, island);
    const min = island.r + 58;
    if (d > 0 && d < min) {
      const a = Math.atan2(shark.y - island.y, shark.x - island.x);
      shark.x = island.x + Math.cos(a) * min;
      shark.y = island.y + Math.sin(a) * min;
      shark.facing += shortAngle(a - shark.facing) * 0.7;
    }
  }
}

function cleanSlot(item) {
  if (!item || typeof item !== "object") return null;
  const id = String(item.id || "").slice(0, 32);
  const qty = Math.max(1, Math.min(9999, Math.floor(cleanNumber(item.qty, 1))));
  if (!id || id === "empty") return null;
  const cleaned = { id, qty };
  if (item.durability !== undefined || item.maxDurability !== undefined) {
    cleaned.maxDurability = clamp(cleanNumber(item.maxDurability, 100), 1, 1000);
    cleaned.durability = clamp(cleanNumber(item.durability, cleaned.maxDurability), 0, cleaned.maxDurability);
    cleaned.qty = 1;
  }
  return cleaned;
}

function cleanSlots(slots, max) {
  const source = Array.isArray(slots) ? slots : [];
  return Array.from({ length: max }, (_, i) => cleanSlot(source[i]));
}

function cleanHitbox(hitbox) {
  if (!hitbox || typeof hitbox !== "object") return null;
  return {
    w: clamp(cleanNumber(hitbox.w, 32), 1, 160),
    h: clamp(cleanNumber(hitbox.h, 32), 1, 160)
  };
}

function cleanTombstones(source) {
  const now = Date.now();
  const map = source instanceof Map ? source : new Map();
  for (const [key, seenAt] of map) {
    if (now - seenAt > TOMBSTONE_MS) map.delete(key);
  }
  return map;
}

function markTombstone(player, collection, key) {
  if (!key) return;
  if (!(player[collection] instanceof Map)) player[collection] = new Map();
  player[collection].set(String(key), Date.now());
}

function tileKey(tile) {
  return `${Math.floor(cleanNumber(tile?.gx, 0))},${Math.floor(cleanNumber(tile?.gy, 0))}`;
}

function serverTileRect(world, tile) {
  return {
    x: (world.raftOffset?.x || 0) + tile.gx * 72,
    y: (world.raftOffset?.y || 0) + tile.gy * 72,
    w: 72,
    h: 72
  };
}

function structureOnTile(world, st, tile) {
  const r = serverTileRect(world, tile);
  return st.x > r.x && st.x < r.x + r.w && st.y > r.y && st.y < r.y + r.h;
}

function raftBounds(world) {
  const tiles = world?.raft || [];
  if (!tiles.length || !world?.raftOffset) {
    return { minX: world?.raftOffset?.x || 0, minY: world?.raftOffset?.y || 0, maxX: world?.raftOffset?.x || 0, maxY: world?.raftOffset?.y || 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const tile of tiles) {
    const r = serverTileRect(world, tile);
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { minX, minY, maxX, maxY };
}

function raftCenter(world) {
  const b = raftBounds(world);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

function isSpawnClear(point) {
  if (SERVER_ISLANDS.some((island) => Math.hypot(point.x - island.x, point.y - island.y) < island.r + 260)) return false;
  for (const player of activePlayers()) {
    if (Math.hypot(point.x - player.x, point.y - player.y) < SPAWN_CLEARANCE) return false;
    const stored = players.get(player.id);
    if (stored?.world && Math.hypot(point.x - raftCenter(stored.world).x, point.y - raftCenter(stored.world).y) < SPAWN_CLEARANCE) return false;
  }
  return true;
}

function chooseSpawnPoint(preferred = null) {
  if (preferred && isSpawnClear(preferred)) return preferred;
  for (const point of SPAWN_POINTS) {
    if (isSpawnClear(point)) return point;
  }
  for (let i = 0; i < 100; i++) {
    const point = { x: 420 + Math.random() * (WORLD - 840), y: 420 + Math.random() * (WORLD - 840) };
    if (isSpawnClear(point)) return point;
  }
  return { x: 520 + Math.random() * 600, y: 520 + Math.random() * 600 };
}

function shiftWorldToSpawn(world, player, spawn) {
  if (!world || !world.raftOffset) return;
  const center = raftCenter(world);
  const dx = spawn.x - center.x;
  const dy = spawn.y - center.y;
  world.raftOffset.x = clamp(world.raftOffset.x + dx, 0, WORLD);
  world.raftOffset.y = clamp(world.raftOffset.y + dy, 0, WORLD);
  for (const st of world.structures || []) {
    st.x = clamp(st.x + dx, 0, WORLD);
    st.y = clamp(st.y + dy, 0, WORLD);
  }
  player.x = clamp(player.x + dx, 80, WORLD - 80);
  player.y = clamp(player.y + dy, 80, WORLD - 80);
  if (!world.raft?.length) {
    world.raftOffset.x = spawn.x - TILE / 2;
    world.raftOffset.y = spawn.y - TILE / 2;
  }
  player.spawnedAt = Date.now();
}

function sanitizeWorld(world) {
  if (!world || typeof world !== "object") return null;
  const raft = (Array.isArray(world.raft) ? world.raft : []).slice(0, 240).map((tile) => ({
    gx: Math.floor(cleanNumber(tile?.gx, 0)),
    gy: Math.floor(cleanNumber(tile?.gy, 0)),
    hp: clamp(cleanNumber(tile?.hp, 120), 0, 500),
    maxHp: clamp(cleanNumber(tile?.maxHp, 120), 1, 500)
  }));
  const structures = (Array.isArray(world.structures) ? world.structures : []).slice(0, 260).map((st) => ({
    id: String(st?.id || "").slice(0, 32),
    type: String(st?.type || "chest").slice(0, 24),
    x: clamp(cleanNumber(st?.x, 0), 0, WORLD),
    y: clamp(cleanNumber(st?.y, 0), 0, WORLD),
    angle: cleanNumber(st?.angle, 0),
    base: st?.base === "island" ? "island" : "raft",
    hp: clamp(cleanNumber(st?.hp, 80), 0, 600),
    maxHp: clamp(cleanNumber(st?.maxHp, 80), 1, 600),
    hitbox: cleanHitbox(st?.hitbox),
    timer: clamp(cleanNumber(st?.timer, 0), 0, 1200),
    maxTimer: clamp(cleanNumber(st?.maxTimer, 0), 0, 1200),
    ready: Boolean(st?.ready),
    hasGlass: Boolean(st?.hasGlass),
    planted: Boolean(st?.planted),
    cooking: st?.cooking ? String(st.cooking).slice(0, 32) : null,
    aimOffset: clamp(cleanNumber(st?.aimOffset, 0), -Math.PI / 2, Math.PI / 2),
    cooldown: clamp(cleanNumber(st?.cooldown, 0), 0, 20),
    storage: st?.type === "chest" ? cleanSlots(st.storage, 40) : null
  }));
  const animals = (Array.isArray(world.animals) ? world.animals : []).slice(0, 180).map((a) => ({
    id: String(a?.id || "").slice(0, 32),
    type: String(a?.type || "crab").slice(0, 20),
    x: clamp(cleanNumber(a?.x, 0), 0, WORLD),
    y: clamp(cleanNumber(a?.y, 0), 0, WORLD),
    hp: clamp(cleanNumber(a?.hp, 20), 0, 300),
    maxHp: clamp(cleanNumber(a?.maxHp, 20), 1, 300),
    submerged: Boolean(a?.submerged)
  }));
  const sharks = (Array.isArray(world.sharks) ? world.sharks : []).slice(0, 80).map((s) => ({
    id: String(s?.id || "").slice(0, 32),
    x: clamp(cleanNumber(s?.x, 0), 0, WORLD),
    y: clamp(cleanNumber(s?.y, 0), 0, WORLD),
    hp: clamp(cleanNumber(s?.hp, 120), 0, 300),
    aggressive: Boolean(s?.aggressive),
    serverControlled: Boolean(s?.serverControlled)
  }));
  const debris = (Array.isArray(world.debris) ? world.debris : []).slice(0, 240).map((d) => ({
    id: String(d?.id || "").slice(0, 32),
    type: String(d?.type || "wood").slice(0, 24),
    x: clamp(cleanNumber(d?.x, 0), 0, WORLD),
    y: clamp(cleanNumber(d?.y, 0), 0, WORLD),
    vx: clamp(cleanNumber(d?.vx, 0), -120, 120),
    vy: clamp(cleanNumber(d?.vy, 0), -120, 120),
    stopped: Boolean(d?.stopped),
    life: clamp(cleanNumber(d?.life, 0), 0, 300)
  }));
  const trees = (Array.isArray(world.trees) ? world.trees : []).slice(0, 420).map((tree) => ({
    id: String(tree?.id || "").slice(0, 36),
    islandIndex: clamp(Math.floor(cleanNumber(tree?.islandIndex, 0)), 0, 100),
    x: clamp(cleanNumber(tree?.x, 0), 0, WORLD),
    y: clamp(cleanNumber(tree?.y, 0), 0, WORLD),
    hp: clamp(cleanNumber(tree?.hp, 40), 0, 200),
    maxHp: clamp(cleanNumber(tree?.maxHp, 40), 1, 200),
    dead: Boolean(tree?.dead),
    respawn: clamp(cleanNumber(tree?.respawn, 0), 0, 1200)
  }));
  return {
    raftOffset: {
      x: clamp(cleanNumber(world.raftOffset?.x, 0), 0, WORLD),
      y: clamp(cleanNumber(world.raftOffset?.y, 0), 0, WORLD)
    },
    raft,
    structures,
    animals,
    sharks,
    debris,
    trees,
    inventory: cleanSlots(world.inventory, 20),
    hotbar: cleanSlots(world.hotbar, 10),
    resources: Object.fromEntries(Object.entries(world.resources || {}).slice(0, 40).map(([key, value]) => [String(key).slice(0, 32), clamp(cleanNumber(value, 0), 0, 999999)])),
    unlocks: Object.fromEntries(Object.entries(world.unlocks || {}).slice(0, 12).map(([key, value]) => [String(key).slice(0, 24), String(value).slice(0, 24)]))
  };
}

function mergeSubmittedWorld(existing, incoming, destroyedStructures, destroyedTiles) {
  if (!incoming) return existing?.world || null;
  incoming.structures = (incoming.structures || []).filter((st) => !destroyedStructures.has(st.id));
  incoming.raft = (incoming.raft || []).filter((tile) => !destroyedTiles.has(tileKey(tile)));
  if (!existing?.world) return incoming;

  const previousStructures = new Map((existing.world.structures || []).map((st) => [st.id, st]));
  for (const st of incoming.structures || []) {
    const old = previousStructures.get(st.id);
    if (!old) continue;
    st.hp = Math.min(st.hp, old.hp);
    if (old.cooldown > st.cooldown) st.cooldown = old.cooldown;
    if (old.timer > 0 && st.timer <= 0 && !st.ready) {
      st.timer = old.timer;
      st.maxTimer = old.maxTimer;
      st.ready = old.ready;
      st.hasGlass = old.hasGlass;
      st.planted = old.planted;
      st.cooking = old.cooking;
    }
    if (st.type === "chest" && old.storage) st.storage = st.storage || old.storage;
  }

  const previousTiles = new Map((existing.world.raft || []).map((tile) => [tileKey(tile), tile]));
  for (const tile of incoming.raft || []) {
    const old = previousTiles.get(tileKey(tile));
    if (old) tile.hp = Math.min(tile.hp, old.hp);
  }
  return incoming;
}

function applyPlayerHits(attackerId, hits) {
  for (const hit of Array.isArray(hits) ? hits.slice(0, 24) : []) {
    const targetId = String(hit?.targetId || "");
    if (!targetId || targetId === attackerId) continue;
    const target = players.get(targetId);
    if (!target) continue;
    const damage = clamp(cleanNumber(hit.damage, 0), 0, 120);
    target.health = clamp((target.health || 100) - damage, 0, 100);
  }
}

function applyRaftCommands(commands) {
  for (const command of Array.isArray(commands) ? commands.slice(0, 20) : []) {
    const ownerId = String(command?.ownerId || "");
    const owner = players.get(ownerId);
    if (!owner?.world) continue;
    const dx = clamp(cleanNumber(command.dx, 0), -180, 180);
    const dy = clamp(cleanNumber(command.dy, 0), -180, 180);
    owner.world.raftOffset.x = clamp(owner.world.raftOffset.x + dx, 0, WORLD);
    owner.world.raftOffset.y = clamp(owner.world.raftOffset.y + dy, 0, WORLD);
    for (const st of owner.world.structures || []) {
      if (st.base === "raft") {
        st.x = clamp(st.x + dx, 0, WORLD);
        st.y = clamp(st.y + dy, 0, WORLD);
      }
    }
  }
}

function removeServerStructure(owner, structure) {
  if (!owner?.world || !structure) return;
  owner.world.structures = (owner.world.structures || []).filter((st) => st !== structure);
  markTombstone(owner, "destroyedStructures", structure.id);
}

function removeServerRaftTile(owner, tile) {
  if (!owner?.world || !tile) return;
  const doomedStructures = (owner.world.structures || []).filter((st) => st.base === "raft" && structureOnTile(owner.world, st, tile));
  for (const st of doomedStructures) markTombstone(owner, "destroyedStructures", st.id);
  owner.world.structures = (owner.world.structures || []).filter((st) => !doomedStructures.includes(st));
  owner.world.raft = (owner.world.raft || []).filter((item) => item !== tile);
  markTombstone(owner, "destroyedTiles", tileKey(tile));
}

function applyStructurePatch(st, patch) {
  if (!st || !patch || typeof patch !== "object") return;
  if (patch.timer !== undefined) st.timer = clamp(cleanNumber(patch.timer, st.timer || 0), 0, 1200);
  if (patch.maxTimer !== undefined) st.maxTimer = clamp(cleanNumber(patch.maxTimer, st.maxTimer || 0), 0, 1200);
  if (patch.ready !== undefined) st.ready = Boolean(patch.ready);
  if (patch.hasGlass !== undefined) st.hasGlass = Boolean(patch.hasGlass);
  if (patch.planted !== undefined) st.planted = Boolean(patch.planted);
  if (patch.cooking !== undefined) st.cooking = patch.cooking ? String(patch.cooking).slice(0, 32) : null;
  if (patch.aimOffset !== undefined) st.aimOffset = clamp(cleanNumber(patch.aimOffset, st.aimOffset || 0), -Math.PI / 2, Math.PI / 2);
  if (patch.cooldown !== undefined) st.cooldown = clamp(cleanNumber(patch.cooldown, st.cooldown || 0), 0, 20);
  if (st.type === "chest" && Array.isArray(patch.storage)) st.storage = cleanSlots(patch.storage, 40);
}

function applyWorldCommands(commands) {
  for (const command of Array.isArray(commands) ? commands.slice(0, 48) : []) {
    const ownerId = String(command?.ownerId || "");
    const owner = players.get(ownerId);
    if (!owner?.world) continue;
    if (command.type === "damageStructure") {
      const structureId = String(command.structureId || "");
      const st = (owner.world.structures || []).find((item) => item.id === structureId);
      if (!st) continue;
      st.hp = clamp(st.hp - clamp(cleanNumber(command.damage, 0), 0, 200), 0, st.maxHp || 600);
      if (st.hp <= 0) removeServerStructure(owner, st);
    } else if (command.type === "damageRaftTile") {
      const gx = Math.floor(cleanNumber(command.gx, 0));
      const gy = Math.floor(cleanNumber(command.gy, 0));
      const tile = (owner.world.raft || []).find((item) => item.gx === gx && item.gy === gy);
      if (!tile) continue;
      tile.hp = clamp(tile.hp - clamp(cleanNumber(command.damage, 0), 0, 220), 0, tile.maxHp || 500);
      if (tile.hp <= 0) removeServerRaftTile(owner, tile);
    } else if (command.type === "patchStructure") {
      const structureId = String(command.structureId || "");
      const st = (owner.world.structures || []).find((item) => item.id === structureId);
      applyStructurePatch(st, command.patch);
    }
  }
}

function applyProjectileCommands(commands) {
  for (const command of Array.isArray(commands) ? commands.slice(0, 24) : []) {
    const type = String(command?.type || "");
    if (type !== "musketBall" && type !== "cannonball") continue;
    serverProjectiles.push({
      id: `projectile-${nextProjectileId++}`,
      type,
      x: clamp(cleanNumber(command.x, 0), 0, WORLD),
      y: clamp(cleanNumber(command.y, 0), 0, WORLD),
      vx: clamp(cleanNumber(command.vx, 0), -900, 900),
      vy: clamp(cleanNumber(command.vy, 0), -900, 900),
      life: clamp(cleanNumber(command.life, type === "cannonball" ? 1.28 : 1.05), 0.05, 4),
      damage: clamp(cleanNumber(command.damage, type === "cannonball" ? 42 : 21), 1, 120),
      radius: clamp(cleanNumber(command.radius, type === "cannonball" ? 52 : 8), 1, 120)
    });
  }
  if (serverProjectiles.length > 160) serverProjectiles = serverProjectiles.slice(-160);
}

function tickServerWorlds() {
  const now = Date.now();
  const dt = Math.min(0.5, Math.max(0.016, (now - lastWorldTick) / 1000));
  lastWorldTick = now;
  for (const player of players.values()) {
    if (!player.world) continue;
    cleanTombstones(player.destroyedStructures);
    cleanTombstones(player.destroyedTiles);
    for (const st of player.world.structures || []) {
      if ((st.type === "grill" || st.type === "waterMaker" || st.type === "plantPot") && st.timer > 0) {
        st.timer = Math.max(0, st.timer - dt);
        if (st.timer <= 0) st.ready = true;
      }
      if (st.type === "cannon") st.cooldown = Math.max(0, (st.cooldown || 0) - dt);
    }
  }
  for (const shot of serverProjectiles) {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }
  serverProjectiles = serverProjectiles.filter((shot) => shot.life > 0 && shot.x >= 0 && shot.x <= WORLD && shot.y >= 0 && shot.y <= WORLD);
}

function serverProjectileState() {
  return serverProjectiles.map(({ id, type, x, y, vx, vy, life, damage, radius }) => ({ id, type, x, y, vx, vy, life, damage, radius }));
}

function playerFromBody(id, body, existing = {}) {
  const destroyedStructures = cleanTombstones(existing.destroyedStructures);
  const destroyedTiles = cleanTombstones(existing.destroyedTiles);
  const incomingWorld = sanitizeWorld(body.world || existing.world || null);
  return {
    id,
    name: String(body.name || existing.name || "Player").slice(0, 18),
    level: Math.max(1, Math.floor(cleanNumber(body.level, existing.level || 1))),
    xp: Math.max(0, cleanNumber(body.xp, existing.xp || 0)),
    health: Math.max(0, Math.min(100, cleanNumber(body.health, existing.health || 100))),
    stamina: Math.max(0, Math.min(100, cleanNumber(body.stamina, existing.stamina || 100))),
    onIsland: Boolean(body.onIsland),
    onRaft: Boolean(body.onRaft),
    selectedItem: String(body.selectedItem || existing.selectedItem || "empty").slice(0, 24),
    world: mergeSubmittedWorld(existing, incomingWorld, destroyedStructures, destroyedTiles),
    destroyedStructures,
    destroyedTiles,
    x: cleanNumber(body.x, existing.x || 4800),
    y: cleanNumber(body.y, existing.y || 4800),
    facing: cleanNumber(body.facing, existing.facing || 0),
    spawnedAt: existing.spawnedAt || cleanNumber(body.spawnedAt, 0),
    seen: Date.now()
  };
}

function activePlayers() {
  const now = Date.now();
  for (const [id, player] of players) {
    if (now - player.seen > 15_000) players.delete(id);
  }
  return [...players.values()].map(({ id, name, level, xp, health, stamina, onIsland, onRaft, selectedItem, x, y, facing, spawnedAt }) => ({ id, name, level, xp, health, stamina, onIsland, onRaft, selectedItem, x, y, facing, spawnedAt }));
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
  const targets = activePlayers().filter((player) => player.health > 0 && !player.onIsland && (!player.spawnedAt || now - player.spawnedAt > 5000));
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
      const desired = steerServerSharkAroundIslands(shark, Math.atan2(target.y - shark.y, target.x - shark.x));
      shark.facing += shortAngle(desired - shark.facing) * Math.min(1, dt * 3.2);
      const speed = best < 48 && now < shark.biteAt ? SERVER_SHARK_SPEED * 0.35 : SERVER_SHARK_SPEED;
      shark.x = clamp(shark.x + Math.cos(shark.facing) * speed * dt, 80, WORLD - 80);
      shark.y = clamp(shark.y + Math.sin(shark.facing) * speed * dt, 80, WORLD - 80);
      if (best < 46 && now >= shark.biteAt) {
        const player = players.get(target.id);
        if (player) player.health = clamp((player.health || 100) - SERVER_SHARK_DAMAGE, 0, 100);
        shark.biteAt = now + SERVER_SHARK_BITE_MS;
      }
    } else {
      shark.targetId = null;
      if (Math.random() < dt * 0.35) shark.facing += (Math.random() - 0.5) * 0.35;
      shark.facing = steerServerSharkAroundIslands(shark, shark.facing);
      shark.x = clamp(shark.x + Math.cos(shark.facing) * 34 * dt, 80, WORLD - 80);
      shark.y = clamp(shark.y + Math.sin(shark.facing) * 34 * dt, 80, WORLD - 80);
    }
    keepServerSharkOffLand(shark);
  }
}

function serverSharkState() {
  return serverSharks.map(({ id, x, y, facing, targetId }) => ({ id, x, y, facing, targetId }));
}

function activeWorlds() {
  const worlds = {};
  for (const player of activePlayers()) {
    const stored = players.get(player.id);
    if (stored?.world) worlds[player.id] = stored.world;
  }
  return worlds;
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
    const player = playerFromBody(id, body);
    const preferred = player.world ? raftCenter(player.world) : { x: player.x, y: player.y };
    shiftWorldToSpawn(player.world, player, chooseSpawnPoint(preferred));
    players.set(id, player);
    tickServerWorlds();
    tickServerSharks();
    return sendJson(res, { id, scoreboard: scoreboard(), players: activePlayers(), serverSharks: serverSharkState(), serverProjectiles: serverProjectileState(), worlds: activeWorlds() });
  }

  if (req.method === "POST" && req.url === "/api/state") {
    const body = await readBody(req);
    const id = String(body.id || crypto.randomUUID());
    const existing = players.get(id);
    const player = playerFromBody(id, body, existing);
    if (!existing && !player.spawnedAt) player.spawnedAt = Date.now();
    players.set(id, player);
    applyRaftCommands(body.raftCommands);
    applyWorldCommands(body.worldCommands);
    applyProjectileCommands(body.projectileCommands);
    applyPlayerHits(id, body.playerHits);
    tickServerWorlds();
    tickServerSharks();
    return sendJson(res, { id, scoreboard: scoreboard(), players: activePlayers(), serverSharks: serverSharkState(), serverProjectiles: serverProjectileState(), worlds: activeWorlds() });
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

server.listen(port, host, () => {
  console.log(`Raaaaft.io server running on ${host}:${port}`);
});
