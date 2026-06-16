(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const mini = document.getElementById("minimap");
  const mctx = mini.getContext("2d");
  const hotbarEl = document.getElementById("hotbar");
  const toastEl = document.getElementById("toast");
  const promptEl = document.getElementById("prompt");
  const recipeBookEl = document.getElementById("recipe-book");
  const recipeGridEl = document.getElementById("recipe-grid");
  const recipeBookOpenEl = document.getElementById("recipe-book-open");
  const recipeBookCloseEl = document.getElementById("recipe-book-close");
  const inventoryEl = document.getElementById("inventory");
  const inventoryTitleEl = document.getElementById("inventory-title");
  const inventoryCloseEl = document.getElementById("inventory-close");
  const inventoryItemsEl = document.getElementById("inventory-items");
  const inventoryHotbarEl = document.getElementById("inventory-hotbar");
  const chestPaneEl = document.getElementById("chest-pane");
  const chestItemsEl = document.getElementById("chest-items");
  const scoreboardListEl = document.getElementById("scoreboard-list");
  const startScreenEl = document.getElementById("start-screen");
  const usernameEl = document.getElementById("username");
  const accessTokenEl = document.getElementById("access-token");
  const startButtonEl = document.getElementById("start-button");
  const gameOverEl = document.getElementById("game-over");
  const fallenNameEl = document.getElementById("fallen-name");

  const TAU = Math.PI * 2;
  const TILE = 72;
  const WORLD = 9600;
  const STRUCTURE_RADIUS = 21;
  const PLACEMENT_FOOTPRINT_SCALE = 0.25;
  const ISLAND_WALK_SCALE = 1;
  const SHIPWRECK_SCALE = 2;
  const SHIPWRECK_INTERACT_RADIUS = 270;
  const SHIPWRECK_CLEAR_RADIUS = 152;
  const SERVER_API_ROOT = location.protocol === "file:" ? "http://127.0.0.1:4173" : "";
  const GRILL_TIME = 60;
  const WATER_TIME = 60;
  const TOMATO_GROW_TIME = 300;
  const DROWN_TIME = 20;
  const SHARK_HP = 120;
  const SHARK_BITE_DAMAGE = 36;
  const SHARK_RAFT_DAMAGE = 30;
  const SHARK_AGGRESSION_CHANCE = 0.1;
  const CROCODILE_DAMAGE = 27;
  const PLAYER_INV_CAP = 20;
  const CHEST_INV_CAP = 40;
  const DEV_TOKEN = "GoldDigger";
  const DEV_RESOURCE_AMOUNT = 9999;
  const FOOD_ITEMS = ["cookedFish", "cookedMeat", "rawFish", "tomato", "coconut"];
  const TIER_ORDER = ["wood", "scrap", "iron", "steel"];
  const TOOL_BASES = ["axe", "spear", "hammer"];
  const TOOL_TIERS = {
    wood: { name: "Wood", durability: 100, power: 1, color: "#d4bd82" },
    scrap: { name: "Scrap", durability: 200, power: 1.25, color: "#a8b5ba" },
    iron: { name: "Iron", durability: 350, power: 1.6, color: "#d6dde0" },
    steel: { name: "Steel", durability: 500, power: 2, color: "#e7f3f5" }
  };
  const TIERED_TOOL_IDS = TIER_ORDER.flatMap((tier) => TOOL_BASES.map((base) => `${tier}${capBase(base)}`));
  const SINGLE_TIER_TOOLS = ["rod", "oar", "musket"];
  const TOOL_ITEMS = [...SINGLE_TIER_TOOLS, ...TIERED_TOOL_IDS, "axe", "spear", "hammer", "metalAxe", "metalSpear", "metalHammer"];
  const HOTBAR_SWAP_SLOTS = Array.from({ length: 10 }, (_, i) => i);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const now = () => performance.now() / 1000;
  function capBase(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const recipes = {
    raft: { wood: 6, rope: 2 },
    grill: { wood: 8, scrap: 4 },
    waterMaker: { wood: 8, scrap: 6, glass: 2 },
    plantPot: { wood: 4, leaves: 4 },
    chest: { wood: 8, cloth: 2 },
    wall: { wood: 5, leaves: 2 },
    torch: { wood: 2, leaves: 2, cloth: 1 },
    cannon: { wood: 10, scrap: 8, rope: 2 },
    bandage: { cloth: 2, leaves: 3 },
    flask: { glass: 1, rope: 1 },
    rod: { wood: 4, rope: 2 },
    oar: { wood: 6, rope: 2 },
    woodAxe: { wood: 5, rope: 1 },
    scrapAxe: { wood: 4, scrap: 8, rope: 2 },
    ironAxe: { wood: 5, scrap: 6, iron: 8, rope: 2 },
    steelAxe: { wood: 6, iron: 6, steel: 8, rope: 3 },
    woodSpear: { wood: 6, rope: 2 },
    scrapSpear: { wood: 5, scrap: 10, rope: 3 },
    ironSpear: { wood: 5, scrap: 7, iron: 10, rope: 3 },
    steelSpear: { wood: 6, iron: 7, steel: 10, rope: 4 },
    woodHammer: { wood: 6, rope: 1 },
    scrapHammer: { wood: 5, scrap: 8, cloth: 2 },
    ironHammer: { wood: 6, scrap: 6, iron: 7, cloth: 2 },
    steelHammer: { wood: 7, iron: 5, steel: 7, cloth: 3 },
    musket: { wood: 18, scrap: 26, rope: 6, cloth: 4, glass: 4 }
  };

  const blockHp = {
    deck: 120,
    grill: 143,
    waterMaker: 165,
    plantPot: 90,
    chest: 180,
    wall: 255,
    torch: 68,
    cannon: 225
  };

  const blockFootprints = {
    grill: { w: 34, h: 28 },
    waterMaker: { w: 34, h: 34 },
    plantPot: { w: 32, h: 24 },
    chest: { w: 36, h: 28 },
    wall: { w: 64, h: 28 },
    torch: { w: 14, h: 32 },
    cannon: { w: 48, h: 34 }
  };

  const hotbar = [
    { id: "rod", name: "Rod", key: "1", qty: 1, swappable: true },
    { id: "oar", name: "Oar", key: "2", qty: 1, swappable: true },
    { id: "woodAxe", name: "Wood Axe", key: "3", qty: 1, swappable: true },
    { id: "woodSpear", name: "Wood Spear", key: "4", qty: 1, swappable: true },
    { id: "woodHammer", name: "Wood Hammer", key: "5", qty: 1, swappable: true },
    { id: "bandage", name: "Bandage", key: "6", qty: 1, swappable: true },
    { id: "empty", name: "-", key: "7", swappable: true },
    { id: "empty", name: "-", key: "8", swappable: true },
    { id: "empty", name: "-", key: "9", swappable: true },
    { id: "empty", name: "-", key: "0", swappable: true }
  ];

  let keys = new Set();
  let mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
  let selected = 0;
  let last = now();
  let toastTimer = 0;
  let buildMode = false;
  let buildChoice = "raft";
  let buildAngle = 0;
  let heldItem = null;
  let selectedFood = null;
  let toolAnim = { kind: null, t: 0, duration: 0 };
  let pendingBuild = {};
  let dayClock = 0;
  let cast = null;
  let rowingTimer = 0;
  let rowingDurabilityTimer = 0;
  let waveTime = 0;
  let gameStarted = false;
  let playerName = "Captain";
  let devMode = false;
  let serverPlayerId = null;
  let serverSyncTimer = 0;
  let scoreboardRows = [];
  let remotePlayers = [];
  let serverAggressiveSharks = [];
  let serverProjectiles = [];
  let remoteWorlds = new Map();
  let activeCannon = null;
  let musketCooldown = 0;
  let openChest = null;
  let dragSlotRef = null;
  let serverSyncInFlight = false;
  let nextServerObjectId = 1;
  let pendingRemoteRaftMoves = new Map();
  let pendingPlayerHits = [];
  let pendingWorldCommands = [];
  let pendingProjectileCommands = [];
  let localChannel = null;
  let usingLocalMultiplayer = false;
  let localPeerId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const localPeers = new Map();

  const state = createWorld();

  function createWorld() {
    const player = {
      x: WORLD / 2,
      y: WORLD / 2,
      vx: 0,
      vy: 0,
      health: 100,
      hunger: 88,
      thirst: 86,
      stamina: 100,
      swimTime: 0,
      xp: 0,
      totalXp: 0,
      level: 1,
      points: 0,
      speed: 0,
      agility: 0,
      strength: 0,
      facing: 0,
      attackCd: 0,
      invuln: 0,
      alive: true
    };

    return {
      player,
      raft: [
        tile(0, 0, "deck"),
        tile(1, 0, "deck"),
        tile(0, 1, "deck"),
        tile(1, 1, "deck")
      ],
      structures: [],
      debris: [],
      islands: [],
      animals: [],
      animalRespawns: [],
      projectiles: [],
      particles: [],
      inventory: startingInventorySlots(),
      resources: {
        wood: 12,
        leaves: 8,
        scrap: 4,
        iron: 0,
        steel: 0,
        cloth: 3,
        rope: 4,
        glass: 1,
        rawFish: 0,
        cookedFish: 0,
        sharkMeat: 0,
        meat: 0,
        cookedMeat: 0,
        coconut: 0,
        tomato: 0,
        bandage: 0
      },
      camera: { x: player.x, y: player.y },
      raftOffset: { x: player.x - TILE * 0.5, y: player.y - TILE * 0.5 },
      sharks: createSharks(player),
      crocTimer: rnd(90, 170),
      unlocks: { axe: "wood", spear: "wood", hammer: "wood" },
      messages: [],
      day: 1
    };
  }

  function emptySlots(count) {
    return Array.from({ length: count }, () => null);
  }

  function slot(id, qty = 1, meta = {}) {
    if (!id || qty <= 0) return null;
    const spec = toolSpec(id);
    if (spec?.durability) {
      const maxDurability = meta.maxDurability || spec.durability;
      return {
        id,
        qty: 1,
        durability: clamp(meta.durability ?? maxDurability, 0, maxDurability),
        maxDurability
      };
    }
    return { id, qty };
  }

  function startingInventorySlots() {
    const slots = emptySlots(PLAYER_INV_CAP);
    slots[0] = slot("raft", 1);
    return slots;
  }

  function resetHotbarItems() {
    setHotbarItem(0, slot("rod", 1));
    setHotbarItem(1, slot("oar", 1));
    setHotbarItem(2, slot("woodAxe", 1));
    setHotbarItem(3, slot("woodSpear", 1));
    setHotbarItem(4, slot("woodHammer", 1));
    setHotbarItem(5, slot("bandage", 1));
    setHotbarItem(6, null);
    setHotbarItem(7, slot("flask", 1));
    setHotbarItem(8, null);
    setHotbarItem(9, null);
  }

  function createSharks(player, islands = null) {
    return Array.from({ length: 21 }, () => {
      const p = randomOceanPoint(520, player, islands);
      const a = rnd(0, TAU);
      const aggressive = Math.random() < SHARK_AGGRESSION_CHANCE;
      return {
        x: p.x,
        y: p.y,
        hp: SHARK_HP,
        bite: 0,
        flee: 0,
        aggressive,
        aggro: aggressive ? 99 : 0,
        wander: a,
        finBob: rnd(0, TAU)
      };
    });
  }

  function randomOceanPoint(minFrom = 0, from = null, islands = null) {
    for (let i = 0; i < 80; i++) {
      const p = { x: rnd(180, WORLD - 180), y: rnd(180, WORLD - 180) };
      if (from && dist(p, from) < minFrom) continue;
      if (islands?.some((island) => Math.hypot(p.x - island.x, p.y - island.y) < island.r + 95)) continue;
      return p;
    }
    return { x: 520, y: 520 };
  }

  function tile(gx, gy, type) {
    const maxHp = blockHp[type] || blockHp.deck;
    return { gx, gy, type, hp: maxHp, maxHp };
  }

  function seedWorld() {
    for (let i = 0; i < 240; i++) spawnDebris();
    const specs = [
      { x: 1200, y: 1100, r: 215, kind: "small" },
      { x: 3000, y: 950, r: 260, kind: "medium", wreck: true },
      { x: 5200, y: 1200, r: 285, kind: "medium" },
      { x: 8200, y: 1050, r: 330, kind: "large", wreck: true },
      { x: 1500, y: 3000, r: 300, kind: "medium" },
      { x: 4000, y: 3300, r: 430, kind: "large", wreck: true },
      { x: 6500, y: 3100, r: 245, kind: "small" },
      { x: 8700, y: 3500, r: 275, kind: "medium" },
      { x: 1150, y: 5500, r: 260, kind: "medium" },
      { x: 3300, y: 5900, r: 225, kind: "small" },
      { x: 6000, y: 5600, r: 380, kind: "large", wreck: true },
      { x: 8500, y: 5900, r: 230, kind: "small" },
      { x: 1700, y: 8250, r: 315, kind: "medium", wreck: true },
      { x: 4700, y: 8100, r: 260, kind: "medium" },
      { x: 7800, y: 8350, r: 390, kind: "large" }
    ];
    specs.forEach(addIsland);
  }

  function setSafeSpawn() {
    const p = { x: WORLD / 2, y: 560 };
    const spawn = state.islands.some((island) => Math.hypot(p.x - island.x, p.y - island.y) < island.r + 260)
      ? randomOceanPoint(0, null, state.islands)
      : p;
    state.player.x = spawn.x;
    state.player.y = spawn.y;
    state.camera.x = spawn.x;
    state.camera.y = spawn.y;
    state.raftOffset.x = spawn.x - TILE * 0.5;
    state.raftOffset.y = spawn.y - TILE * 0.5;
    state.sharks = createSharks(state.player, state.islands);
  }

  function addIsland(spec) {
    const island = { ...spec, trees: [], bushes: [], loot: [], shipwreck: null };
    const treeCount = spec.kind === "large" ? 26 : spec.kind === "medium" ? 17 : 10;
    for (let i = 0; i < treeCount; i++) {
      const p = pointOnIsland(island, 0.78);
      island.trees.push({ ...p, hp: 40, maxHp: 40, coconut: true, respawn: 0 });
    }
    for (let i = 0; i < treeCount + 4; i++) {
      island.bushes.push(pointOnIsland(island, 0.9));
    }
    for (let i = 0; i < 10; i++) {
      island.loot.push({ ...pointOnIsland(island, 0.86), type: Math.random() < 0.55 ? "tomato" : "cloth", respawn: 0 });
    }
    if (spec.wreck) addShipwreck(island);
    state.islands.push(island);

    const crabCount = spec.kind === "small" ? 3 : 5;
    for (let i = 0; i < crabCount; i++) state.animals.push(animal("crab", pointOnIsland(island, 0.85), island));
  }

  function pointOnIsland(island, scale) {
    const a = rnd(0, TAU);
    const r = Math.sqrt(Math.random()) * island.r * scale;
    return { x: island.x + Math.cos(a) * r, y: island.y + Math.sin(a) * r };
  }

  function addShipwreck(island) {
    const angle = rnd(0, TAU);
    const p = {
      x: island.x + Math.cos(angle) * island.r * 0.9,
      y: island.y + Math.sin(angle) * island.r * 0.9
    };
    island.shipwreck = { ...p, angle, loot: [] };
    for (let i = 0; i < 7; i++) {
      island.shipwreck.loot.push({
        x: p.x + Math.cos(angle + Math.PI / 2) * rnd(-45, 45) * SHIPWRECK_SCALE + Math.cos(angle) * rnd(-60, 35) * SHIPWRECK_SCALE,
        y: p.y + Math.sin(angle + Math.PI / 2) * rnd(-45, 45) * SHIPWRECK_SCALE + Math.sin(angle) * rnd(-60, 35) * SHIPWRECK_SCALE,
        type: shipwreckLootType(),
        qty: 1,
        dead: false
      });
    }
  }

  function shipwreckLootType() {
    const roll = Math.random();
    if (roll < 0.46) return "scrap";
    if (roll < 0.66) return "glass";
    if (roll < 0.83) return "rope";
    if (roll < 0.96) return "iron";
    return "steel";
  }

  function animal(type, p, homeIsland = null) {
    const stats = {
      crab: { hp: 28, speed: 28, dmg: 4, xp: 7 },
      pig: { hp: 70, speed: 54, dmg: 12, xp: 20 },
      elephant: { hp: 180, speed: 42, dmg: 25, xp: 55 },
      crocodile: { hp: SHARK_HP, speed: 36, dmg: CROCODILE_DAMAGE, xp: 38 }
    }[type];
    return { type, ...p, homeIsland, hp: stats.hp, maxHp: stats.hp, speed: stats.speed, dmg: stats.dmg, xp: stats.xp, hit: 0, wander: rnd(0, TAU), cd: 0 };
  }

  function spawnDebris() {
    const types = ["wood", "leaves", "scrap", "cloth", "rope", "glass", "barrel"];
    const type = types[Math.floor(Math.random() * types.length)];
    state.debris.push({
      x: rnd(260, WORLD - 260),
      y: rnd(260, WORLD - 260),
      vx: rnd(-8, 8),
      vy: rnd(10, 26),
      type,
      bob: rnd(0, TAU),
      life: 180
    });
  }

  seedWorld();
  setSafeSpawn();
  resetHotbarItems();
  syncManagedCountsFromSlots();
  renderHotbar();
  renderRecipes();
  renderRecipeBook();
    updateHud();
  usernameEl.focus();

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("keydown", (e) => {
    const typingStartField = e.target === usernameEl || e.target === accessTokenEl;
    if (typingStartField && e.code !== "Enter") return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    const idx = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"].indexOf(e.code);
    if (idx >= 0) {
      selected = idx;
      selectHotbarSlot(idx);
      renderHotbar();
    }
    if (e.code === "KeyB") {
      buildMode = !buildMode;
      heldItem = buildMode ? buildChoice : hotbar[selected]?.id || null;
      renderHotbar();
      toast(buildMode ? `Build mode: ${label(buildChoice)} selected. N cycles recipes.` : "Build mode off.");
    }
    if (e.code === "KeyR") rotateBuild();
    if (e.code === "KeyN") cycleBuildChoice();
    if (e.code === "KeyG") cycleFoodChoice();
    if (e.code === "KeyZ") train("speed");
    if (e.code === "KeyX") train("agility");
    if (e.code === "KeyV") train("strength");
    if (e.code === "KeyC") toggleRecipeBook();
    if (e.code === "KeyI") toggleInventory();
    if (e.code === "KeyF") interact();
    if (e.code === "Enter" && !gameStarted && !startScreenEl.hidden) startGame();
    else if (e.code === "Enter" && !state.player.alive) showStartScreen();
  });

  window.addEventListener("keyup", (e) => keys.delete(e.code));
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener("mousedown", () => {
    mouse.down = true;
    useSelected();
  });
  canvas.addEventListener("mouseup", () => {
    mouse.down = false;
  });

  document.querySelectorAll("[data-stat]").forEach((btn) => {
    btn.addEventListener("click", () => train(btn.dataset.stat));
  });

  startButtonEl.addEventListener("click", startGame);
  if (recipeBookOpenEl) recipeBookOpenEl.addEventListener("click", toggleRecipeBook);
  recipeBookCloseEl.addEventListener("click", () => {
    recipeBookEl.hidden = true;
  });
  inventoryCloseEl.addEventListener("click", () => closeInventory());
  usernameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
  });
  if (accessTokenEl) {
    accessTokenEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") startGame();
    });
  }
  window.addEventListener("beforeunload", () => publishLocalPeer("leave"));

  function startGame() {
    const rawName = usernameEl.value.trim();
    devMode = (accessTokenEl?.value || "").trim() === DEV_TOKEN;
    playerName = cleanName(rawName);
    const fresh = createWorld();
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, fresh);
    state.player.name = playerName;
    state.debris = [];
    state.islands = [];
    state.animals = [];
    seedWorld();
    setSafeSpawn();
    dayClock = 0;
    cast = null;
    rowingTimer = 0;
    resetHotbarItems();
    syncManagedCountsFromSlots();
    if (devMode) applyDevToken();
    buildMode = false;
    buildAngle = 0;
    heldItem = null;
    selectedFood = null;
    toolAnim = { kind: null, t: 0, duration: 0 };
    activeCannon = null;
    musketCooldown = 0;
    openChest = null;
    if (inventoryEl) inventoryEl.hidden = true;
    serverSyncInFlight = false;
    localPeers.clear();
    serverAggressiveSharks = [];
    remoteWorlds.clear();
    pendingRemoteRaftMoves.clear();
    selected = 0;
    keys.clear();
    mouse.down = false;
    gameStarted = true;
    startScreenEl.hidden = true;
    gameOverEl.hidden = true;
    renderHotbar();
    renderRecipes();
    renderRecipeBook();
    joinServerMode();
    toast(devMode ? "Dev token accepted. GoldDigger mode active." : `Welcome aboard, ${playerName}.`);
  }

  function showStartScreen() {
    gameStarted = false;
    gameOverEl.hidden = true;
    startScreenEl.hidden = false;
    usernameEl.value = playerName;
    if (accessTokenEl) accessTokenEl.value = "";
    usernameEl.focus();
  }

  function cleanName(value) {
    return value.trim().replace(/\s+/g, " ").slice(0, 18) || "Captain";
  }

  function applyDevToken() {
    state.player.health = 100;
    state.player.hunger = 100;
    state.player.thirst = 100;
    for (const key of ["wood", "leaves", "scrap", "iron", "steel", "cloth", "rope", "glass", "sharkMeat", "meat"]) {
      state.resources[key] = DEV_RESOURCE_AMOUNT;
    }
  }

  function renderHotbar() {
    syncHotbarItems();
    hotbarEl.innerHTML = "";
    hotbar.forEach((item, i) => {
      const slot = document.createElement("div");
      slot.className = `slot ${i === selected ? "active" : ""}`;
      const icon = itemIcon(item.id);
      const count = hotbarCount(item);
      slot.innerHTML = `<kbd>${item.key}</kbd>${count ? `<span class="count">${count}</span>` : ""}<div class="icon">${icon}</div><div class="name">${hotbarName(item)}</div>`;
      slot.addEventListener("click", () => {
        selected = i;
        selectHotbarSlot(i);
        renderHotbar();
      });
      hotbarEl.append(slot);
    });
    renderInventory();
  }

  function itemIcon(id) {
    const icons = {
        rod: "ROD",
        oar: "OAR",
        musket: "MSK",
        bandage: "BND",
        flask: "EFL",
        waterFlask: "WFL",
        cookedFish: "FIS",
        cookedMeat: "MEAT",
        rawFish: "RAW",
        tomato: "TOM",
        coconut: "COC",
        raft: "RAFT",
        grill: "GRL",
        waterMaker: "H2O",
        plantPot: "POT",
        chest: "BOX",
        wall: "WAL",
        torch: "TOR",
        cannon: "CAN",
        empty: ""
      };
    if (icons[id] !== undefined) return icons[id];
    const spec = toolSpec(id);
    if (spec && !spec.single) return `${spec.tier.charAt(0).toUpperCase()}${spec.base.slice(0, 2).toUpperCase()}`;
    return label(id).slice(0, 3).toUpperCase();
  }

  function selectHotbarSlot(idx) {
    const id = hotbar[idx]?.id || "empty";
    if (isBuildRecipe(id)) {
      buildChoice = id;
      buildMode = true;
      heldItem = id;
    } else {
      buildMode = false;
      heldItem = id;
      if (FOOD_ITEMS.includes(id)) selectedFood = id;
    }
  }

  function hotbarName(item) {
    if (item.id === "empty") return "-";
    if (item.id === "bandage") return `Bandage ${item.qty || 0}`;
    if (item.id === "flask" || item.id === "waterFlask") return `${label(item.id)} ${item.qty || 0}`;
    if (FOOD_ITEMS.includes(item.id)) return `${label(item.id)} ${item.qty || 0}`;
    if (isBuildRecipe(item.id)) return `${label(item.id)} ${item.qty || 0}`;
    return item.name;
  }

  function hotbarCount(item) {
    if (item.id === "empty") return "";
    if (isDurableItem(item.id)) return item.durability ?? toolSpec(item.id).durability;
    if (item.id === "bandage") return item.qty || "";
    if (item.id === "flask" || item.id === "waterFlask") return item.qty || "";
    if (FOOD_ITEMS.includes(item.id)) return item.qty || "";
    if (isBuildRecipe(item.id)) return item.qty || "";
    if (isToolItem(item.id) && (item.qty || 0) > 1) return item.qty;
    return "";
  }

  function hotbarResource(id) {
    return ["bandage", "flask", "waterFlask"].includes(id);
  }

  function canonicalToolId(id) {
    return {
      axe: "woodAxe",
      spear: "woodSpear",
      hammer: "woodHammer",
      metalAxe: "scrapAxe",
      metalSpear: "scrapSpear",
      metalHammer: "scrapHammer"
    }[id] || id;
  }

  function toolSpec(id) {
    const canonical = canonicalToolId(id);
    if (SINGLE_TIER_TOOLS.includes(canonical)) {
      const names = { rod: "Wood Rod", oar: "Wood Oar", musket: "Wood Musket" };
      return { id: canonical, base: canonical, tier: "wood", label: names[canonical], durability: TOOL_TIERS.wood.durability, power: 1, color: TOOL_TIERS.wood.color, single: true };
    }
    const match = /^(wood|scrap|iron|steel)(Axe|Spear|Hammer)$/.exec(canonical);
    if (!match) return null;
    const [, tier, baseName] = match;
    const base = baseName.charAt(0).toLowerCase() + baseName.slice(1);
    const tierInfo = TOOL_TIERS[tier];
    return {
      id: canonical,
      base,
      tier,
      label: `${tierInfo.name} ${capBase(base)}`,
      durability: tierInfo.durability,
      power: tierInfo.power,
      color: tierInfo.color,
      single: false
    };
  }

  function isDurableItem(id) {
    return Boolean(toolSpec(id));
  }

  function tierIndex(tier) {
    return Math.max(0, TIER_ORDER.indexOf(tier));
  }

  function isTieredToolRecipe(name) {
    const spec = toolSpec(name);
    return Boolean(spec && !spec.single && canonicalToolId(name) === name);
  }

  function recipeVisible(name) {
    if (!recipes[name]) return false;
    if (!isTieredToolRecipe(name)) return true;
    const spec = toolSpec(name);
    if (spec.tier === "wood") return true;
    const unlockedTier = state.unlocks?.[spec.base] || "wood";
    return tierIndex(spec.tier) <= tierIndex(unlockedTier) + 1;
  }

  function markToolUnlocked(id) {
    const spec = toolSpec(id);
    if (!spec || spec.single) return;
    if (!state.unlocks) state.unlocks = { axe: "wood", spear: "wood", hammer: "wood" };
    const current = state.unlocks[spec.base] || "wood";
    if (tierIndex(spec.tier) > tierIndex(current)) state.unlocks[spec.base] = spec.tier;
  }

  function availableFoods() {
    return FOOD_ITEMS.filter((key) => (state.resources[key] || 0) > 0);
  }

  function managedItemCount(id) {
    if (!id || id === "empty") return 0;
    return countSlots(state.inventory, id) + countHotbarSlots(id);
  }

  function isToolItem(id) {
    return Boolean(toolSpec(id));
  }

  function isInventoryManaged(id) {
    return id === "flask" || id === "waterFlask" || id === "bandage" || FOOD_ITEMS.includes(id) || isToolItem(id) || isBuildRecipe(id);
  }

  function inventorySlots() {
    if (!Array.isArray(state.inventory)) state.inventory = emptySlots(PLAYER_INV_CAP);
    while (state.inventory.length < PLAYER_INV_CAP) state.inventory.push(null);
    if (state.inventory.length > PLAYER_INV_CAP) state.inventory.length = PLAYER_INV_CAP;
    return state.inventory;
  }

  function chestSlots(chest) {
    if (!chest) return emptySlots(CHEST_INV_CAP);
    if (!Array.isArray(chest.storage)) {
      const converted = emptySlots(CHEST_INV_CAP);
      if (chest.storage && typeof chest.storage === "object") {
        let i = 0;
        for (const [id, qty] of Object.entries(chest.storage)) {
          if (i >= CHEST_INV_CAP) break;
          if (qty > 0) converted[i++] = slot(id, qty);
        }
      }
      chest.storage = converted;
    }
    while (chest.storage.length < CHEST_INV_CAP) chest.storage.push(null);
    if (chest.storage.length > CHEST_INV_CAP) chest.storage.length = CHEST_INV_CAP;
    return chest.storage;
  }

  function normalizeSlot(item) {
    if (!item || !item.id || item.id === "empty" || item.qty <= 0) return null;
    const spec = toolSpec(item.id);
    if (spec?.durability) {
      const maxDurability = clamp(Number(item.maxDurability) || spec.durability, 1, spec.durability);
      return {
        id: spec.id,
        qty: 1,
        durability: clamp(Number(item.durability) || maxDurability, 0, maxDurability),
        maxDurability
      };
    }
    return { id: item.id, qty: item.qty };
  }

  function countSlots(slots, id) {
    return (slots || []).reduce((sum, item) => sum + (item?.id === id ? item.qty || 0 : 0), 0);
  }

  function countHotbarSlots(id) {
    return HOTBAR_SWAP_SLOTS.reduce((sum, idx) => sum + (hotbar[idx]?.id === id ? hotbar[idx].qty || 0 : 0), 0);
  }

  function usedInventorySlots(slots = inventorySlots()) {
    return slots.filter(Boolean).length;
  }

  function playerHasInventorySpaceFor(id) {
    if (isDurableItem(id)) return inventorySlots().some((item) => !item);
    return inventorySlots().some((item) => !item || item.id === id);
  }

  function playerHasItemSpaceFor(id) {
    if (isDurableItem(id)) return playerHasInventorySpaceFor(id) || HOTBAR_SWAP_SLOTS.some((idx) => hotbar[idx].id === "empty");
    return playerHasInventorySpaceFor(id) || HOTBAR_SWAP_SLOTS.some((idx) => hotbar[idx].id === "empty" || hotbar[idx].id === id);
  }

  function syncHotbarItems() {
    for (const idx of HOTBAR_SWAP_SLOTS) {
      const item = hotbar[idx];
      if (item.id !== "empty" && (!isInventoryManaged(item.id) || (item.qty || 0) <= 0)) setHotbarItem(idx, null);
    }
    const current = hotbar[selected]?.id;
    if (buildMode) heldItem = buildChoice;
    else if (current === "empty") heldItem = null;
  }

  function hotbarSwapTarget() {
    if (HOTBAR_SWAP_SLOTS.includes(selected)) return selected;
    return HOTBAR_SWAP_SLOTS.find((idx) => hotbar[idx].id === "empty") ?? HOTBAR_SWAP_SLOTS[0];
  }

  function putItemInHotbar(id, selectIt = false) {
    if (!isInventoryManaged(id)) return false;
    const existing = HOTBAR_SWAP_SLOTS.find((idx) => hotbar[idx].id === id);
    const idx = existing ?? hotbarSwapTarget();
    if (existing === undefined) {
      const source = findSlotRefWithItem("inventory", id);
      if (!source) return false;
      moveSlot(source, { area: "hotbar", index: idx }, false);
    }
    if (selectIt) {
      selected = idx;
      selectHotbarSlot(idx);
    }
    renderHotbar();
    return true;
  }

  function autoSlotItem(id) {
    if (!isInventoryManaged(id)) return;
    const idx = HOTBAR_SWAP_SLOTS.find((slotIndex) => hotbar[slotIndex].id === id);
    if (idx !== undefined) syncManagedCountsFromSlots();
  }

  function toggleInventory(chest = null) {
    if (!gameStarted) return;
    if (inventoryEl.hidden) openInventory(chest);
    else closeInventory();
  }

  function openInventory(chest = null) {
    openChest = chest;
    inventoryEl.hidden = false;
    renderInventory();
  }

  function closeInventory() {
    inventoryEl.hidden = true;
    openChest = null;
  }

  function renderInventory() {
    if (!inventoryEl || inventoryEl.hidden) return;
    inventoryTitleEl.textContent = openChest ? "Inventory and Chest" : "Inventory";
    inventoryItemsEl.innerHTML = "";
    inventoryItemsEl.dataset.area = "inventory";
    for (let i = 0; i < PLAYER_INV_CAP; i++) inventoryItemsEl.append(slotCard({ area: "inventory", index: i }, inventorySlots()[i]));

    inventoryHotbarEl.innerHTML = "";
    inventoryHotbarEl.dataset.area = "hotbar";
    for (let i = 0; i < hotbar.length; i++) inventoryHotbarEl.append(slotCard({ area: "hotbar", index: i }, getSlot({ area: "hotbar", index: i }), hotbar[i].key));

    chestPaneEl.hidden = !openChest;
    chestItemsEl.innerHTML = "";
    chestItemsEl.dataset.area = "chest";
    if (openChest) {
      const slots = chestSlots(openChest);
      for (let i = 0; i < CHEST_INV_CAP; i++) chestItemsEl.append(slotCard({ area: "chest", index: i }, slots[i]));
    }
  }

  function slotCard(ref, item, hotkey = "") {
    const card = document.createElement("button");
    const canUse = ref.area !== "hotbar" || HOTBAR_SWAP_SLOTS.includes(ref.index);
    card.type = "button";
    card.className = `item-card slot-cell${item ? " filled" : ""}${canUse ? " actionable" : " locked"}`;
    card.dataset.area = ref.area;
    card.dataset.index = String(ref.index);
    card.disabled = !canUse;
    card.draggable = Boolean(item && canUse);
    const name = item ? label(item.id) : "Empty";
    const qty = item?.durability !== undefined ? `${item.durability}/${item.maxDurability}` : item?.qty ? `x${item.qty}` : "";
    card.innerHTML = `<kbd>${hotkey || ref.index + 1}</kbd><b>${name}</b><span>${qty}${canUse ? "" : "Locked"}</span>`;
    card.addEventListener("dragstart", (event) => {
      if (!item || !canUse) return;
      dragSlotRef = ref;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `${ref.area}:${ref.index}`);
    });
    card.addEventListener("dragover", (event) => {
      if (canUse) event.preventDefault();
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const source = dragSlotRef || parseSlotRef(event.dataTransfer.getData("text/plain"));
      moveSlot(source, ref);
      dragSlotRef = null;
    });
    return card;
  }

  function parseSlotRef(text) {
    const [area, index] = String(text || "").split(":");
    return area ? { area, index: Number(index) } : null;
  }

  function getSlot(ref) {
    if (!ref) return null;
    if (ref.area === "inventory") return normalizeSlot(inventorySlots()[ref.index]);
    if (ref.area === "chest") return openChest ? normalizeSlot(chestSlots(openChest)[ref.index]) : null;
    if (ref.area === "hotbar") {
      const item = hotbar[ref.index];
      return HOTBAR_SWAP_SLOTS.includes(ref.index) ? normalizeSlot(item) : null;
    }
    return null;
  }

  function setSlot(ref, item) {
    const value = normalizeSlot(item);
    if (ref.area === "inventory") inventorySlots()[ref.index] = value;
    if (ref.area === "chest" && openChest) chestSlots(openChest)[ref.index] = value;
    if (ref.area === "hotbar") setHotbarItem(ref.index, value);
  }

  function setHotbarItem(index, item) {
    if (!HOTBAR_SWAP_SLOTS.includes(index)) return false;
    const value = normalizeSlot(item);
    hotbar[index].id = value ? value.id : "empty";
    hotbar[index].name = value ? label(value.id) : "-";
    delete hotbar[index].durability;
    delete hotbar[index].maxDurability;
    if (value) {
      hotbar[index].qty = value.qty;
      if (value.durability !== undefined) {
        hotbar[index].durability = value.durability;
        hotbar[index].maxDurability = value.maxDurability;
      }
    } else {
      delete hotbar[index].qty;
    }
    return true;
  }

  function moveSlot(source, target, shouldRender = true) {
    if (!source || !target) return false;
    if (source.area === target.area && source.index === target.index) return false;
    if (target.area === "hotbar" && !HOTBAR_SWAP_SLOTS.includes(target.index)) {
      toast("That hotbar slot is locked.");
      return false;
    }
    if (source.area === "hotbar" && !HOTBAR_SWAP_SLOTS.includes(source.index)) return false;
    const sourceItem = getSlot(source);
    const targetItem = getSlot(target);
    if (!sourceItem) return false;
    setSlot(target, sourceItem);
    setSlot(source, targetItem);
    syncManagedCountsFromSlots();
    if ((source.area === "chest" || target.area === "chest") && openChest?.remoteOwnerId) syncRemoteStructure(openChest);
    if (shouldRender) {
      renderHotbar();
      renderInventory();
    }
    return true;
  }

  function findSlotRefWithItem(area, id) {
    const slots = area === "inventory" ? inventorySlots() : area === "chest" ? chestSlots(openChest) : hotbar;
    if (area === "hotbar") {
      const idx = HOTBAR_SWAP_SLOTS.find((slotIndex) => hotbar[slotIndex].id === id);
      return idx === undefined ? null : { area, index: idx };
    }
    const idx = slots.findIndex((item) => item?.id === id);
    return idx >= 0 ? { area, index: idx } : null;
  }

  function addPlayerItem(id, qty, preferred = "inventory") {
    if (!isInventoryManaged(id) || qty <= 0) return false;
    if (isDurableItem(id)) {
      let remaining = Math.floor(qty);
      while (remaining > 0) {
        if (preferred === "hotbar") {
          const emptyHotbar = HOTBAR_SWAP_SLOTS.find((idx) => hotbar[idx].id === "empty");
          if (emptyHotbar !== undefined) {
            setHotbarItem(emptyHotbar, slot(id, 1));
            remaining--;
            continue;
          }
        }
        const inv = inventorySlots();
        const empty = inv.findIndex((item) => !item);
        if (empty < 0) return remaining < qty;
        inv[empty] = slot(id, 1);
        remaining--;
      }
      syncManagedCountsFromSlots();
      return true;
    }
    const slots = preferred === "hotbar" ? HOTBAR_SWAP_SLOTS.map((idx) => hotbar[idx]) : inventorySlots();
    const stack = slots.find((item) => item?.id === id);
    if (stack) {
      stack.qty += qty;
      syncManagedCountsFromSlots();
      return true;
    }
    if (preferred === "hotbar") {
      const emptyHotbar = HOTBAR_SWAP_SLOTS.find((idx) => hotbar[idx].id === "empty");
      if (emptyHotbar !== undefined) {
        setHotbarItem(emptyHotbar, slot(id, qty));
        syncManagedCountsFromSlots();
        return true;
      }
    }
    const inv = inventorySlots();
    const empty = inv.findIndex((item) => !item);
    if (empty < 0) return false;
    inv[empty] = slot(id, qty);
    syncManagedCountsFromSlots();
    return true;
  }

  function removePlayerItem(id, qty, preferredRef = null) {
    if (!isInventoryManaged(id) || qty <= 0) return false;
    const refs = [];
    if (preferredRef && getSlot(preferredRef)?.id === id) refs.push(preferredRef);
    for (const idx of HOTBAR_SWAP_SLOTS) refs.push({ area: "hotbar", index: idx });
    for (let i = 0; i < PLAYER_INV_CAP; i++) refs.push({ area: "inventory", index: i });
    let remaining = qty;
    for (const ref of refs) {
      const item = getSlot(ref);
      if (!item || item.id !== id) continue;
      const take = Math.min(remaining, item.qty);
      item.qty -= take;
      remaining -= take;
      setSlot(ref, item.qty > 0 ? item : null);
      if (remaining <= 0) break;
    }
    syncManagedCountsFromSlots();
    renderHotbar();
    renderInventory();
    return remaining <= 0;
  }

  function syncManagedCountsFromSlots() {
    for (const id of FOOD_ITEMS) state.resources[id] = managedItemCount(id);
    state.resources.bandage = managedItemCount("bandage");
    pendingBuild = {};
    for (const id of Object.keys(recipes)) {
      if (isBuildRecipe(id)) {
        const qty = managedItemCount(id);
        if (qty > 0) pendingBuild[id] = qty;
      }
    }
  }

  function renderRecipes() {
    renderRecipeBook();
    renderInventory();
  }

  function recipeText(name) {
    const recipe = recipes[name];
    if (!recipe) return "no recipe";
    return Object.entries(recipe).map(([res, qty]) => `${qty} ${label(res).toLowerCase()}`).join(", ");
  }

  function renderRecipeBook() {
    if (!recipeGridEl) return;
    recipeGridEl.innerHTML = "";
    for (const name of Object.keys(recipes).filter(recipeVisible)) {
      const card = document.createElement("button");
      card.className = "recipe-card";
      card.type = "button";
      card.innerHTML = `<b>${label(name)}</b><span>${recipeText(name)}${pendingBuild[name] ? ` · ready ${pendingBuild[name]}` : ""}</span>`;
      card.addEventListener("click", () => chooseRecipe(name));
      recipeGridEl.append(card);
    }
  }

  function craftRecipe(name) {
    if (!gameStarted) return toast("Start survival first.");
    if (!recipes[name]) return;
    if (!buildMode) return toast("Enter build mode with B to craft.");
    if (isBuildRecipe(name) && (pendingBuild[name] || 0) > 0) {
      selectBuildItem(name);
      recipeBookEl.hidden = true;
      return toast(`${label(name)} ready to place.`);
    }
    if (!canAfford(name)) return toast(`Need ${recipeText(name)}.`);
    if (!craft(name, name !== "bandage")) return;
    recipeBookEl.hidden = true;
    if (isBuildRecipe(name)) {
      selectBuildItem(name);
      return toast(`${label(name)} crafted. Click to place it.`);
    }
    toast(`${label(name)} crafted into inventory.`);
  }

  function selectBuildItem(name) {
    buildChoice = name;
    buildMode = true;
    heldItem = name;
    renderHotbar();
    renderRecipes();
  }

  function chooseRecipe(name) {
    recipeBookEl.hidden = true;
    selectBuildItem(name);
    const ready = isBuildRecipe(name) ? pendingBuild[name] || 0 : managedItemCount(name);
    if (ready > 0 && isBuildRecipe(name)) return toast(`Holding ${label(name)} to place.`);
    return toast(`Selected ${label(name)}. Click in build mode to craft${isBuildRecipe(name) ? " and place" : ""}.`);
  }

  function isToolRecipe(name) {
    return Boolean(recipes[name] && toolSpec(name));
  }

  function isHotbarCraftRecipe(name) {
    return isToolRecipe(name) || name === "flask";
  }

  function isCraftOnlyRecipe(name) {
    return name === "bandage" || isHotbarCraftRecipe(name);
  }

  function isBuildRecipe(name) {
    return Boolean(recipes[name]) && !isCraftOnlyRecipe(name);
  }

  function craftCycleChoices() {
    return Object.keys(recipes).filter((name) => recipeVisible(name) && (isBuildRecipe(name) || isCraftOnlyRecipe(name)));
  }

  function canAfford(name) {
    const recipe = recipes[name];
    if (devMode && recipe) return true;
    return Boolean(recipe) && Object.entries(recipe).every(([res, qty]) => (state.resources[res] || 0) >= qty);
  }

  function toggleRecipeBook() {
    if (!buildMode) {
      toast("Enter build mode with B to use the recipe book.");
      return;
    }
    recipeBookEl.hidden = !recipeBookEl.hidden;
    renderRecipeBook();
  }

  function selectHeldTool(id) {
    const idx = hotbar.findIndex((item) => item.id === id);
    if (idx >= 0) {
      selected = idx;
      buildMode = false;
      heldItem = id;
      renderHotbar();
    }
  }

  function playerNetState(id = serverPlayerId || localPeerId) {
    return {
      id,
      name: playerName,
      x: state.player.x,
      y: state.player.y,
      facing: state.player.facing,
      level: state.player.level,
      xp: state.player.totalXp || 0,
      health: state.player.health,
      stamina: state.player.stamina,
      onIsland: Boolean(isOnIsland(state.player)),
      onRaft: Boolean(isOnRaft(state.player)),
      selectedItem: buildMode ? buildChoice : hotbar[selected]?.id || "empty",
      world: serializeServerWorld(),
      raftCommands: consumeRemoteRaftMoves(),
      playerHits: consumePlayerHits(),
      worldCommands: consumeWorldCommands(),
      projectileCommands: consumeProjectileCommands()
    };
  }

  function serializeServerWorld() {
    return {
      raftOffset: { x: state.raftOffset.x, y: state.raftOffset.y },
      raft: state.raft.map((rt) => ({ gx: rt.gx, gy: rt.gy, hp: rt.hp, maxHp: rt.maxHp })),
      structures: state.structures.map((st) => ({
        id: serverObjectId("st", st),
        type: st.type,
        x: st.x,
        y: st.y,
        angle: st.angle || 0,
        base: st.base || "raft",
        hp: st.hp,
        maxHp: st.maxHp,
        hitbox: footprint(st.type),
        storage: st.type === "chest" ? chestSlots(st) : null
      })),
      animals: state.animals.map((a) => ({
        id: serverObjectId("animal", a),
        type: a.type,
        x: a.x,
        y: a.y,
        hp: a.hp,
        maxHp: a.maxHp,
        submerged: Boolean(a.submerged)
      })),
      sharks: state.sharks.map((s) => ({
        id: serverObjectId("shark", s),
        x: s.x,
        y: s.y,
        hp: s.hp,
        aggressive: Boolean(s.aggressive),
        serverControlled: Boolean(s.serverControlled)
      })),
      debris: state.debris.map((d) => ({
        id: serverObjectId("debris", d),
        type: d.type,
        x: d.x,
        y: d.y,
        vx: d.vx,
        vy: d.vy,
        stopped: Boolean(d.stopped),
        life: d.life
      })),
      trees: state.islands.flatMap((island, islandIndex) =>
        island.trees.map((tree) => ({
          id: serverObjectId(`tree-${islandIndex}`, tree),
          islandIndex,
          x: tree.x,
          y: tree.y,
          hp: tree.hp,
          maxHp: tree.maxHp,
          dead: Boolean(tree.dead),
          respawn: tree.respawn || 0
        }))
      ),
      inventory: inventorySlots(),
      hotbar: hotbar.map((item) => normalizeSlot(item)),
      resources: { ...state.resources },
      unlocks: { ...(state.unlocks || {}) }
    };
  }

  function serverObjectId(prefix, obj) {
    if (!obj.serverObjectId) obj.serverObjectId = `${prefix}-${nextServerObjectId++}`;
    return obj.serverObjectId;
  }

  function queueRemoteRaftMove(ownerId, dx, dy) {
    const existing = pendingRemoteRaftMoves.get(ownerId) || { ownerId, dx: 0, dy: 0 };
    existing.dx += dx;
    existing.dy += dy;
    pendingRemoteRaftMoves.set(ownerId, existing);
  }

  function consumeRemoteRaftMoves() {
    const moves = [...pendingRemoteRaftMoves.values()]
      .filter((move) => Math.hypot(move.dx, move.dy) > 0.01)
      .map((move) => ({ ownerId: move.ownerId, dx: move.dx, dy: move.dy }));
    pendingRemoteRaftMoves.clear();
    return moves;
  }

  function queuePlayerHit(targetId, damage) {
    if (!targetId || !Number.isFinite(damage)) return;
    pendingPlayerHits.push({ targetId: String(targetId), damage: clamp(Math.round(damage), 1, 120) });
    if (pendingPlayerHits.length > 24) pendingPlayerHits = pendingPlayerHits.slice(-24);
  }

  function consumePlayerHits() {
    const hits = pendingPlayerHits.slice(0, 24);
    pendingPlayerHits = [];
    return hits;
  }

  function queueWorldCommand(ownerId, command) {
    if (!ownerId || !command) return;
    pendingWorldCommands.push({ ownerId, ...command });
    if (pendingWorldCommands.length > 80) pendingWorldCommands = pendingWorldCommands.slice(-80);
  }

  function consumeWorldCommands() {
    const commands = pendingWorldCommands.slice(0, 80);
    pendingWorldCommands = [];
    return commands;
  }

  function queueProjectileCommand(projectile) {
    if (!projectile) return;
    pendingProjectileCommands.push({
      type: projectile.type,
      x: projectile.x,
      y: projectile.y,
      vx: projectile.vx,
      vy: projectile.vy,
      life: projectile.life,
      damage: projectile.damage,
      radius: projectile.radius
    });
    if (pendingProjectileCommands.length > 48) pendingProjectileCommands = pendingProjectileCommands.slice(-48);
  }

  function consumeProjectileCommands() {
    const commands = pendingProjectileCommands.slice(0, 48);
    pendingProjectileCommands = [];
    return commands;
  }

  async function serverPost(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    try {
      const res = await fetch(`${SERVER_API_ROOT}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function joinServerMode() {
    const local = playerNetState(localPeerId);
    scoreboardRows = [local];
    remotePlayers = [];
    serverAggressiveSharks = [];
    remoteWorlds.clear();
    serverPlayerId = null;
    usingLocalMultiplayer = false;
    renderScoreboard();
    try {
      const data = await serverPost("/api/join", local);
      serverPlayerId = data.id;
      usingLocalMultiplayer = false;
      localPeers.clear();
      applyServerPlayerState((data.players || []).find((p) => p.id === serverPlayerId));
      applyOwnServerWorld(data.worlds?.[serverPlayerId]);
      remotePlayers = (data.players || []).filter((p) => p.id !== serverPlayerId);
      applyRemoteWorlds(data.worlds || {}, serverPlayerId);
      serverAggressiveSharks = data.serverSharks || [];
      applyServerSharks(serverAggressiveSharks);
      serverProjectiles = data.serverProjectiles || [];
      scoreboardRows = data.scoreboard || [playerNetState(serverPlayerId)];
      renderScoreboard();
    } catch {
      serverPlayerId = null;
      joinLocalMultiplayer();
    }
  }

  async function updateServerMode(dt) {
    serverSyncTimer += dt;
    if (serverSyncTimer < 0.28) return;
    serverSyncTimer = 0;
    if (!serverPlayerId) {
      if (!usingLocalMultiplayer) joinLocalMultiplayer();
      else updateLocalMultiplayer();
      return;
    }
    if (serverSyncInFlight) return;
    serverSyncInFlight = true;
    try {
      const data = await serverPost("/api/state", playerNetState(serverPlayerId));
      if (data.id) serverPlayerId = data.id;
      usingLocalMultiplayer = false;
      applyServerPlayerState((data.players || []).find((p) => p.id === serverPlayerId));
      scoreboardRows = data.scoreboard || [playerNetState(serverPlayerId)];
      remotePlayers = (data.players || []).filter((p) => p.id !== serverPlayerId);
      applyOwnServerWorld(data.worlds?.[serverPlayerId]);
      applyRemoteWorlds(data.worlds || {}, serverPlayerId);
      serverAggressiveSharks = data.serverSharks || [];
      applyServerSharks(serverAggressiveSharks);
      serverProjectiles = data.serverProjectiles || [];
      renderScoreboard();
    } catch {
      serverPlayerId = null;
      joinLocalMultiplayer();
    } finally {
      serverSyncInFlight = false;
    }
  }

  function joinLocalMultiplayer() {
    usingLocalMultiplayer = true;
    ensureLocalChannel();
    publishLocalPeer("state");
    updateLocalMultiplayer(true);
  }

  function ensureLocalChannel() {
    if (localChannel || !("BroadcastChannel" in window)) return;
    try {
      localChannel = new BroadcastChannel("raaft-io-local-players");
      localChannel.onmessage = (event) => receiveLocalPeer(event.data);
    } catch {
      localChannel = null;
    }
  }

  function publishLocalPeer(type = "state") {
    if (!gameStarted && type !== "leave") return;
    const payload = { type, ...playerNetState(localPeerId), seen: Date.now() };
    if (localChannel) localChannel.postMessage(payload);
    try {
      if (type === "leave") localStorage.removeItem(`raaft-io-peer-${localPeerId}`);
      else localStorage.setItem(`raaft-io-peer-${localPeerId}`, JSON.stringify(payload));
    } catch {
      // Local file pages can block storage; BroadcastChannel still handles live tabs.
    }
  }

  function receiveLocalPeer(data) {
    if (!data || data.id === localPeerId) return;
    applyIncomingPlayerHits(data.playerHits, data.name || "Player");
    if (data.type === "leave" || data.health <= 0) {
      localPeers.delete(data.id);
      updateLocalPeerRows();
      return;
    }
    localPeers.set(data.id, { ...data, seen: data.seen || Date.now() });
    updateLocalPeerRows();
  }

  function applyIncomingPlayerHits(hits, attackerName = "Player") {
    if (!Array.isArray(hits) || !state.player.alive) return;
    const selfIds = new Set([localPeerId, serverPlayerId].filter(Boolean));
    for (const hit of hits.slice(0, 12)) {
      if (!selfIds.has(String(hit?.targetId || ""))) continue;
      hurt(clamp(Number(hit.damage) || 0, 0, 120), `${attackerName} hit you.`);
    }
  }

  function readLocalStoragePeers() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("raaft-io-peer-")) continue;
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        if (!data.seen || data.seen < Date.now() - 5000) {
          localStorage.removeItem(key);
          continue;
        }
        receiveLocalPeer(data);
      }
    } catch {
      // Some browsers restrict localStorage for file URLs.
    }
  }

  function updateLocalMultiplayer(force = false) {
    if (!usingLocalMultiplayer && !force) return;
    ensureLocalChannel();
    publishLocalPeer("state");
    readLocalStoragePeers();
    const staleAt = Date.now() - 5000;
    for (const [id, peer] of localPeers) {
      if ((peer.seen || 0) < staleAt) localPeers.delete(id);
    }
    updateLocalPeerRows();
  }

  function updateLocalPeerRows() {
    const local = playerNetState(localPeerId);
    const peers = [...localPeers.values()].filter((p) => p.health > 0);
    scoreboardRows = [local, ...peers];
    remotePlayers = peers;
    applyRemoteWorlds(Object.fromEntries(peers.filter((peer) => peer.world).map((peer) => [peer.id, peer.world])), localPeerId);
    renderScoreboard();
  }

  function applyRemoteWorlds(worlds, selfId) {
    const activeRemote = activeCannon?.remoteOwnerId && activeCannon?.id ? { ownerId: activeCannon.remoteOwnerId, id: activeCannon.id } : null;
    const openRemoteChest = openChest?.remoteOwnerId && openChest?.id ? { ownerId: openChest.remoteOwnerId, id: openChest.id } : null;
    remoteWorlds.clear();
    for (const [ownerId, world] of Object.entries(worlds || {})) {
      if (!world || ownerId === selfId) continue;
      if (!Array.isArray(world.raft) || !world.raftOffset) continue;
      remoteWorlds.set(ownerId, normalizeRemoteWorld(world, ownerId));
    }
    if (activeRemote) {
      const world = remoteWorlds.get(activeRemote.ownerId);
      activeCannon = (world?.structures || []).find((st) => st.id === activeRemote.id) || null;
    }
    if (openRemoteChest) {
      const world = remoteWorlds.get(openRemoteChest.ownerId);
      openChest = (world?.structures || []).find((st) => st.id === openRemoteChest.id) || null;
    }
  }

  function normalizeRemoteWorld(world, ownerId = null) {
    return {
      raftOffset: {
        x: cleanCoord(world.raftOffset?.x, 0),
        y: cleanCoord(world.raftOffset?.y, 0)
      },
      raft: (world.raft || []).map((rt) => ({
        gx: Math.floor(cleanCoord(rt.gx, 0)),
        gy: Math.floor(cleanCoord(rt.gy, 0)),
        hp: clamp(cleanCoord(rt.hp, blockHp.deck), 0, 500),
        maxHp: clamp(cleanCoord(rt.maxHp, blockHp.deck), 1, 500)
      })),
      structures: (world.structures || []).map((st) => ({
        ...st,
        remoteOwnerId: ownerId,
        x: cleanCoord(st.x, 0),
        y: cleanCoord(st.y, 0),
        angle: cleanCoord(st.angle, 0),
        hp: clamp(cleanCoord(st.hp, blockHp[st.type] || 80), 0, 600),
        maxHp: clamp(cleanCoord(st.maxHp, blockHp[st.type] || 80), 1, 600),
        timer: clamp(cleanCoord(st.timer, 0), 0, 1200),
        maxTimer: clamp(cleanCoord(st.maxTimer, 0), 0, 1200),
        cooldown: clamp(cleanCoord(st.cooldown, 0), 0, 20),
        ready: Boolean(st.ready),
        hasGlass: Boolean(st.hasGlass),
        planted: Boolean(st.planted),
        cooking: st.cooking || null,
        storage: st.type === "chest" ? (Array.isArray(st.storage) ? st.storage.map(normalizeSlot) : emptySlots(CHEST_INV_CAP)) : null
      }))
    };
  }

  function applyOwnServerWorld(world) {
    if (!world || !Array.isArray(world.raft) || !world.raftOffset) return;
    const normalized = normalizeRemoteWorld(world, null);
    const activeId = activeCannon?.serverObjectId || activeCannon?.id || null;
    const openChestId = openChest?.serverObjectId || openChest?.id || null;
    state.raftOffset.x = normalized.raftOffset.x;
    state.raftOffset.y = normalized.raftOffset.y;
    state.raft = normalized.raft.map((rt) => ({ ...rt, type: "deck" }));
    state.structures = normalized.structures.map((st) => {
      const local = { ...st, base: st.base || "raft" };
      local.serverObjectId = st.id;
      delete local.remoteOwnerId;
      return local;
    });
    if (activeId) activeCannon = state.structures.find((st) => (st.serverObjectId || st.id) === activeId) || null;
    if (openChestId) openChest = state.structures.find((st) => (st.serverObjectId || st.id) === openChestId) || null;
  }

  function applyServerSharks(sharks) {
    const claimed = new Set();
    for (const serverShark of sharks || []) {
      let shark = state.sharks.find((item) => item.serverId === serverShark.id);
      if (!shark) {
        shark = state.sharks.find((item) => !item.serverId && item.aggressive && !claimed.has(item));
      }
      if (!shark) shark = state.sharks.find((item) => !item.serverId && !claimed.has(item));
      if (!shark) continue;
      claimed.add(shark);
      shark.serverId = serverShark.id;
      shark.serverControlled = true;
      shark.serverTargetId = serverShark.targetId || null;
      shark.serverX = cleanCoord(serverShark.x, shark.x);
      shark.serverY = cleanCoord(serverShark.y, shark.y);
      shark.serverFacing = cleanCoord(serverShark.facing, shark.wander);
      shark.aggressive = true;
      shark.aggro = 99;
      shark.flee = 0;
      shark.hp = SHARK_HP;
    }
    for (const shark of state.sharks) {
      if (shark.serverControlled && !claimed.has(shark)) {
        shark.serverControlled = false;
        shark.serverId = null;
        shark.serverTargetId = null;
      }
      if ((sharks || []).length && !claimed.has(shark)) shark.aggressive = false;
    }
  }

  function applyServerPlayerState(serverPlayer) {
    if (!serverPlayer || devMode || !state.player.alive) return;
    const serverHealth = clamp(cleanCoord(serverPlayer.health, state.player.health), 0, 100);
    if (serverHealth >= state.player.health) return;
    state.player.health = serverHealth;
    toast("You took server-side damage.");
    if (state.player.health <= 0) {
      state.player.health = 0;
      state.player.alive = false;
      gameStarted = false;
      publishLocalPeer("leave");
      fallenNameEl.textContent = state.player.name || playerName;
      document.getElementById("survived").textContent = state.day;
      gameOverEl.hidden = false;
    }
  }

  function cleanCoord(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function renderScoreboard() {
    if (!scoreboardListEl) return;
    const rows = [...scoreboardRows]
      .sort((a, b) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 8);
    scoreboardListEl.innerHTML = "";
    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "score-row";
      const name = document.createElement("span");
      name.textContent = row.name || "Player";
      const level = document.createElement("span");
      level.textContent = `Lv ${row.level || 1}`;
      item.append(name, level);
      scoreboardListEl.append(item);
    }
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    toastTimer = 2.4;
  }

  function tick() {
    const t = now();
    const dt = Math.min(0.033, t - last);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function update(dt) {
    waveTime += dt;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.remove("show");
    }
    if (!gameStarted) {
      state.camera.x += (state.player.x - state.camera.x) * 0.08;
      state.camera.y += (state.player.y - state.camera.y) * 0.08;
      updateMouseWorld();
      updateHud();
      return;
    }
    if (!state.player.alive) return;

    const p = state.player;
    if (activeCannon && (activeCannon.hp <= 0 || dist(activeCannon, p) > 92)) activeCannon = null;
    if (openChest && (openChest.hp <= 0 || dist(openChest, p) > 92)) closeInventory();
    p.attackCd = Math.max(0, p.attackCd - dt);
    if (toolAnim.t > 0) {
      toolAnim.t = Math.max(0, toolAnim.t - dt);
      if (toolAnim.t <= 0) toolAnim.kind = null;
    }
    p.invuln = Math.max(0, p.invuln - dt);
    musketCooldown = Math.max(0, musketCooldown - dt);
    dayClock += dt;
    state.day = Math.floor(dayClock / 90) + 1;

    if (devMode) {
      applyDevToken();
    } else {
      const drain = isOnRaft(p) ? 1 : 1.35;
      p.hunger = clamp(p.hunger - dt * 0.34 * drain, 0, 100);
      p.thirst = clamp(p.thirst - dt * 0.46 * drain, 0, 100);
      if (p.hunger <= 0 || p.thirst <= 0) hurt((p.hunger <= 0 && p.thirst <= 0 ? 7 : 4) * dt, "Starvation and dehydration are winning.");
    }

    const inWater = !isOnRaft(p) && !isOnIsland(p);
    if (inWater) {
      p.swimTime = clamp((p.swimTime || 0) + dt, 0, DROWN_TIME + 8);
      if (p.swimTime >= DROWN_TIME) hurt(12 * dt, "You are drowning.");
    } else {
      p.swimTime = Math.max(0, (p.swimTime || 0) - dt * 6);
    }
    const exhausted = p.stamina <= 0;
    const sprinting = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && p.stamina > 4;
    const baseSpeed = inWater ? (exhausted ? 22 : 48 + p.speed * 3 + p.agility * 2) : (exhausted ? 48 : 118) + (exhausted ? 0 : p.speed * 9 + p.agility * 5);
    const speed = sprinting ? baseSpeed * (inWater ? 1.12 : 1.55) : baseSpeed;
    let mx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    let my = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
    if (activeCannon) {
      const turn = ((keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0)) * 1.8 * dt;
      activeCannon.aimOffset = clamp((activeCannon.aimOffset || 0) + turn, -Math.PI / 2, Math.PI / 2);
      if (Math.abs(turn) > 0.001) syncRemoteStructure(activeCannon);
      mx = 0;
    }
    const len = Math.hypot(mx, my) || 1;
    mx /= len;
    my /= len;
    p.x = clamp(p.x + mx * speed * dt, 80, WORLD - 80);
    p.y = clamp(p.y + my * speed * dt, 80, WORLD - 80);
    resolveWallCollision(p, 15);
    if (mx || my) p.facing = Math.atan2(my, mx);
    p.stamina = clamp(p.stamina + (sprinting && (mx || my) ? -28 : 8 + p.agility * 0.6) * dt, 0, 100);

    const boardedRaft = raftBoardingAt(p);
    if (boardedRaft && hotbar[selected].id === "oar" && mouse.down) {
      if (!spendStamina(0.18, false)) {
        rowingTimer = Math.max(0, rowingTimer - dt * 7);
      } else {
        const a = angleTo(screenCenterWorld(), mouseWorld());
        const dx = Math.cos(a) * 72 * dt;
        const dy = Math.sin(a) * 72 * dt;
        const moved = boardedRaft.local ? moveRaft(dx, dy) : moveRemoteRaft(boardedRaft, dx, dy);
        if (moved) {
          p.x += dx;
          p.y += dy;
          rowingTimer += dt * 9;
          rowingDurabilityTimer += dt;
          if (rowingDurabilityTimer >= 0.75) {
            rowingDurabilityTimer = 0;
            useItemDurability();
          }
        }
      }
    } else {
      rowingTimer = Math.max(0, rowingTimer - dt * 7);
      rowingDurabilityTimer = 0;
    }

    updateCast(dt);
    updateDebris(dt);
    updateAnimals(dt);
    updateShark(dt);
    updateStructures(dt);
    updateProjectiles(dt);
    updateWorldRespawns(dt);
    updateParticles(dt);

    if (state.debris.length < 180) spawnDebris();
    state.camera.x += (p.x - state.camera.x) * 0.12;
    state.camera.y += (p.y - state.camera.y) * 0.12;
    updateMouseWorld();
    updateHud();
    updateServerMode(dt);
  }

  function screenCenterWorld() {
    return { x: state.camera.x, y: state.camera.y };
  }

  function mouseWorld() {
    return { x: mouse.worldX, y: mouse.worldY };
  }

  function updateMouseWorld() {
    mouse.worldX = state.camera.x + (mouse.x - innerWidth / 2);
    mouse.worldY = state.camera.y + (mouse.y - innerHeight / 2);
    state.player.facing = angleTo(state.player, mouseWorld());
  }

  function isOnRaft(p) {
    return Boolean(raftAt(p.x, p.y) || remoteRaftAt(p.x, p.y));
  }

  function isOnIsland(p) {
    return state.islands.some((island) => Math.hypot(p.x - island.x, p.y - island.y) <= island.r * ISLAND_WALK_SCALE);
  }

  function raftTileRect(rt) {
    return {
      x: state.raftOffset.x + rt.gx * TILE,
      y: state.raftOffset.y + rt.gy * TILE,
      w: TILE,
      h: TILE
    };
  }

  function remoteRaftTileRect(world, rt) {
    return {
      x: world.raftOffset.x + rt.gx * TILE,
      y: world.raftOffset.y + rt.gy * TILE,
      w: TILE,
      h: TILE
    };
  }

  function raftBoardingAt(p) {
    const local = raftAt(p.x, p.y);
    if (local) return { local: true, tile: local };
    return remoteRaftAt(p.x, p.y);
  }

  function remoteRaftAt(x, y) {
    for (const [ownerId, world] of remoteWorlds) {
      for (const rt of world.raft || []) {
        const r = remoteRaftTileRect(world, rt);
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) {
          return { local: false, ownerId, world, tile: rt };
        }
      }
    }
    return null;
  }

  function nearestRemoteStructure(p, maxDist = 56) {
    let best = null;
    let bestD = maxDist;
    for (const [ownerId, world] of remoteWorlds) {
      for (const st of world.structures || []) {
        if (!st || st.hp <= 0) continue;
        const d = dist(p, st);
        if (d < bestD) {
          best = { ownerId, structure: st };
          bestD = d;
        }
      }
    }
    return best;
  }

  function moveRaft(dx, dy) {
    if (raftWouldHitIsland(dx, dy)) {
      toast("The raft scrapes the island shore.");
      return false;
    }
    state.raftOffset.x += dx;
    state.raftOffset.y += dy;
    for (const st of state.structures) {
      if (st.base === "raft") {
        st.x += dx;
        st.y += dy;
      }
    }
    return true;
  }

  function moveRemoteRaft(boarded, dx, dy) {
    if (!boarded?.world || remoteRaftWouldHitIsland(boarded.world, dx, dy)) {
      toast("The raft scrapes the island shore.");
      return false;
    }
    boarded.world.raftOffset.x += dx;
    boarded.world.raftOffset.y += dy;
    for (const st of boarded.world.structures || []) {
      if (st.base === "raft") {
        st.x += dx;
        st.y += dy;
      }
    }
    queueRemoteRaftMove(boarded.ownerId, dx, dy);
    return true;
  }

  function raftWouldHitIsland(dx, dy) {
    for (const rt of state.raft) {
      const r = raftTileRect(rt);
      const corners = [
        { x: r.x + dx + 6, y: r.y + dy + 6 },
        { x: r.x + r.w + dx - 6, y: r.y + dy + 6 },
        { x: r.x + dx + 6, y: r.y + r.h + dy - 6 },
        { x: r.x + r.w + dx - 6, y: r.y + r.h + dy - 6 }
      ];
      if (corners.some((pt) => state.islands.some((island) => Math.hypot(pt.x - island.x, pt.y - island.y) < island.r + 8))) return true;
    }
    return false;
  }

  function remoteRaftWouldHitIsland(world, dx, dy) {
    for (const rt of world.raft || []) {
      const r = remoteRaftTileRect(world, rt);
      const corners = [
        { x: r.x + dx + 6, y: r.y + dy + 6 },
        { x: r.x + r.w + dx - 6, y: r.y + dy + 6 },
        { x: r.x + dx + 6, y: r.y + r.h + dy - 6 },
        { x: r.x + r.w + dx - 6, y: r.y + r.h + dy - 6 }
      ];
      if (corners.some((pt) => state.islands.some((island) => Math.hypot(pt.x - island.x, pt.y - island.y) < island.r + 8))) return true;
    }
    return false;
  }

  function updateDebris(dt) {
    for (const d of state.debris) {
      if (!d.stopped) {
        const next = { x: d.x + d.vx * dt, y: d.y + d.vy * dt };
        const island = shoreCollision(next);
        if (island) {
          const a = angleTo(island, next);
          d.x = island.x + Math.cos(a) * (island.r + 18);
          d.y = island.y + Math.sin(a) * (island.r + 18);
          d.vx = 0;
          d.vy = 0;
          d.stopped = true;
        } else if (hitsWall(next, d.type === "barrel" ? 16 : 12)) {
          d.vx = 0;
          d.vy = 0;
          d.stopped = true;
        } else {
          d.x = next.x;
          d.y = next.y;
        }
      }
      d.life -= dt;
      d.bob += dt * 3;
      if (!d.stopped && d.y > WORLD - 120) {
        d.y = 120;
        d.x = rnd(160, WORLD - 160);
      }
      if (dist(d, state.player) < 42) collectDebris(d);
    }
    state.debris = state.debris.filter((d) => !d.dead && d.life > 0);
  }

  function shoreCollision(p) {
    return state.islands.find((island) => Math.hypot(p.x - island.x, p.y - island.y) < island.r + 18);
  }

  function collectDebris(d) {
    d.dead = true;
    if (d.type === "barrel") {
      const haul = ["wood", "wood", "leaves", "scrap", "scrap", "cloth", "rope", "glass", "iron"];
      const found = {};
      for (let i = 0; i < 4; i++) {
        const item = haul[Math.floor(Math.random() * haul.length)];
        found[item] = (found[item] || 0) + 1;
      }
      if (Math.random() < 0.08) found.steel = (found.steel || 0) + 1;
      for (const [item, qty] of Object.entries(found)) addRes(item, qty);
      gainXp(5);
      toast(`Barrel: ${Object.entries(found).map(([item, qty]) => `${qty} ${label(item).toLowerCase()}`).join(", ")}.`);
      burst(d.x, d.y, "#d89a54", 10);
      return;
    }
    addRes(d.type, 1);
    gainXp(1);
    burst(d.x, d.y, "#e8d3a4", 5);
  }

  function updateCast(dt) {
    if (!cast) return;
    cast.t += dt;
    const dx = cast.tx - cast.x;
    const dy = cast.ty - cast.y;
    const len = Math.hypot(dx, dy);
    if (!cast.hooked && len > 4) {
      cast.x += (dx / len) * 420 * dt;
      cast.y += (dy / len) * 420 * dt;
    } else {
      cast.hooked = true;
      if (!cast.catch && cast.t > 0.8) {
        const nearest = state.debris.find((d) => dist(d, cast) < 55);
        if (nearest) {
          cast.catch = nearest;
          toast("Hooked floating debris.");
        } else if (Math.random() < dt * 0.65) {
          cast.catch = { type: "rawFish", x: cast.x, y: cast.y, fish: true };
          toast("Fish on the line.");
        }
      }
      const p = state.player;
      const a = angleTo(cast, p);
      cast.x += Math.cos(a) * 260 * dt;
      cast.y += Math.sin(a) * 260 * dt;
      if (cast.catch) {
        cast.catch.x = cast.x;
        cast.catch.y = cast.y;
      }
      if (dist(cast, p) < 36) {
        if (cast.catch) {
          if (cast.catch.fish) {
            addRes("rawFish", 1);
            gainXp(8);
            toast("Caught raw fish. Grill it for more food.");
          } else {
            collectDebris(cast.catch);
          }
        }
        cast = null;
      }
    }
  }

  function updateAnimals(dt) {
    for (const a of state.animals) {
      a.hit = Math.max(0, a.hit - dt);
      a.cd = Math.max(0, a.cd - dt);
      const p = state.player;
      let near = dist(a, p);
      let vx = Math.cos(a.wander) * 0.25;
      let vy = Math.sin(a.wander) * 0.25;
      const playerIsland = islandAt(p);
      const crocodileOnLand = a.type === "crocodile" && playerIsland && a.homeIsland === playerIsland;
      if (a.type === "crocodile" && a.submerged) {
        if (!crocodileOnLand) continue;
        const emerge = waterPointAroundIsland(a.homeIsland || playerIsland, rnd(34, 76));
        a.x = emerge.x;
        a.y = emerge.y;
        a.wander = angleTo(a, p);
        a.submerged = false;
        near = dist(a, p);
      }
      if (a.type === "crocodile" && !crocodileOnLand) {
        const home = a.homeIsland || nearestIsland(a);
        if (!home || dist(a, home) > home.r * ISLAND_WALK_SCALE + 4) {
          a.submerged = true;
          continue;
        }
        const away = angleTo(home, a);
        a.wander = away;
        a.x += Math.cos(away) * a.speed * 1.65 * dt;
        a.y += Math.sin(away) * a.speed * 1.65 * dt;
        resolveWallCollision(a, 24);
        continue;
      }
      const noticeRange = a.type === "crocodile" ? 999 : a.type === "crab" ? 55 : a.type === "pig" ? 90 : 125;
      if (crocodileOnLand || near < noticeRange) {
        const aa = angleTo(a, p);
        vx = Math.cos(aa);
        vy = Math.sin(aa);
        a.wander = aa;
      } else if (Math.random() < dt * 0.8) {
        a.wander += rnd(-0.9, 0.9);
      }
      if (Math.abs(vx) + Math.abs(vy) > 0.05) a.wander = Math.atan2(vy, vx);
      const charge = a.type === "elephant" && near < 85 ? 1.25 : 1;
      a.x += vx * a.speed * charge * dt;
      a.y += vy * a.speed * charge * dt;
      if (a.type === "crocodile") damageBlockingStructure(a);
      resolveWallCollision(a, a.type === "crab" ? 15 : a.type === "crocodile" ? 24 : 22);
      const island = nearestIsland(a);
      if (a.type === "crocodile" && a.homeIsland && dist(a, a.homeIsland) > a.homeIsland.r + 92) {
        const back = angleTo(a, a.homeIsland);
        a.x += Math.cos(back) * a.speed * 2.2 * dt;
        a.y += Math.sin(back) * a.speed * 2.2 * dt;
        a.wander = back;
      } else if (a.type !== "crocodile" && island && dist(a, island) > island.r * 0.88) {
        const back = angleTo(a, island);
        a.x += Math.cos(back) * a.speed * 2 * dt;
        a.y += Math.sin(back) * a.speed * 2 * dt;
        a.wander = back;
      }
      if (near < (a.type === "crocodile" ? 34 : 28) && a.cd <= 0) {
        hurt(a.dmg, `${cap(a.type)} hit you.`);
        a.cd = a.type === "crocodile" ? 1.25 : a.type === "elephant" ? 1.4 : 0.9;
      }
    }
    state.animals = state.animals.filter((a) => !a.dead);
  }

  function damageBlockingStructure(a) {
    if (a.cd > 0) return;
    let target = null;
    let bestD = 46;
    for (const st of state.structures) {
      if (st.base !== "island") continue;
      if (a.homeIsland && dist(st, a.homeIsland) > a.homeIsland.r + 20) continue;
      const d = dist(a, st) - footprintRadius(st.type);
      if (d < bestD) {
        bestD = d;
        target = st;
      }
    }
    if (!target) return;
    target.hp -= 16;
    a.cd = 1.1;
    burst(target.x, target.y, "#87a85d", 8);
    toast("Crocodile is tearing through your blocks.");
    if (target.hp <= 0) {
      state.structures = state.structures.filter((st) => st !== target);
      if (activeCannon === target) activeCannon = null;
    }
  }

  function updateShark(dt) {
    const p = state.player;
    const land = islandAt(p);
    for (const s of state.sharks) {
      s.bite = Math.max(0, s.bite - dt);
      s.flee = Math.max(0, s.flee - dt);
      s.aggro = Math.max(0, s.aggro - dt);
      s.finBob += dt * 2.4;
      if (Math.random() < dt * 0.25) s.wander += rnd(-0.65, 0.65);
      const aggro = s.aggressive || s.aggro > 0;
      const target = aggro ? sharkTarget(s, land) : null;
      let a = target ? (s.flee > 0 ? angleTo(target, s) : angleTo(s, target)) : s.wander;
      a = steerAroundIslands(s, a);
      if (s.serverControlled && Number.isFinite(s.serverX) && Number.isFinite(s.serverY)) {
        const serverAim = angleTo(s, { x: s.serverX, y: s.serverY });
        a += shortAngle(serverAim - a) * 0.55;
      }
      const spd = s.serverControlled ? 112 : s.flee > 0 ? 125 : aggro ? 105 : 42;
      s.x += Math.cos(a) * spd * dt;
      s.y += Math.sin(a) * spd * dt;
      if (s.serverControlled && Number.isFinite(s.serverX) && Number.isFinite(s.serverY)) {
        const gapToServer = Math.hypot(s.serverX - s.x, s.serverY - s.y);
        const pull = clamp(dt * (gapToServer > 420 ? 1.8 : 0.55), 0, 0.28);
        s.x += (s.serverX - s.x) * pull;
        s.y += (s.serverY - s.y) * pull;
        s.wander = Number.isFinite(s.serverFacing) ? s.serverFacing : a;
      } else {
        s.wander = a;
      }
      for (const other of state.sharks) {
        if (other === s) continue;
        const gap = dist(s, other);
        if (gap > 0 && gap < 120) {
          s.x += ((s.x - other.x) / gap) * (120 - gap) * 0.18 * dt;
          s.y += ((s.y - other.y) / gap) * (120 - gap) * 0.18 * dt;
        }
      }
      keepSharkOffLand(s);
      resolveWallCollision(s, 28);
      if (aggro && !land && !isOnRaft(p) && dist(s, p) < 46 && s.bite <= 0) {
        hurt(SHARK_BITE_DAMAGE, "The shark bit you.");
        s.bite = 1.3;
      }
      const victim = nearestRaftTile(s) || state.raft[0];
      const victimCenter = victim ? raftTileCenter(victim) : null;
      if (aggro && victimCenter && dist(s, victimCenter) < 70 && s.bite <= 0) {
        damageRaftBlock(victim, SHARK_RAFT_DAMAGE);
        s.bite = 1.65;
        toast("Angry shark is chewing the raft.");
        if (victim.hp <= 0) breakRaftTile(victim);
      }
    }
  }

  function sharkTarget(shark, localLand) {
    const targetId = shark.serverTargetId;
    if (targetId) {
      if (targetId === serverPlayerId || targetId === localPeerId) return localLand ? sharkRetreatPoint(localLand, shark) : state.player;
      const remote = remotePlayers.find((player) => player.id === targetId && player.health > 0);
      if (remote) return remote;
    }
    if (localLand) return sharkRetreatPoint(localLand, shark);
    if (shark.serverControlled && !targetId) return null;
    return state.player;
  }

  function islandAt(p) {
    return state.islands.find((island) => Math.hypot(p.x - island.x, p.y - island.y) <= island.r * ISLAND_WALK_SCALE);
  }

  function sharkWaterPoint(island, s) {
    const a = angleTo(island, s);
    return {
      x: island.x + Math.cos(a) * (island.r + 90),
      y: island.y + Math.sin(a) * (island.r + 90)
    };
  }

  function sharkRetreatPoint(island, s) {
    const a = angleTo(island, s);
    return {
      x: island.x + Math.cos(a) * (island.r + 460),
      y: island.y + Math.sin(a) * (island.r + 460)
    };
  }

  function steerAroundIslands(entity, desiredAngle) {
    let angle = desiredAngle;
    for (const island of state.islands) {
      const d = dist(entity, island);
      const look = {
        x: entity.x + Math.cos(angle) * 135,
        y: entity.y + Math.sin(angle) * 135
      };
      const aboutToHit = Math.hypot(look.x - island.x, look.y - island.y) < island.r + 88;
      if (d > island.r + 230 && !aboutToHit) continue;
      const away = angleTo(island, entity);
      const side = shortAngle(angle - away) >= 0 ? 1 : -1;
      const tangent = away + side * Math.PI / 2;
      const target = d < island.r + 72 ? away : tangent;
      angle += shortAngle(target - angle) * (aboutToHit ? 0.85 : 0.42);
    }
    return angle;
  }

  function keepSharkOffLand(s) {
    for (const island of state.islands) {
      const d = dist(s, island);
      const min = island.r + 42;
      if (d < min) {
        const a = angleTo(island, s);
        s.x = island.x + Math.cos(a) * min;
        s.y = island.y + Math.sin(a) * min;
        s.flee = Math.max(s.flee, 0.45);
      }
    }
  }

  function damageRaftBlock(rt, amount) {
    const st = structureOnTile(rt);
    if (st) {
      st.hp -= amount;
      burst(st.x, st.y, st.type === "torch" ? "#ffb44c" : "#ff7482", 7);
      if (st.hp <= 0) {
        state.structures = state.structures.filter((item) => item !== st);
        toast(`${label(st.type)} broke.`);
      }
      return;
    }
    rt.hp -= amount;
  }

  function nearestRaftTile(from) {
    let best = null;
    let bestD = Infinity;
    for (const rt of state.raft) {
      const r = raftTileRect(rt);
      const c = { x: r.x + TILE / 2, y: r.y + TILE / 2 };
      const d = dist(from, c);
      if (d < bestD) {
        best = rt;
        bestD = d;
      }
    }
    return best;
  }

  function raftTileCenter(rt) {
    const r = raftTileRect(rt);
    return { x: r.x + TILE / 2, y: r.y + TILE / 2 };
  }

  function breakRaftTile(rt) {
    const doomed = state.structures.filter((st) => st.base === "raft" && raftAt(st.x, st.y) === rt);
    state.structures = state.structures.filter((st) => !doomed.includes(st));
    if (doomed.includes(activeCannon)) activeCannon = null;
    state.raft = state.raft.filter((tile) => tile !== rt);
    burst(raftTileRect(rt).x + TILE / 2, raftTileRect(rt).y + TILE / 2, "#d89a54", 14);
  }

  function structureOnTile(rt) {
    return state.structures.find((st) => st.base === "raft" && raftAt(st.x, st.y) === rt);
  }

  function nearestRaftEdge(from = state.player) {
    let best = { x: state.raftOffset.x, y: state.raftOffset.y };
    let bestD = Infinity;
    for (const rt of state.raft) {
      const r = raftTileRect(rt);
      const pts = [
        { x: r.x + TILE / 2, y: r.y },
        { x: r.x + TILE / 2, y: r.y + TILE },
        { x: r.x, y: r.y + TILE / 2 },
        { x: r.x + TILE, y: r.y + TILE / 2 }
      ];
      for (const pt of pts) {
        const d = dist(pt, from);
        if (d < bestD) {
          bestD = d;
          best = pt;
        }
      }
    }
    return best;
  }

  function updateStructures(dt) {
    for (const st of state.structures) {
      if (st.type === "grill" && st.timer > 0) {
        st.timer -= dt;
        if (st.timer <= 0) {
          st.timer = 0;
          st.ready = true;
          toast("Grill has cooked fish ready.");
        }
      }
      if (st.type === "waterMaker" && st.timer > 0) {
        st.timer -= dt;
        if (st.timer <= 0) {
          st.timer = 0;
          st.ready = true;
          toast("Water maker filled the flask.");
        }
      }
      if (st.type === "plantPot" && st.timer > 0) {
        st.timer -= dt;
        if (st.timer <= 0) {
          st.ready = true;
          st.timer = 0;
          toast("Tomatoes are ready to harvest.");
        }
      }
      if (st.type === "cannon") st.cooldown = Math.max(0, (st.cooldown || 0) - dt);
    }
  }

  function updateProjectiles(dt) {
    for (const shot of state.projectiles) {
      shot.age = (shot.age || 0) + dt;
      shot.life -= dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.life <= 0 || hitsWall(shot, 7)) {
        shot.dead = true;
      }
      if (!shot.dead && shot.type === "musketBall" && shot.age > 0.04) {
        shot.dead = damageDirectShot(shot);
      }
      if (!shot.dead && shot.type === "cannonball" && shot.age > 0.06) {
        const hitAnimal = state.animals.some((a) => !a.dead && dist(a, shot) < 20);
        const hitShark = state.sharks.some((s) => dist(s, shot) < 35);
        const armedForBlocks = shot.age > 0.18;
        const hitStructure = armedForBlocks && state.structures.some((st) => dist(st, shot) < footprintRadius(st.type) + 8);
        const hitRaft = armedForBlocks && state.raft.some((rt) => {
          const r = raftTileRect(rt);
          return shot.x > r.x && shot.x < r.x + r.w && shot.y > r.y && shot.y < r.y + r.h;
        });
        const hitRemoteWorld = armedForBlocks && cannonballHitsRemoteWorld(shot);
        if (hitAnimal || hitShark || hitStructure || hitRaft || hitRemoteWorld) shot.dead = true;
      }
      if (shot.dead && !shot.exploded && shot.type === "cannonball") {
        shot.exploded = true;
        explodeCannonball(shot);
      } else if (shot.dead && !shot.exploded && shot.type === "musketBall") {
        shot.exploded = true;
        burst(shot.x, shot.y, "#d2d7d9", 6);
      }
    }
    state.projectiles = state.projectiles.filter((shot) => !shot.dead);
  }

  function cannonballHitsRemoteWorld(shot) {
    for (const world of remoteWorlds.values()) {
      if ((world.structures || []).some((st) => dist(st, shot) < footprintRadius(st.type) + 8)) return true;
      if ((world.raft || []).some((rt) => {
        const r = remoteRaftTileRect(world, rt);
        return shot.x > r.x && shot.x < r.x + r.w && shot.y > r.y && shot.y < r.y + r.h;
      })) return true;
    }
    return false;
  }

  function fireCannon(cannon) {
    if (!cannon || cannon.hp <= 0) return;
    if (cannon.cooldown > 0) return toast("Cannon is reloading.");
    if (!spendStamina(12)) return;
    const angle = (cannon.angle || 0) + (cannon.aimOffset || 0);
    cannon.cooldown = 1.45;
    const shot = {
      type: "cannonball",
      x: cannon.x + Math.cos(angle) * 36,
      y: cannon.y + Math.sin(angle) * 36,
      vx: Math.cos(angle) * 430,
      vy: Math.sin(angle) * 430,
      age: 0,
      life: 1.28,
      damage: 42,
      radius: 52
    };
    state.projectiles.push(shot);
    queueProjectileCommand(shot);
    syncRemoteStructure(cannon);
    burst(cannon.x + Math.cos(angle) * 32, cannon.y + Math.sin(angle) * 32, "#ffe0a3", 9);
  }

  function fireMusket() {
    const p = state.player;
    if (musketCooldown > 0) return toast(`Musket reloading: ${Math.ceil(musketCooldown)}s.`);
    if (!spendStamina(14)) return;
    useItemDurability();
    const angle = angleTo(p, mouseWorld());
    musketCooldown = 7;
    const shot = {
      type: "musketBall",
      x: p.x + Math.cos(angle) * 38,
      y: p.y + Math.sin(angle) * 38,
      vx: Math.cos(angle) * 560,
      vy: Math.sin(angle) * 560,
      age: 0,
      life: 1.05,
      damage: 21,
      radius: 8
    };
    state.projectiles.push(shot);
    queueProjectileCommand(shot);
    burst(p.x + Math.cos(angle) * 34, p.y + Math.sin(angle) * 34, "#ffe7a8", 8);
  }

  function damageDirectShot(shot) {
    for (const a of state.animals) {
      if (a.dead || a.submerged || dist(a, shot) > 24) continue;
      a.hp -= shot.damage;
      a.hit = 0.25;
      if (a.hp <= 0) killAnimal(a);
      gainXp(3);
      return true;
    }
    for (const s of state.sharks) {
      if (dist(s, shot) > 34) continue;
      s.hp -= shot.damage;
      s.aggro = 18;
      s.flee = 0.5;
      if (s.hp <= 0) {
        addRes("sharkMeat", 3);
        gainXp(45);
        respawnShark(s);
        toast("Musket sank a shark. Shark meat acquired.");
      }
      return true;
    }
    for (const st of [...state.structures]) {
      if (dist(st, shot) > footprintRadius(st.type) + 7) continue;
      st.hp -= Math.max(6, Math.round(shot.damage * 0.45));
      if (st.hp <= 0) {
        state.structures = state.structures.filter((item) => item !== st);
        if (activeCannon === st) activeCannon = null;
      }
      return true;
    }
    if (damageRemoteStructureShot(shot)) return true;
    const hitRemote = remotePlayers.find((other) => other && other.health > 0 && dist(other, shot) < 22);
    if (hitRemote) {
      hitRemote.health = Math.max(0, (hitRemote.health || 100) - shot.damage);
      queuePlayerHit(hitRemote.id, shot.damage);
      toast(`Shot ${hitRemote.name || "player"}.`);
      return true;
    }
    return false;
  }

  function explodeCannonball(shot) {
    burst(shot.x, shot.y, "#31333a", 18);
    burst(shot.x, shot.y, "#ffb45d", 16);
    for (const a of state.animals) {
      if (a.dead || dist(a, shot) > shot.radius) continue;
      a.hp -= shot.damage;
      a.hit = 0.25;
      if (a.hp <= 0) killAnimal(a);
    }
    for (const s of state.sharks) {
      if (dist(s, shot) > shot.radius + 12) continue;
      s.hp -= shot.damage;
      s.aggro = 16;
      s.flee = 0.8;
      if (s.hp <= 0) {
        addRes("sharkMeat", 3);
        gainXp(45);
        respawnShark(s);
        toast("Cannon sank a shark. Shark meat acquired.");
      }
    }
    for (const st of [...state.structures]) {
      if (dist(st, shot) > shot.radius + footprintRadius(st.type)) continue;
      st.hp -= shot.damage;
      if (st.hp <= 0) {
        state.structures = state.structures.filter((item) => item !== st);
        if (activeCannon === st) activeCannon = null;
      }
    }
    for (const rt of [...state.raft]) {
      const r = raftTileRect(rt);
      const c = { x: r.x + TILE / 2, y: r.y + TILE / 2 };
      if (dist(c, shot) > shot.radius + TILE * 0.35) continue;
      rt.hp -= Math.round(shot.damage * 0.75);
      if (rt.hp <= 0) breakRaftTile(rt);
    }
    damageRemoteWorldsInExplosion(shot);
    for (const other of remotePlayers) {
      if (!other || other.health <= 0 || dist(other, shot) > shot.radius) continue;
      other.health = Math.max(0, (other.health || 100) - shot.damage);
      queuePlayerHit(other.id, shot.damage);
    }
    gainXp(4);
  }

  function damageRemoteStructureShot(shot) {
    for (const [ownerId, world] of remoteWorlds) {
      for (const st of [...(world.structures || [])]) {
        if (dist(st, shot) > footprintRadius(st.type) + 7) continue;
        const damage = Math.max(4, Math.round(shot.damage * 0.3));
        st.hp -= damage;
        queueWorldCommand(ownerId, { type: "damageStructure", structureId: st.id, damage });
        if (st.hp <= 0) removeRemoteStructureLocal(world, st);
        return true;
      }
    }
    return false;
  }

  function damageRemoteWorldsInExplosion(shot) {
    for (const [ownerId, world] of remoteWorlds) {
      for (const st of [...(world.structures || [])]) {
        if (dist(st, shot) > shot.radius + footprintRadius(st.type)) continue;
        st.hp -= shot.damage;
        queueWorldCommand(ownerId, { type: "damageStructure", structureId: st.id, damage: shot.damage });
        if (st.hp <= 0) removeRemoteStructureLocal(world, st);
      }
      for (const rt of [...(world.raft || [])]) {
        const c = remoteTileCenter(world, rt);
        if (dist(c, shot) > shot.radius + TILE * 0.35) continue;
        const damage = Math.round(shot.damage * 0.75);
        rt.hp -= damage;
        queueWorldCommand(ownerId, { type: "damageRaftTile", gx: rt.gx, gy: rt.gy, damage });
        if (rt.hp <= 0) removeRemoteRaftTileLocal(world, rt);
      }
    }
  }

  function updateWorldRespawns(dt) {
    for (const island of state.islands) {
      for (const tree of island.trees) {
        if (!tree.dead) continue;
        tree.respawn = Math.max(0, (tree.respawn || 0) - dt);
        if (tree.respawn <= 0) {
          const p = openIslandSpot(island, 0.78, 24);
          tree.x = p.x;
          tree.y = p.y;
          tree.hp = tree.maxHp || 40;
          tree.dead = false;
        }
      }
      for (const loot of island.loot) {
        if (!loot.dead || loot.type !== "tomato") continue;
        loot.respawn = Math.max(0, (loot.respawn || 0) - dt);
        if (loot.respawn <= 0) {
          const p = openIslandSpot(island, 0.86, 18);
          loot.x = p.x;
          loot.y = p.y;
          loot.dead = false;
        }
      }
    }
    for (const pending of state.animalRespawns) pending.time -= dt;
    const ready = state.animalRespawns.filter((pending) => pending.time <= 0);
    state.animalRespawns = state.animalRespawns.filter((pending) => pending.time > 0);
    for (const pending of ready) {
      const island = pending.island || nearestIsland(state.player);
      const spot = pending.type === "crocodile" ? waterPointAroundIsland(island, rnd(38, 84)) : openIslandSpot(island, 0.82, 28);
      state.animals.push(animal(pending.type, spot, island));
    }
    const playerIsland = islandAt(state.player);
    if (playerIsland) {
      state.crocTimer -= dt;
      if (state.crocTimer <= 0) {
        const crocsHere = state.animals.filter((a) => a.type === "crocodile" && a.homeIsland === playerIsland && !a.dead).length;
        if (crocsHere < 1 && Math.random() < 0.42) {
          state.animals.push(animal("crocodile", waterPointAroundIsland(playerIsland, rnd(34, 76)), playerIsland));
          toast("A crocodile is swimming in from the shore.");
        }
        state.crocTimer = rnd(100, 210);
      }
    } else {
      state.crocTimer = Math.max(10, state.crocTimer);
    }
  }

  function waterPointAroundIsland(island, extra = 54) {
    const a = rnd(0, TAU);
    const r = island.r + extra;
    return { x: island.x + Math.cos(a) * r, y: island.y + Math.sin(a) * r };
  }

  function openIslandSpot(island, scale, radius) {
    for (let i = 0; i < 30; i++) {
      const p = pointOnIsland(island, scale);
      const occupiedByStructure = state.structures.some((st) => dist(st, p) < footprintRadius(st.type) + radius);
      const occupiedByTree = island.trees.some((tree) => !tree.dead && dist(tree, p) < radius + 18);
      const occupiedByAnimal = state.animals.some((a) => !a.dead && dist(a, p) < radius + 18);
      const inWreck = island.shipwreck && dist(island.shipwreck, p) < SHIPWRECK_CLEAR_RADIUS;
      if (!occupiedByStructure && !occupiedByTree && !occupiedByAnimal && !inWreck) return p;
    }
    return pointOnIsland(island, scale);
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function spendStamina(cost, notify = true) {
    const p = state.player;
    if (p.stamina <= 0 || p.stamina < cost) {
      p.stamina = clamp(p.stamina, 0, 100);
      if (notify) toast("Too exhausted to act. Rest for a moment.");
      return false;
    }
    p.stamina = clamp(p.stamina - cost, 0, 100);
    return true;
  }

  function recoverStamina(amount) {
    state.player.stamina = clamp(state.player.stamina + amount, 0, 100);
  }

  function selectedHotbarRef() {
    return HOTBAR_SWAP_SLOTS.includes(selected) ? { area: "hotbar", index: selected } : null;
  }

  function useItemDurability(ref = selectedHotbarRef(), amount = 1) {
    const item = getSlot(ref);
    const spec = item && toolSpec(item.id);
    if (!item || !spec?.durability) return true;
    item.durability = clamp((item.durability ?? spec.durability) - amount, 0, item.maxDurability || spec.durability);
    if (item.durability <= 0) {
      setSlot(ref, null);
      toast(`${label(item.id)} broke.`);
    } else {
      setSlot(ref, item);
    }
    syncManagedCountsFromSlots();
    renderHotbar();
    renderInventory();
    return item.durability > 0;
  }

  function useSelected() {
    if (!gameStarted) return;
    if (!state.player.alive) return;
    updateMouseWorld();
    if (activeCannon) return fireCannon(activeCannon);
    if (state.player.stamina <= 0) return toast("Too exhausted to act. Rest for a moment.");
    const id = hotbar[selected]?.id || "empty";
    if (buildMode) return placeBuild();
    if (id === "rod") return useRod();
    const spec = toolSpec(id);
    if (spec && ["axe", "spear", "hammer"].includes(spec.base)) return swing(id);
    if (id === "musket") return fireMusket();
    if (id === "bandage") return useBandage();
    if (FOOD_ITEMS.includes(id)) {
      if (!spendStamina(2)) return;
      if (!eatSpecificFood(id)) toast(`No ${label(id)}.`);
      return;
    }
    if (id === "flask" || id === "waterFlask") return drinkWater();
    if (isBuildRecipe(id)) {
      buildChoice = id;
      buildMode = true;
      return placeBuild();
    }
  }

  function useRod() {
    if (cast) return;
    if (!spendStamina(4)) return;
    useItemDurability();
    const p = state.player;
    const a = angleTo(p, mouseWorld());
    cast = { x: p.x, y: p.y, tx: p.x + Math.cos(a) * 330, ty: p.y + Math.sin(a) * 330, t: 0, hooked: false, catch: null };
  }

  function swing(kind) {
    const p = state.player;
    if (p.attackCd > 0) return;
    const spec = toolSpec(kind);
    if (!spec || !["axe", "spear", "hammer"].includes(spec.base)) return;
    const baseKind = spec.base;
    const tierStep = tierIndex(spec.tier);
    if (!spendStamina(baseKind === "spear" ? 9 + tierStep * 0.5 : 8 + tierStep * 0.5)) return;
    useItemDurability();
    p.attackCd = baseKind === "spear" ? clamp(0.48 - tierStep * 0.04, 0.32, 0.48) : clamp(0.62 - tierStep * 0.05, 0.42, 0.62);
    toolAnim = { kind: baseKind, t: p.attackCd, duration: p.attackCd };
    const reach = (baseKind === "spear" ? 82 : 58) + tierStep * (baseKind === "spear" ? 5 : 3);
    const baseDamage = baseKind === "spear" ? 28 : baseKind === "axe" ? 20 : 12;
    const damage = Math.round(baseDamage * spec.power + p.strength * 3);
    const targetAngle = angleTo(p, mouseWorld());
    burst(p.x + Math.cos(targetAngle) * 34, p.y + Math.sin(targetAngle) * 34, baseKind === "hammer" ? "#b8d4de" : "#fff3c9", 6);

    for (const a of state.animals) {
      if (dist(p, a) < reach && Math.abs(shortAngle(targetAngle - angleTo(p, a))) < 0.9) {
        a.hp -= damage;
        a.hit = 0.2;
        gainXp(2);
        if (a.hp <= 0) killAnimal(a);
        return;
      }
    }
    const shark = nearestShark(p, reach + 8);
    if (shark) {
      shark.hp -= damage;
      shark.flee = 2.2;
      shark.aggro = 14;
      toast("The shark backs off.");
      if (shark.hp <= 0) {
        addRes("sharkMeat", 3);
        gainXp(45);
        respawnShark(shark);
        toast("Shark defeated. Shark meat acquired.");
      }
      return;
    }
    if (damageRemotePlayer(reach, targetAngle, damage)) return;
    if (baseKind === "axe" && damagePlacedItem(reach, targetAngle, Math.round(damage * 0.42))) return;
    if (baseKind === "axe") chopTree(reach, targetAngle, damage);
    if (baseKind === "hammer") repairTile(reach, spec.power);
  }

  function damageRemotePlayer(reach, targetAngle, damage) {
    const p = state.player;
    let best = null;
    let bestD = Infinity;
    for (const other of remotePlayers) {
      if (!other || other.health <= 0 || !other.id) continue;
      const d = dist(p, other);
      if (d < reach + 14 && Math.abs(shortAngle(targetAngle - angleTo(p, other))) < 0.9 && d < bestD) {
        best = other;
        bestD = d;
      }
    }
    if (!best) return false;
    best.health = Math.max(0, (best.health || 100) - damage);
    queuePlayerHit(best.id, damage);
    burst(best.x, best.y, "#ff8f75", 10);
    gainXp(3);
    toast(`Hit ${best.name || "player"}.`);
    return true;
  }

  function damagePlacedItem(reach, targetAngle, damage) {
    const p = state.player;
    let best = null;
    let bestD = Infinity;
    for (const st of state.structures) {
      const d = dist(p, st);
      if (d < reach + footprintRadius(st.type) && Math.abs(shortAngle(targetAngle - angleTo(p, st))) < 0.95 && d < bestD) {
        best = st;
        bestD = d;
      }
    }
    if (best) {
      best.hp -= damage;
      burst(best.x, best.y, "#ffb08a", 8);
      if (best.hp <= 0) {
        state.structures = state.structures.filter((st) => st !== best);
        toast(`${label(best.type)} chopped down.`);
      } else {
        toast(`${label(best.type)} damaged.`);
      }
      gainXp(2);
      return true;
    }
    for (const rt of state.raft) {
      const r = raftTileRect(rt);
      const c = { x: r.x + TILE / 2, y: r.y + TILE / 2 };
      const d = dist(p, c);
      if (d < reach + TILE * 0.45 && Math.abs(shortAngle(targetAngle - angleTo(p, c))) < 0.8) {
        rt.hp -= damage;
        burst(c.x, c.y, "#d89a54", 8);
        if (rt.hp <= 0) {
          breakRaftTile(rt);
          toast("Raft tile chopped apart.");
        } else {
          toast("Raft tile damaged.");
        }
        gainXp(1);
        return true;
      }
    }
    return damageRemotePlacedItem(reach, targetAngle, damage);
  }

  function remoteTileCenter(world, rt) {
    const r = remoteRaftTileRect(world, rt);
    return { x: r.x + TILE / 2, y: r.y + TILE / 2 };
  }

  function removeRemoteStructureLocal(world, st) {
    world.structures = (world.structures || []).filter((item) => item !== st);
    if (activeCannon === st) activeCannon = null;
  }

  function removeRemoteRaftTileLocal(world, rt) {
    const r = remoteRaftTileRect(world, rt);
    const doomed = (world.structures || []).filter((st) => st.base === "raft" && st.x > r.x && st.x < r.x + r.w && st.y > r.y && st.y < r.y + r.h);
    world.structures = (world.structures || []).filter((st) => !doomed.includes(st));
    world.raft = (world.raft || []).filter((tile) => tile !== rt);
    if (doomed.includes(activeCannon)) activeCannon = null;
  }

  function damageRemotePlacedItem(reach, targetAngle, damage) {
    const p = state.player;
    let best = null;
    let bestD = Infinity;
    for (const [ownerId, world] of remoteWorlds) {
      for (const st of world.structures || []) {
        if (!st || st.hp <= 0) continue;
        const d = dist(p, st);
        if (d < reach + footprintRadius(st.type) && Math.abs(shortAngle(targetAngle - angleTo(p, st))) < 0.95 && d < bestD) {
          best = { kind: "structure", ownerId, world, target: st };
          bestD = d;
        }
      }
      for (const rt of world.raft || []) {
        const c = remoteTileCenter(world, rt);
        const d = dist(p, c);
        if (d < reach + TILE * 0.45 && Math.abs(shortAngle(targetAngle - angleTo(p, c))) < 0.8 && d < bestD) {
          best = { kind: "tile", ownerId, world, target: rt, center: c };
          bestD = d;
        }
      }
    }
    if (!best) return false;
    if (best.kind === "structure") {
      const st = best.target;
      st.hp -= damage;
      queueWorldCommand(best.ownerId, { type: "damageStructure", structureId: st.id, damage });
      burst(st.x, st.y, "#ffb08a", 8);
      if (st.hp <= 0) removeRemoteStructureLocal(best.world, st);
      toast(`${label(st.type)} damaged.`);
    } else {
      const rt = best.target;
      rt.hp -= damage;
      queueWorldCommand(best.ownerId, { type: "damageRaftTile", gx: rt.gx, gy: rt.gy, damage });
      burst(best.center.x, best.center.y, "#d89a54", 8);
      if (rt.hp <= 0) removeRemoteRaftTileLocal(best.world, rt);
      toast("Enemy raft tile damaged.");
    }
    gainXp(2);
    return true;
  }

  function shortAngle(a) {
    return Math.atan2(Math.sin(a), Math.cos(a));
  }

  function nearestShark(p, maxDist = Infinity) {
    let best = null;
    let bestD = maxDist;
    for (const shark of state.sharks) {
      const d = dist(p, shark);
      if (d < bestD) {
        best = shark;
        bestD = d;
      }
    }
    return best;
  }

  function respawnShark(shark) {
    const aggressive = Math.random() < SHARK_AGGRESSION_CHANCE;
    const p = randomOceanPoint(aggressive ? 380 : 700, state.player, state.islands);
    shark.x = p.x;
    shark.y = p.y;
    shark.hp = SHARK_HP;
    shark.bite = 0;
    shark.flee = 0;
    shark.aggressive = aggressive;
    shark.aggro = shark.aggressive ? 99 : 0;
    shark.wander = rnd(0, TAU);
  }

  function killAnimal(a) {
    a.dead = true;
    const drops = a.type === "crab" ? 1 : a.type === "pig" ? 2 : 4;
    addRes("meat", drops);
    if (a.type !== "crab") addRes("scrap", 1);
    if (a.homeIsland && a.type === "crab") state.animalRespawns.push({ type: a.type, island: a.homeIsland, time: rnd(300, 480) });
    if (a.homeIsland && a.type === "crocodile") state.animalRespawns.push({ type: a.type, island: a.homeIsland, time: rnd(45, 75) });
    gainXp(a.xp);
    burst(a.x, a.y, "#ff8f75", 16);
    toast(`${cap(a.type)} hunted. Raw meat added.`);
  }

  function chopTree(reach, targetAngle, damage) {
    const p = state.player;
    for (const island of state.islands) {
      for (const tree of island.trees) {
        if (tree.dead) continue;
        if (dist(p, tree) < reach + 20 && Math.abs(shortAngle(targetAngle - angleTo(p, tree))) < 0.85) {
          tree.hp -= damage;
          burst(tree.x, tree.y, "#75ca57", 8);
          if (tree.hp <= 0) {
            tree.dead = true;
            tree.respawn = rnd(360, 600);
            addRes("wood", 5);
            addRes("leaves", 4);
            addRes("coconut", 2);
            gainXp(8);
            toast("Coconut palm chopped. Wood and coconuts collected.");
          }
          return;
        }
      }
    }
  }

  function repairTile(reach, power = 1) {
    const p = state.player;
    let closestStructure = null;
    let closestStructureD = Infinity;
    for (const st of state.structures) {
      const d = dist(p, st);
      if (d < reach && d < closestStructureD && st.hp < st.maxHp) {
        closestStructure = st;
        closestStructureD = d;
      }
    }
    if (closestStructure) {
      if (state.resources.wood < 2) return toast("Need 2 wood to repair.");
      state.resources.wood -= 2;
      closestStructure.hp = clamp(closestStructure.hp + Math.round(35 * power), 0, closestStructure.maxHp);
      return toast(`${label(closestStructure.type)} repaired.`);
    }

    let best = null;
    let bestD = Infinity;
    for (const rt of state.raft) {
      const r = raftTileRect(rt);
      const c = { x: r.x + TILE / 2, y: r.y + TILE / 2 };
      const d = dist(p, c);
      if (d < reach && d < bestD) {
        best = rt;
        bestD = d;
      }
    }
    if (!best) return;
    if (state.resources.wood < 2) return toast("Need 2 wood to repair.");
    state.resources.wood -= 2;
    best.hp = clamp(best.hp + Math.round(30 * power), 0, best.maxHp);
    toast("Raft tile repaired.");
  }

  function interact() {
    if (!gameStarted) return;
    if (!state.player.alive) return;
    if (!spendStamina(2)) return;
    const p = state.player;
    for (const d of state.debris) {
      if (dist(p, d) < 84) {
        collectDebris(d);
        return;
      }
    }
    for (const island of state.islands) {
      for (const loot of island.loot) {
        if (!loot.dead && dist(p, loot) < 46) {
          loot.dead = true;
          if (loot.type === "tomato") loot.respawn = 300;
          addRes(loot.type, loot.type === "tomato" ? 2 : 1);
          gainXp(3);
          toast(`Picked up ${loot.type}.`);
          return;
        }
      }
      const wreck = island.shipwreck;
      if (wreck && dist(p, wreck) < SHIPWRECK_INTERACT_RADIUS) {
        for (const loot of wreck.loot) {
          if (!loot.dead && dist(p, loot) < 42) {
            loot.dead = true;
            addRes(loot.type, loot.qty || 1);
            gainXp(5);
            toast(`Shipwreck loot: ${loot.qty || 1} ${label(loot.type).toLowerCase()}.`);
            return;
          }
        }
      }
    }
    for (const st of state.structures) {
      if (dist(p, st) < 56) {
        operateStructure(st);
        return;
      }
    }
    const remoteStructure = nearestRemoteStructure(p, 56);
    if (remoteStructure) {
      operateStructure(remoteStructure.structure);
      return;
    }
    toast("Nothing close enough to interact with.");
  }

  function operateStructure(st) {
    if (st.type === "cannon") {
      activeCannon = activeCannon === st ? null : st;
      return toast(activeCannon ? "Cannon ready. A/D traverse, click to fire." : "Cannon released.");
    }
    if (st.type === "grill") {
      if (st.ready) {
        st.ready = false;
        addRes(st.cooking === "rawFish" ? "cookedFish" : "cookedMeat", 1);
        st.cooking = null;
        gainXp(5);
        syncRemoteStructure(st);
        return toast("Collected cooked food.");
      }
      const cookable = state.resources.rawFish > 0 ? "rawFish" : state.resources.sharkMeat > 0 ? "sharkMeat" : state.resources.meat > 0 ? "meat" : null;
      if (st.timer <= 0 && cookable) {
        if (FOOD_ITEMS.includes(cookable)) removePlayerItem(cookable, 1);
        else state.resources[cookable]--;
        st.cooking = cookable;
        st.timer = GRILL_TIME;
        st.maxTimer = GRILL_TIME;
        st.ready = false;
        renderHotbar();
        syncRemoteStructure(st);
        return toast(`${label(cookable)} is cooking.`);
      }
      return toast("Need raw fish or raw meat for the grill.");
    }
    if (st.type === "waterMaker") {
      if (st.ready) {
        let returned = false;
        if (HOTBAR_SWAP_SLOTS.includes(selected) && hotbar[selected].id === "empty") {
          returned = setHotbarItem(selected, slot("waterFlask", 1));
          syncManagedCountsFromSlots();
        } else {
          returned = addPlayerItem("waterFlask", 1, "hotbar");
        }
        if (!returned) {
          st.ready = true;
          st.hasGlass = true;
          return toast("Need room for the filled flask.");
        }
        st.ready = false;
        st.hasGlass = false;
        gainXp(4);
        renderHotbar();
        syncRemoteStructure(st);
        return toast("Filled water flask returned.");
      }
      if (hotbar[selected]?.id !== "flask") return toast("Select the water flask to use the water maker.");
      if (st.timer <= 0 && getSlot({ area: "hotbar", index: selected })?.id === "flask") {
        removePlayerItem("flask", 1, { area: "hotbar", index: selected });
        st.hasGlass = true;
        st.timer = WATER_TIME;
        st.maxTimer = WATER_TIME;
        st.ready = false;
        renderHotbar();
        syncRemoteStructure(st);
        return toast("Water maker is filling your flask.");
      }
      return toast("Need an empty water flask.");
    }
    if (st.type === "plantPot") {
      if (st.ready) {
        st.ready = false;
        st.planted = false;
        addRes("tomato", 2);
        gainXp(5);
        syncRemoteStructure(st);
        return toast("Tomatoes harvested.");
      }
      if (st.timer <= 0 && managedItemCount("tomato") > 0) {
        removePlayerItem("tomato", 1);
        st.planted = true;
        st.ready = false;
        st.timer = TOMATO_GROW_TIME;
        st.maxTimer = TOMATO_GROW_TIME;
        syncRemoteStructure(st);
        return toast("Tomato planted.");
      }
      if (st.timer > 0) return toast("Tomatoes are still growing.");
      return toast("Need a tomato to plant.");
    }
    if (st.type === "chest") {
      openInventory(st);
      return toast("Chest opened.");
    }
  }

  function structureServerPatch(st) {
    return {
      timer: st.timer || 0,
      maxTimer: st.maxTimer || 0,
      ready: Boolean(st.ready),
      hasGlass: Boolean(st.hasGlass),
      planted: Boolean(st.planted),
      cooking: st.cooking || null,
      aimOffset: st.aimOffset || 0,
      cooldown: st.cooldown || 0,
      storage: st.type === "chest" ? chestSlots(st) : null
    };
  }

  function syncRemoteStructure(st) {
    if (!st?.remoteOwnerId || !st.id) return;
    queueWorldCommand(st.remoteOwnerId, { type: "patchStructure", structureId: st.id, patch: structureServerPatch(st) });
  }

  function craft(name, holdAfterCraft = false) {
    if (!gameStarted) return false;
    if (!spendStamina(3)) return false;
    const recipe = recipes[name];
    if (!recipe) return false;
    if (!recipeVisible(name)) {
      toast("Craft the previous tier first.");
      return false;
    }
    if ((name === "bandage" || isBuildRecipe(name)) && !playerHasInventorySpaceFor(name)) {
      toast("Backpack is full.");
      return false;
    }
    if (isHotbarCraftRecipe(name) && !playerHasItemSpaceFor(name)) {
      toast("Backpack and hotbar are full.");
      return false;
    }
    if (!devMode) {
      for (const [res, qty] of Object.entries(recipe)) {
        if ((state.resources[res] || 0) < qty) {
          toast(`Need ${qty} ${res}.`);
          return false;
        }
      }
      for (const [res, qty] of Object.entries(recipe)) state.resources[res] -= qty;
    }
    if (name === "bandage") {
      if (!addPlayerItem("bandage", 1)) return toast("Backpack is full.");
      toast("Bandage crafted.");
    } else if (isHotbarCraftRecipe(name)) {
      if (!addPlayerItem(name, 1, "hotbar")) return toast("Backpack and hotbar are full.");
      markToolUnlocked(name);
      putItemInHotbar(name, true);
      buildMode = false;
      heldItem = name;
      toast(`${label(name)} crafted.`);
    } else {
      if (!addPlayerItem(name, 1)) return toast("Backpack is full.");
      buildChoice = name;
      buildMode = true;
      heldItem = name;
      renderHotbar();
      toast(`${label(name)} ready to place.`);
    }
    if (name === "bandage" && holdAfterCraft) selectHeldTool("bandage");
    gainXp(7);
    renderHotbar();
    renderRecipes();
    return true;
  }

  function placeBuild() {
    updateMouseWorld();
    if (!isBuildRecipe(buildChoice)) {
      if (isCraftOnlyRecipe(buildChoice)) {
        craft(buildChoice, false);
        return;
      }
      return toast(`${label(buildChoice)} cannot be placed.`);
    }
    if (!spendStamina(6)) return;
    if (!buildMode) buildMode = true;
    const spot = buildPlacementPoint();
    const craftedNow = ensureBuildReady(buildChoice);
    if (!craftedNow) return;
    if (buildChoice === "raft") {
      if (state.raft.length === 0) {
        if (isOnIsland(spot)) return toast("Start a new raft in open water.");
        state.raftOffset.x = spot.x - TILE / 2;
        state.raftOffset.y = spot.y - TILE / 2;
        state.raft.push(tile(0, 0, "deck"));
        consumeBuild(buildChoice);
        toast("New raft started.");
        gainXp(6);
        return;
      }
      const gx = Math.round((spot.x - state.raftOffset.x - TILE / 2) / TILE);
      const gy = Math.round((spot.y - state.raftOffset.y - TILE / 2) / TILE);
      if (state.raft.some((rt) => rt.gx === gx && rt.gy === gy)) return toast("That raft tile already exists.");
      const adjacent = state.raft.some((rt) => Math.abs(rt.gx - gx) + Math.abs(rt.gy - gy) === 1);
      if (!adjacent) return toast("New raft tiles must touch your raft.");
      state.raft.push(tile(gx, gy, "deck"));
      consumeBuild(buildChoice);
      toast("Raft expanded.");
      gainXp(6);
      return;
    }
    const site = buildSiteAt(spot.x, spot.y);
    if (!site) return toast("Place blocks fully on your raft or on island ground.");
    const angle = state.player.facing + buildAngle;
    const candidate = createStructure(buildChoice, spot.x, spot.y, angle, site.kind);
    if (state.structures.some((s) => placementFootprintsOverlap(candidate, s))) return toast("That spot is occupied.");
    state.structures.push(candidate);
    consumeBuild(buildChoice);
    toast(`${label(buildChoice)} placed.`);
    gainXp(8);
  }

  function ensureBuildReady(name) {
    if (managedItemCount(name) > 0) return true;
    if (!playerHasInventorySpaceFor(name)) {
      toast("Backpack is full.");
      return false;
    }
    if (!canAfford(name)) {
      toast(`${label(name)} selected. Need ${recipeText(name)} to craft it.`);
      return false;
    }
    if (!devMode) for (const [res, qty] of Object.entries(recipes[name])) state.resources[res] -= qty;
    if (!addPlayerItem(name, 1)) return false;
    gainXp(7);
    renderHotbar();
    renderRecipes();
    return true;
  }

  function buildPlacementPoint() {
    const p = state.player;
    const reach = buildChoice === "raft" ? TILE * 0.88 : 54;
    return {
      x: p.x + Math.cos(p.facing) * reach,
      y: p.y + Math.sin(p.facing) * reach
    };
  }

  function createStructure(type, x, y, angle = 0, base = "raft") {
    const maxHp = blockHp[type] || 80;
    return { type, x, y, angle, base, hp: maxHp, maxHp, timer: 0, maxTimer: 0, ready: false, hasGlass: false, planted: false, aimOffset: 0, cooldown: 0, storage: type === "chest" ? emptySlots(CHEST_INV_CAP) : null };
  }

  function footprint(type) {
    return blockFootprints[type] || { w: STRUCTURE_RADIUS * 2, h: STRUCTURE_RADIUS * 2 };
  }

  function placementFootprint(type) {
    const f = footprint(type);
    return { w: f.w * PLACEMENT_FOOTPRINT_SCALE, h: f.h * PLACEMENT_FOOTPRINT_SCALE };
  }

  function footprintRadius(type) {
    const f = footprint(type);
    return Math.hypot(f.w, f.h) / 2;
  }

  function placementFootprintRadius(type) {
    const f = placementFootprint(type);
    return Math.hypot(f.w, f.h) / 2;
  }

  function footprintsOverlap(a, b) {
    const aCorners = footprintCorners(a);
    const bCorners = footprintCorners(b);
    const axes = [...rectAxes(aCorners), ...rectAxes(bCorners)];
    return axes.every((axis) => projectionsOverlap(projectCorners(aCorners, axis), projectCorners(bCorners, axis)));
  }

  function placementFootprintsOverlap(a, b) {
    const aCorners = footprintCorners(a, placementFootprint);
    const bCorners = footprintCorners(b, placementFootprint);
    const axes = [...rectAxes(aCorners), ...rectAxes(bCorners)];
    return axes.every((axis) => projectionsOverlap(projectCorners(aCorners, axis), projectCorners(bCorners, axis)));
  }

  function footprintCorners(obj, footprintFn = footprint) {
    const f = footprintFn(obj.type);
    const hw = f.w / 2;
    const hh = f.h / 2;
    const angle = obj.angle || 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ].map((p) => ({
      x: obj.x + p.x * cos - p.y * sin,
      y: obj.y + p.x * sin + p.y * cos
    }));
  }

  function rectAxes(corners) {
    const axes = [];
    for (let i = 0; i < 2; i++) {
      const p1 = corners[i];
      const p2 = corners[(i + 1) % corners.length];
      const ex = p2.x - p1.x;
      const ey = p2.y - p1.y;
      const len = Math.hypot(ex, ey) || 1;
      axes.push({ x: -ey / len, y: ex / len });
    }
    return axes;
  }

  function projectCorners(corners, axis) {
    let min = Infinity;
    let max = -Infinity;
    for (const p of corners) {
      const v = p.x * axis.x + p.y * axis.y;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    return { min, max };
  }

  function projectionsOverlap(a, b) {
    return a.max >= b.min && b.max >= a.min;
  }

  function solidWalls() {
    return state.structures.filter((st) => st.type === "wall");
  }

  function resolveWallCollision(entity, radius) {
    for (const wall of solidWalls()) {
      const f = footprint("wall");
      const cos = Math.cos(-(wall.angle || 0));
      const sin = Math.sin(-(wall.angle || 0));
      const dx = entity.x - wall.x;
      const dy = entity.y - wall.y;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const hx = f.w / 2;
      const hy = f.h / 2;
      const closestX = clamp(lx, -hx, hx);
      const closestY = clamp(ly, -hy, hy);
      const diffX = lx - closestX;
      const diffY = ly - closestY;
      let d = Math.hypot(diffX, diffY);
      if (d > 0 && d < radius) {
        const push = radius - d;
        const nx = diffX / d;
        const ny = diffY / d;
        const wx = nx * Math.cos(wall.angle || 0) - ny * Math.sin(wall.angle || 0);
        const wy = nx * Math.sin(wall.angle || 0) + ny * Math.cos(wall.angle || 0);
        entity.x += wx * push;
        entity.y += wy * push;
      } else if (d === 0 && Math.abs(lx) <= hx && Math.abs(ly) <= hy) {
        const pushX = hx - Math.abs(lx);
        const pushY = hy - Math.abs(ly);
        const localNx = pushX < pushY ? (lx < 0 ? -1 : 1) : 0;
        const localNy = pushX < pushY ? 0 : ly < 0 ? -1 : 1;
        const wx = localNx * Math.cos(wall.angle || 0) - localNy * Math.sin(wall.angle || 0);
        const wy = localNx * Math.sin(wall.angle || 0) + localNy * Math.cos(wall.angle || 0);
        entity.x += wx * (Math.min(pushX, pushY) + radius);
        entity.y += wy * (Math.min(pushX, pushY) + radius);
      }
    }
  }

  function hitsWall(p, radius) {
    const test = { x: p.x, y: p.y };
    resolveWallCollision(test, radius);
    return Math.hypot(test.x - p.x, test.y - p.y) > 0.1;
  }

  function consumeBuild(name) {
    removePlayerItem(name, 1, HOTBAR_SWAP_SLOTS.includes(selected) ? { area: "hotbar", index: selected } : null);
    if (!managedItemCount(name)) {
      const next = Object.keys(pendingBuild).find((key) => pendingBuild[key] > 0);
      if (next) buildChoice = next;
      else buildMode = false;
    }
    renderRecipes();
    renderHotbar();
  }

  function rotateBuild() {
    if (!gameStarted || !spendStamina(1)) return;
    buildAngle = (buildAngle + Math.PI / 12) % TAU;
    buildMode = true;
    renderHotbar();
    toast(`Build angle: ${Math.round((buildAngle * 180) / Math.PI)} degrees.`);
  }

  function cycleBuildChoice() {
    if (!gameStarted || !spendStamina(1)) return;
    const choices = craftCycleChoices();
    const current = choices.includes(buildChoice) ? choices.indexOf(buildChoice) : -1;
    buildChoice = choices[(current + 1) % choices.length];
    buildMode = true;
    heldItem = buildChoice;
    renderHotbar();
    renderRecipes();
    toast(`Build selection: ${label(buildChoice)} (${pendingBuild[buildChoice] || 0} ready).`);
  }

  function cycleFoodChoice() {
    if (!gameStarted || !spendStamina(1)) return;
    const foods = availableFoods();
    if (!foods.length) return toast("No food to select.");
    const current = selectedFood && foods.includes(selectedFood) ? foods.indexOf(selectedFood) : -1;
    selectedFood = foods[(current + 1) % foods.length];
    putItemInHotbar(selectedFood, true);
    toast(`Food selected: ${label(selectedFood)}.`);
  }

  function buildSiteAt(x, y) {
    const radius = placementFootprintRadius(buildChoice);
    const rt = raftAt(x, y);
    if (rt) {
      const r = raftTileRect(rt);
      const raftPadding = Math.max(6, radius * 0.45);
      const fits = x > r.x + raftPadding && x < r.x + TILE - raftPadding && y > r.y + raftPadding && y < r.y + TILE - raftPadding;
      return fits ? { kind: "raft", tile: rt } : null;
    }
    const island = state.islands.find((item) => Math.hypot(x - item.x, y - item.y) <= item.r + 4 - radius * 0.15);
    if (island) return { kind: "island", island };
    return null;
  }

  function raftAt(x, y) {
    return state.raft.find((rt) => {
      const r = raftTileRect(rt);
      return x > r.x && x < r.x + TILE && y > r.y && y < r.y + TILE;
    });
  }

  function useBandage() {
    if (!spendStamina(4)) return;
    if (managedItemCount("bandage") <= 0) return toast("No bandages.");
    removePlayerItem("bandage", 1, HOTBAR_SWAP_SLOTS.includes(selected) ? { area: "hotbar", index: selected } : null);
    state.player.health = clamp(state.player.health + 35, 0, 100);
    renderHotbar();
    toast("Bandage used.");
  }

  function eatFood() {
    if (!spendStamina(2)) return;
    const foods = selectedFood && managedItemCount(selectedFood) > 0 ? [selectedFood] : availableFoods();
    for (const food of foods) {
      if (eatSpecificFood(food)) return;
    }
    toast("No food.");
  }

  function eatSpecificFood(food) {
    if (!["cookedFish", "cookedMeat", "rawFish", "tomato", "coconut"].includes(food)) return false;
    if (managedItemCount(food) <= 0) return false;
    removePlayerItem(food, 1, HOTBAR_SWAP_SLOTS.includes(selected) ? { area: "hotbar", index: selected } : null);
    if (food === "cookedFish") {
      state.player.hunger = clamp(state.player.hunger + 42, 0, 100);
      recoverStamina(22);
      toast("Ate cooked fish.");
    } else if (food === "cookedMeat") {
      state.player.hunger = clamp(state.player.hunger + 40, 0, 100);
      state.player.thirst = clamp(state.player.thirst + 3, 0, 100);
      recoverStamina(17);
      toast("Ate cooked meat.");
    } else if (food === "rawFish") {
      state.player.hunger = clamp(state.player.hunger + 18, 0, 100);
      state.player.thirst = clamp(state.player.thirst - 5, 0, 100);
      recoverStamina(7);
      toast("Ate raw fish. Not glamorous.");
    } else if (food === "tomato") {
      state.player.hunger = clamp(state.player.hunger + 16, 0, 100);
      state.player.thirst = clamp(state.player.thirst + 8, 0, 100);
      recoverStamina(9);
      toast("Ate tomatoes.");
    } else if (food === "coconut") {
      state.player.hunger = clamp(state.player.hunger + 8, 0, 100);
      state.player.thirst = clamp(state.player.thirst + 15, 0, 100);
      recoverStamina(8);
      toast("Coconut cracked open.");
    }
    if (managedItemCount(food) <= 0 && selectedFood === food) {
      selectedFood = null;
      heldItem = null;
    }
    renderHotbar();
    return true;
  }

  function drinkWater() {
    if (!spendStamina(2)) return;
    if (hotbar[selected]?.id === "waterFlask") {
      removePlayerItem("waterFlask", 1, { area: "hotbar", index: selected });
      if (hotbar[selected]?.id === "empty") setHotbarItem(selected, slot("flask", 1));
      else addPlayerItem("flask", 1, "hotbar");
      state.player.thirst = clamp(state.player.thirst + 34, 0, 100);
      recoverStamina(6);
      renderHotbar();
      return toast("Drank clean water. Flask is empty.");
    }
    const wm = state.structures.find((s) => s.type === "waterMaker" && dist(s, state.player) < 64);
    if (wm) return operateStructure(wm);
    toast("Fill the empty flask at a water maker.");
  }

  function train(stat) {
    if (!gameStarted) return;
    if (!spendStamina(1)) return;
    const p = state.player;
    if (p.points <= 0) return toast("Level up for stat points.");
    p.points--;
    p[stat]++;
    toast(`${cap(stat)} increased.`);
  }

  function gainXp(amount) {
    const p = state.player;
    p.totalXp = (p.totalXp || 0) + amount;
    const oldLevel = p.level;
    p.level = levelFromXp(p.totalXp);
    const currentBase = xpForLevel(p.level);
    const nextBase = xpForLevel(p.level + 1);
    p.xp = p.totalXp - currentBase;
    if (p.level > oldLevel) {
      p.points += p.level - oldLevel;
      p.health = clamp(p.health + 12, 0, 100);
      toast(`Level ${p.level}. Spend a stat point.`);
    }
  }

  function xpForLevel(level) {
    return Math.floor((level - 1) * (level - 1) * 85);
  }

  function levelFromXp(xp) {
    return Math.max(1, Math.floor(Math.sqrt(xp / 85)) + 1);
  }

  function hurt(amount, reason) {
    const p = state.player;
    if (devMode) {
      p.health = 100;
      p.hunger = 100;
      p.thirst = 100;
      return;
    }
    if (p.invuln > 0 && amount > 1) return;
    p.health -= amount;
    if (amount > 1) {
      p.invuln = 0.45;
      toast(reason);
    }
    if (p.health <= 0) {
      p.health = 0;
      p.alive = false;
      gameStarted = false;
      publishLocalPeer("leave");
      fallenNameEl.textContent = p.name || playerName;
      document.getElementById("survived").textContent = state.day;
      gameOverEl.hidden = false;
    }
  }

  function addRes(name, qty) {
    if (name === "bandage" || FOOD_ITEMS.includes(name)) {
      if (!addPlayerItem(name, qty)) toast("Backpack is full.");
      renderHotbar();
      renderRecipes();
      return;
    }
    state.resources[name] = (state.resources[name] || 0) + qty;
    renderHotbar();
    renderRecipes();
  }

  function nearestIsland(p) {
    let best = null;
    let bestD = Infinity;
    for (const island of state.islands) {
      const d = dist(p, island);
      if (d < bestD) {
        bestD = d;
        best = island;
      }
    }
    return best;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, TAU);
      state.particles.push({ x, y, vx: Math.cos(a) * rnd(18, 90), vy: Math.sin(a) * rnd(18, 90), color, life: rnd(0.25, 0.7), size: rnd(2, 5) });
    }
  }

  function updateHud() {
    const p = state.player;
    renderHotbar();
    renderRecipes();
    setMeter("health", p.health);
    setMeter("hunger", p.hunger);
    setMeter("thirst", p.thirst);
    setMeter("stamina", p.stamina);
    setMeter("breath", 100 - ((p.swimTime || 0) / DROWN_TIME) * 100);
    const currentBase = xpForLevel(p.level);
    const nextBase = xpForLevel(p.level + 1);
    setMeter("xp", ((p.totalXp - currentBase) / (nextBase - currentBase)) * 100);
    for (const key of ["wood", "leaves", "scrap", "iron", "steel", "cloth", "rope", "glass", "rawFish", "cookedFish", "sharkMeat", "meat", "cookedMeat", "coconut", "tomato"]) {
      document.querySelector(`[data-res="${key}"]`).textContent = `${cap(key)} ${state.resources[key] || 0}`;
    }
    document.getElementById("level").textContent = p.level;
    document.getElementById("speed").textContent = p.speed;
    document.getElementById("agility").textContent = p.agility;
    document.getElementById("strength").textContent = p.strength;
    document.getElementById("points").textContent = p.points;

    const prompt = currentPrompt();
    promptEl.textContent = prompt;
    promptEl.classList.toggle("show", Boolean(prompt));
  }

  function currentPrompt() {
    if (activeCannon) return `Cannon armed. A/D aim ${Math.round(((activeCannon.aimOffset || 0) * 180) / Math.PI)} degrees, click to fire.`;
    if (buildMode) {
      if (!isBuildRecipe(buildChoice)) return `Craft: ${label(buildChoice)}. Click to craft if you have ${recipeText(buildChoice)}. N next.`;
      const ready = pendingBuild[buildChoice] || 0;
      return ready > 0 ? `Build: ${label(buildChoice)} (${ready}). Click to place, R rotate, N next.` : `Build: ${label(buildChoice)}. Click to craft/place if you have ${recipeText(buildChoice)}.`;
    }
    const p = state.player;
    const st = state.structures.find((s) => dist(s, p) < 56);
    if (st) return `F: use ${label(st.type)}`;
    const remoteSt = nearestRemoteStructure(p, 56);
    if (remoteSt) return `F: use ${label(remoteSt.structure.type)}`;
    const nearLoot = state.debris.some((d) => dist(d, p) < 84) || state.islands.some((is) => is.loot.some((l) => !l.dead && dist(l, p) < 46));
    if (nearLoot) return "F: pick up";
    if (!isOnRaft(p) && !isOnIsland(p)) {
      return p.swimTime >= DROWN_TIME ? "You are drowning. Reach land or your raft." : "Swimming is slow and drains breath.";
    }
    return "";
  }

  function setMeter(cls, value) {
    document.querySelector(`.${cls} b`).style.width = `${clamp(value, 0, 100)}%`;
  }

  function draw() {
    const w = innerWidth;
    const h = innerHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 - state.camera.x, h / 2 - state.camera.y);
    drawOcean();
    drawIslands();
    drawDebris();
    drawShark();
    drawRemoteRafts();
    drawRaft();
    drawStructures();
    drawCast();
    drawAnimals();
    drawProjectiles();
    drawRemotePlayers();
    drawPlayer();
    drawParticles();
    if (buildMode && isBuildRecipe(buildChoice)) drawBuildGhost();
    ctx.restore();
    drawVignette(w, h);
    drawMinimap();
  }

  function drawOcean() {
    ctx.fillStyle = "#0a7896";
    ctx.fillRect(0, 0, WORLD, WORLD);
    ctx.strokeStyle = "rgba(199,245,255,0.16)";
    ctx.lineWidth = 2;
    const step = 95;
    for (let y = -step; y < WORLD + step; y += step) {
      ctx.beginPath();
      for (let x = -20; x < WORLD + 40; x += 36) {
        const yy = y + Math.sin(x * 0.016 + waveTime * 1.8 + y * 0.005) * 10;
        if (x === -20) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    for (let y = 35; y < WORLD; y += 180) {
      ctx.beginPath();
      for (let x = 0; x < WORLD; x += 46) {
        const yy = y + Math.cos(x * 0.03 + waveTime * 2.6) * 5;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  function drawIslands() {
    for (const island of state.islands) {
      const g = ctx.createRadialGradient(island.x - island.r * 0.25, island.y - island.r * 0.25, island.r * 0.2, island.x, island.y, island.r);
      g.addColorStop(0, "#e0c47d");
      g.addColorStop(0.64, "#caa766");
      g.addColorStop(1, "#8bbf73");
      ctx.fillStyle = g;
      blob(island.x, island.y, island.r, 18, 0.12);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 8;
      ctx.stroke();

      for (const b of island.bushes) {
        ctx.fillStyle = "#3f9c56";
        circle(b.x, b.y, 13);
        ctx.fillStyle = "#5abc62";
        circle(b.x - 4, b.y - 3, 8);
      }
      for (const l of island.loot) {
        if (l.dead) continue;
        ctx.fillStyle = l.type === "tomato" ? "#d94b45" : "#d7d6c9";
        roundRect(l.x - 8, l.y - 8, 16, 16, 4);
        ctx.fill();
      }
      for (const tr of island.trees) {
        if (tr.dead) continue;
        ctx.save();
        ctx.translate(tr.x, tr.y);
        ctx.rotate(Math.sin(tr.x * 0.01) * 0.12);
        ctx.fillStyle = "#8b5f3d";
        roundRect(-5, -2, 10, 36, 5);
        ctx.fill();
        ctx.strokeStyle = "rgba(61,38,25,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, 5);
        ctx.lineTo(4, 28);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((i / 6) * TAU + 0.25);
          ctx.fillStyle = i % 2 ? "#3f9c56" : "#2f8144";
          ellipse(17, -18, 27, 7, 0);
          ctx.restore();
        }
        ctx.fillStyle = "#82522e";
        circle(-5, -9, 5);
        circle(3, -7, 5);
        circle(8, -12, 4);
        ctx.restore();
      }
      if (island.shipwreck) drawShipwreck(island.shipwreck);
    }
  }

  function drawShipwreck(wreck) {
    ctx.save();
    ctx.translate(wreck.x, wreck.y);
    ctx.rotate(wreck.angle);
    ctx.scale(SHIPWRECK_SCALE, SHIPWRECK_SCALE);
    ctx.fillStyle = "#6f482d";
    roundRect(-112, -42, 224, 84, 28);
    ctx.fill();
    ctx.fillStyle = "#8d613b";
    roundRect(-96, -29, 156, 58, 18);
    ctx.fill();
    ctx.fillStyle = "#34251d";
    roundRect(-78, -24, 92, 48, 12);
    ctx.fill();
    ctx.fillStyle = "#c49a5c";
    ctx.fillRect(-100, -16, 183, 6);
    ctx.fillRect(-94, 13, 172, 6);
    ctx.fillStyle = "#15191c";
    ctx.beginPath();
    ctx.moveTo(52, -43);
    ctx.lineTo(118, -24);
    ctx.lineTo(118, 24);
    ctx.lineTo(52, 43);
    ctx.lineTo(74, 14);
    ctx.lineTo(74, -14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3c2a1f";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-60, -39);
    ctx.lineTo(-44, -95);
    ctx.moveTo(-44, -95);
    ctx.lineTo(7, -61);
    ctx.moveTo(-24, 39);
    ctx.lineTo(-8, 85);
    ctx.stroke();
    ctx.restore();

    for (const loot of wreck.loot) {
      if (loot.dead) continue;
      if (loot.type === "scrap" || loot.type === "iron" || loot.type === "steel") {
        const colors = {
          scrap: ["#879aa1", "#c9d8dc"],
          iron: ["#b4bdc2", "#eef4f5"],
          steel: ["#6f858e", "#e8fbff"]
        }[loot.type];
        drawScrapModel(loot.x, loot.y, 0.95, colors[0], colors[1]);
      } else if (loot.type === "glass") {
        drawGlassModel(loot.x, loot.y, 0.95);
      } else if (loot.type === "rope") {
        ctx.fillStyle = "#d0ad62";
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(loot.x, loot.y, 8, 0, TAU);
        ctx.stroke();
      } else {
        roundRect(loot.x - 8, loot.y - 7, 16, 14, 4);
        ctx.fill();
      }
    }
  }

  function drawScrapModel(x = 0, y = 0, scale = 1, primary = "#879aa1", highlight = "#c9d8dc") {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(-13, -8);
    ctx.lineTo(5, -12);
    ctx.lineTo(15, -2);
    ctx.lineTo(8, 10);
    ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(8, -8);
    ctx.lineTo(11, -2);
    ctx.lineTo(-2, 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#52646b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 5);
    ctx.lineTo(8, -7);
    ctx.moveTo(-5, -8);
    ctx.lineTo(9, 9);
    ctx.stroke();
    ctx.fillStyle = "#415159";
    circle(-7, 1, 2);
    circle(7, 3, 2);
    ctx.restore();
  }

  function drawGlassModel(x = 0, y = 0, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(142, 233, 255, 0.72)";
    ctx.strokeStyle = "rgba(224, 252, 255, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -13);
    ctx.lineTo(11, -6);
    ctx.lineTo(5, 13);
    ctx.lineTo(-13, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(3, 9);
    ctx.moveTo(2, -5);
    ctx.lineTo(9, -2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ellipse(-3, -5, 4, 2, -0.5);
    ctx.restore();
  }

  function drawFlaskModel(x = 0, y = 0, scale = 1, filled = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(214, 248, 255, 0.78)";
    ctx.strokeStyle = "#e9fbff";
    ctx.lineWidth = 2;
    roundRect(-5, -17, 10, 8, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -9);
    ctx.lineTo(10, -9);
    ctx.lineTo(15, 13);
    ctx.quadraticCurveTo(0, 22, -15, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (filled) {
      ctx.fillStyle = "rgba(82, 196, 236, 0.82)";
      ctx.beginPath();
      ctx.moveTo(-10, 2);
      ctx.lineTo(12, 2);
      ctx.lineTo(15, 13);
      ctx.quadraticCurveTo(0, 20, -15, 13);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
    ellipse(-5, -1, 4, 8, -0.25);
    ctx.fillStyle = "#8f6a3a";
    roundRect(-6, -23, 12, 6, 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDebris() {
    for (const d of state.debris) {
      const y = d.y + Math.sin(d.bob) * 3;
      ctx.save();
      ctx.translate(d.x, y);
      ctx.rotate(Math.sin(d.bob * 0.7) * 0.12);
      if (d.type === "barrel") {
        ctx.fillStyle = "#9d6436";
        roundRect(-15, -12, 30, 24, 7);
        ctx.fill();
        ctx.strokeStyle = "#2e2020";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-10, -12);
        ctx.lineTo(-10, 12);
        ctx.moveTo(10, -12);
        ctx.lineTo(10, 12);
        ctx.stroke();
      } else {
        if (d.type === "rope") {
          ctx.strokeStyle = "#d0ad62";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0.2, TAU + 0.2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(5, 0, 6, -0.5, TAU - 0.5);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        if (d.type === "leaves") {
          ctx.fillStyle = "#63ba57";
          for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate(i * 1.45 + Math.sin(d.bob) * 0.12);
            ellipse(7, 0, 12, 5, 0);
            ctx.restore();
          }
          ctx.strokeStyle = "#2f7f3d";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-9, 0);
          ctx.lineTo(10, 0);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        if (d.type === "cloth") {
          ctx.fillStyle = "#e4e1cf";
          ctx.beginPath();
          ctx.moveTo(-14, -9);
          ctx.quadraticCurveTo(-2, -14, 13, -7);
          ctx.lineTo(10, 11);
          ctx.quadraticCurveTo(-1, 6, -13, 10);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(90, 101, 104, 0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-8, -6);
          ctx.quadraticCurveTo(0, -2, 8, -5);
          ctx.moveTo(-7, 5);
          ctx.quadraticCurveTo(0, 1, 8, 5);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        if (d.type === "scrap") {
          drawScrapModel(0, 0, 1);
          ctx.restore();
          continue;
        }
        if (d.type === "glass") {
          drawGlassModel(0, 0, 1);
          ctx.restore();
          continue;
        }
        ctx.fillStyle = {
          wood: "#b87942",
          leaves: "#64b957",
          scrap: "#a9c3c8",
          cloth: "#e4e1cf",
          rope: "#d0ad62",
          glass: "#9ae9ff"
        }[d.type];
        roundRect(-12, -7, 24, 14, 4);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawRaft() {
    for (const rt of state.raft) {
      const r = raftTileRect(rt);
      drawRaftTile(r, rt, "#b97538", "rgba(89,49,25,0.32)", 1);
      if (rt.hp < rt.maxHp) healthBar(r.x + TILE / 2, r.y - 8, rt.hp / rt.maxHp, 38);
    }
  }

  function drawRemoteRafts() {
    for (const [ownerId, world] of remoteWorlds) {
      ctx.save();
      ctx.globalAlpha = 0.78;
      for (const rt of world.raft || []) {
        drawRaftTile(remoteRaftTileRect(world, rt), rt, "#9d8051", "rgba(40,56,61,0.28)", 0.78);
      }
      for (const st of world.structures || []) drawRemoteStructure(st);
      ctx.restore();
      const owner = remotePlayers.find((player) => player.id === ownerId);
      if (owner && world.raft?.length) {
        const first = remoteRaftTileRect(world, world.raft[0]);
        ctx.fillStyle = "rgba(5, 16, 22, 0.58)";
        roundRect(first.x - 4, first.y - 24, 92, 16, 6);
        ctx.fill();
        ctx.fillStyle = "#e9f9fb";
        ctx.font = "800 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${owner.name || "Player"}'s raft`, first.x + 42, first.y - 13);
      }
    }
  }

  function drawRaftTile(r, rt, fill, plank, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill;
    roundRect(r.x + 2, r.y + 2, TILE - 4, TILE - 4, 5);
    ctx.fill();
    ctx.fillStyle = plank;
    ctx.fillRect(r.x + 7, r.y + 8, TILE - 14, 5);
    ctx.fillRect(r.x + 7, r.y + 22, TILE - 14, 5);
    ctx.fillRect(r.x + 7, r.y + 36, TILE - 14, 5);
    ctx.strokeStyle = rt.hp < 35 ? "#ff7482" : "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    roundRect(r.x + 2, r.y + 2, TILE - 4, TILE - 4, 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawRemoteStructure(st) {
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.rotate(st.angle || 0);
    drawStructureBody(st);
    ctx.restore();
    if (st.hp < st.maxHp) healthBar(st.x, st.y - 30, st.hp / st.maxHp, 36);
  }

  function drawStructures() {
    for (const st of state.structures) {
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.angle || 0);
      drawStructureBody(st);
      ctx.restore();
      if (st.hp < st.maxHp) healthBar(st.x, st.y - 30, st.hp / st.maxHp, 36);
    }
  }

  function drawStructureBody(st) {
    if (st.type === "grill") {
      ctx.fillStyle = "#29333a";
      roundRect(-15, -12, 30, 24, 5);
      ctx.fill();
      ctx.strokeStyle = "#cbd5d9";
      ctx.lineWidth = 2;
      for (let x = -9; x <= 9; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, -10);
        ctx.lineTo(x, 10);
        ctx.stroke();
      }
      if (st.timer > 0 || st.ready) {
        ctx.fillStyle = st.ready ? "#ffd36a" : "#ff7c45";
        circle(0, 0, st.ready ? 8 : 5 + Math.sin(waveTime * 8) * 2);
      }
      drawMachineProgress(st, 18);
    } else if (st.type === "waterMaker") {
      ctx.fillStyle = "#6fb9cb";
      roundRect(-15, -15, 30, 30, 5);
      ctx.fill();
      ctx.fillStyle = st.ready ? "#d8fbff" : "#245e6d";
      circle(0, 0, 8);
      if (st.hasGlass || st.ready) drawFlaskModel(15, -9, 0.38, st.ready);
      drawMachineProgress(st, 21);
    } else if (st.type === "plantPot") {
      ctx.fillStyle = "#8f5634";
      roundRect(-15, -10, 30, 22, 5);
      ctx.fill();
      if (st.planted || st.ready || st.timer > 0) {
        const progress = st.ready ? 1 : st.maxTimer ? 1 - st.timer / st.maxTimer : 0;
        const red = Math.round(75 + progress * 142);
        const green = Math.round(177 - progress * 102);
        ctx.fillStyle = `rgb(${red}, ${green}, 70)`;
        circle(-5, -8, 6);
        circle(6, -9, 6);
        ctx.fillStyle = "#4fb162";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-8, -18);
        ctx.lineTo(8, -18);
        ctx.closePath();
        ctx.fill();
      }
      drawMachineProgress(st, 18);
    } else if (st.type === "chest") {
      ctx.fillStyle = "#8e552e";
      roundRect(-16, -12, 32, 24, 5);
      ctx.fill();
      ctx.fillStyle = "#e2ba5a";
      ctx.fillRect(-3, -12, 6, 24);
    } else if (st.type === "wall") {
      ctx.fillStyle = "#9c642f";
      roundRect(-32, -14, 64, 28, 14);
      ctx.fill();
      ctx.fillStyle = "rgba(74, 42, 21, 0.28)";
      roundRect(-25, -8, 50, 5, 3);
      ctx.fill();
      roundRect(-25, 3, 50, 5, 3);
      ctx.fill();
    } else if (st.type === "torch") {
      ctx.fillStyle = "#6b4429";
      roundRect(-4, -2, 8, 22, 3);
      ctx.fill();
      ctx.fillStyle = "#ffb238";
      circle(0, -9, 9 + Math.sin(waveTime * 12) * 1.5);
      ctx.fillStyle = "#fff1a8";
      circle(0, -10, 4);
    } else if (st.type === "cannon") {
      const aim = st.aimOffset || 0;
      if (activeCannon === st) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#d7eef2";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 72, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#5d6470";
      roundRect(-21, -15, 42, 30, 7);
      ctx.fill();
      ctx.fillStyle = "#373b43";
      ctx.save();
      ctx.rotate(aim);
      roundRect(-4, -8, 46, 16, 8);
      ctx.fill();
      ctx.fillStyle = "#1f2228";
      circle(42, 0, 8);
      ctx.restore();
      ctx.fillStyle = "#2b2e35";
      circle(-8, 0, 10);
      ctx.fillStyle = activeCannon === st ? "#ffd36a" : "#99a6ad";
      circle(-8, 0, 4);
      if (st.cooldown > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
        roundRect(-18, 19, 36, 5, 3);
        ctx.fill();
        ctx.fillStyle = "#ffb45d";
        roundRect(-18, 19, 36 * (1 - st.cooldown / 1.45), 5, 3);
        ctx.fill();
      }
    }
  }

  function drawMachineProgress(st, y) {
    if (!(st.timer > 0) || !st.maxTimer) return;
    const progress = clamp(1 - st.timer / st.maxTimer, 0, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    roundRect(-17, y, 34, 5, 3);
    ctx.fill();
    ctx.fillStyle = st.type === "plantPot" ? "#72d572" : st.type === "waterMaker" ? "#75d7ff" : "#ffd36a";
    roundRect(-17, y, 34 * progress, 5, 3);
    ctx.fill();
  }

  function drawCast() {
    if (!cast) return;
    ctx.strokeStyle = "rgba(240,250,255,0.76)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(cast.x, cast.y);
    ctx.stroke();
    ctx.fillStyle = "#f1f5f7";
    circle(cast.x, cast.y, 5);
    if (cast.catch?.fish) {
      ctx.fillStyle = "#9bd3e2";
      ellipse(cast.x, cast.y + 10, 13, 6, Math.sin(waveTime) * 0.4);
    }
  }

  function drawAnimals() {
    for (const a of state.animals) {
      if (a.type === "crocodile" && a.submerged) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.wander);
      ctx.fillStyle = a.hit > 0 ? "#fff2ed" : { crab: "#e37857", pig: "#d98c77", elephant: "#8d9495", crocodile: "#4f7f4d" }[a.type];
      if (a.type === "crab") {
        ellipse(0, 0, 17, 11, 0);
        ctx.fillStyle = "#8f3e35";
        for (let side of [-1, 1]) {
          ctx.strokeStyle = "#8f3e35";
          ctx.lineWidth = 2;
          for (let y = -7; y <= 7; y += 7) {
            ctx.beginPath();
            ctx.moveTo(side * 10, y);
            ctx.lineTo(side * 22, y + side * 2);
            ctx.stroke();
          }
          circle(side * 15, -8, 4);
        }
      } else if (a.type === "crocodile") {
        ctx.fillStyle = "#416f43";
        ellipse(-5, 0, 45, 13, 0);
        ctx.fillStyle = "#335d37";
        ellipse(31, 0, 25, 9, 0);
        ctx.fillStyle = "#dfe7c8";
        for (let x = 27; x <= 52; x += 7) {
          ctx.beginPath();
          ctx.moveTo(x, -5);
          ctx.lineTo(x + 4, 0);
          ctx.lineTo(x, 5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "#264a2d";
        for (let x = -35; x <= 12; x += 9) circle(x, -9, 2.8);
        for (let x = -35; x <= 12; x += 9) circle(x, 9, 2.8);
        ctx.strokeStyle = "#2a4f30";
        ctx.lineWidth = 5;
        for (const x of [-20, 2]) {
          ctx.beginPath();
          ctx.moveTo(x, -9);
          ctx.lineTo(x + 5, -25);
          ctx.moveTo(x, 9);
          ctx.lineTo(x + 5, 25);
          ctx.stroke();
        }
        ctx.fillStyle = "#2f5732";
        ctx.beginPath();
        ctx.moveTo(-43, 0);
        ctx.lineTo(-78, -11);
        ctx.lineTo(-62, 0);
        ctx.lineTo(-78, 11);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#172317";
        circle(43, -4, 2.2);
        circle(43, 4, 2.2);
      } else if (a.type === "pig") {
        ellipse(0, 0, 25, 15, 0);
        ctx.fillStyle = "#f4b2a4";
        ellipse(18, 0, 10, 8, 0);
        ctx.fillStyle = "#5c3430";
        circle(23, -3, 2);
        circle(23, 3, 2);
        ctx.fillStyle = "#d97875";
        circle(-14, -9, 4);
        circle(-14, 9, 4);
      } else {
        ellipse(0, 0, 39, 23, 0);
        ctx.fillStyle = "#727b7e";
        ellipse(30, 0, 15, 11, 0);
        ctx.strokeStyle = "#eee5c4";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(39, 3);
        ctx.lineTo(56, 11);
        ctx.moveTo(39, -3);
        ctx.lineTo(56, -11);
        ctx.stroke();
        ctx.fillStyle = "#2f383b";
        circle(35, -5, 2);
      }
      ctx.restore();
      healthBar(a.x, a.y - 28, a.hp / a.maxHp, 36);
    }
  }

  function drawShark() {
    for (const s of state.sharks) {
      const surfaced = s.aggressive || s.aggro > 0 || s.hp < SHARK_HP;
      const a = surfaced ? angleTo(s, state.player) : s.wander;
      ctx.save();
      ctx.translate(s.x, s.y + Math.sin(s.finBob) * 2);
      ctx.rotate(a);
      if (surfaced) {
        ctx.fillStyle = "rgba(5, 20, 28, 0.22)";
        ellipse(-4, 8, 58, 16, 0);
        ctx.fillStyle = "#496d7a";
        ellipse(0, 0, 58, 16, 0);
        ctx.fillStyle = "#d8edf1";
        ellipse(15, 5, 30, 7, 0);
        ctx.fillStyle = "#365562";
        ctx.beginPath();
        ctx.moveTo(-10, -11);
        ctx.lineTo(3, -39);
        ctx.lineTo(16, -9);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-44, 0);
        ctx.lineTo(-72, -19);
        ctx.lineTo(-61, 0);
        ctx.lineTo(-72, 19);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, 10);
        ctx.lineTo(14, 29);
        ctx.lineTo(20, 8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-4, -10);
        ctx.lineTo(14, -29);
        ctx.lineTo(21, -8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#151f24";
        circle(29, -5, 2.3);
        ctx.strokeStyle = "#f3f7f8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(34, 5);
        ctx.lineTo(47, 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(13, 44, 56, 0.26)";
        ellipse(0, 10, 50, 8, 0);
        ctx.fillStyle = "#2f454f";
        ctx.beginPath();
        ctx.moveTo(-16, 9);
        ctx.lineTo(0, -31);
        ctx.lineTo(20, 9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      if (surfaced) healthBar(s.x, s.y - 34, s.hp / SHARK_HP, 46);
    }
  }

  function drawProjectiles() {
    for (const shot of [...serverProjectiles, ...state.projectiles]) {
      const a = Math.atan2(shot.vy, shot.vx);
      ctx.save();
      ctx.translate(shot.x, shot.y);
      ctx.rotate(a);
      if (shot.type === "musketBall") {
        ctx.fillStyle = "rgba(5, 16, 22, 0.22)";
        ellipse(-5, 4, 8, 3, 0);
        ctx.fillStyle = "#30353a";
        circle(0, 0, 3.6);
        ctx.strokeStyle = "rgba(255, 232, 175, 0.32)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(-22, 0);
        ctx.stroke();
      } else if (shot.type === "cannonball") {
        ctx.fillStyle = "rgba(5, 16, 22, 0.22)";
        ellipse(-8, 6, 13, 5, 0);
        ctx.fillStyle = "#282b31";
        circle(0, 0, 7);
        ctx.fillStyle = "#4d525b";
        circle(-2, -2, 2.4);
        ctx.strokeStyle = "rgba(244, 231, 190, 0.38)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-28, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawRemotePlayers() {
    for (const other of remotePlayers) {
      if (!other || other.health <= 0) continue;
      ctx.save();
      ctx.translate(other.x, other.y);
      ctx.rotate(other.facing || 0);
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = "#26324a";
      ellipse(0, 0, 16, 13, 0);
      ctx.fillStyle = "#f1c79f";
      circle(10, 0, 9);
      ctx.strokeStyle = "#f5e8cd";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(4, -10);
      ctx.lineTo(24, -15);
      ctx.moveTo(4, 10);
      ctx.lineTo(24, 15);
      ctx.stroke();
      drawRemoteHeldItem(other.selectedItem);
      ctx.restore();
      ctx.fillStyle = "rgba(5, 16, 22, 0.65)";
      roundRect(other.x - 31, other.y - 38, 62, 16, 6);
      ctx.fill();
      ctx.fillStyle = "#e9f9fb";
      ctx.font = "800 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(other.name || "Player", other.x, other.y - 27);
      healthBar(other.x, other.y - 18, (other.health || 100) / 100, 36);
    }
  }

  function drawRemoteHeldItem(item) {
    const spec = toolSpec(item);
    if (hotbarResource(item) || FOOD_ITEMS.includes(item)) return drawHeldResourceItem(item);
    if (spec?.base === "spear") return drawHeldSpear(spec);
    if (spec?.base === "axe") return drawHeldAxe(spec);
    if (spec?.base === "hammer") return drawHeldHammer(spec);
    if (item === "musket") return drawHeldMusket();
    if (item === "oar") {
      ctx.save();
      ctx.translate(16, 0);
      ctx.strokeStyle = "#8c5a34";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(58, 0);
      ctx.stroke();
      ctx.fillStyle = "#b8783f";
      ellipse(73, 0, 18, 8, 0);
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = state.player;
    const moving = keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD");
    const handSwing = moving ? Math.sin(waveTime * 10) * 5 : Math.sin(waveTime * 3) * 1.5;
    const item = hotbar[selected].id;
    const heldSpec = toolSpec(item);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    ctx.globalAlpha = p.invuln > 0 ? 0.58 : 1;
    ctx.fillStyle = "#2e3340";
    ellipse(0, 0, 16, 13, 0);
    ctx.fillStyle = "#f0c39b";
    circle(10, 0, 9);
    ctx.strokeStyle = "#f5e8cd";
    ctx.lineWidth = 5;
    const leftReach = item === "oar" && mouse.down ? Math.sin(rowingTimer) * 16 : handSwing;
    const rightReach = item === "oar" && mouse.down ? Math.sin(rowingTimer + Math.PI) * 16 : -handSwing;
    ctx.beginPath();
    ctx.moveTo(5, -10);
    ctx.lineTo(24 + leftReach, -16);
    ctx.moveTo(5, 10);
    ctx.lineTo(24 + rightReach, 16);
    ctx.stroke();
    ctx.fillStyle = "#f0c39b";
    circle(26 + leftReach, -16, 4.6);
    circle(26 + rightReach, 16, 4.6);
    if (buildMode) {
      drawHeldBuildItem();
    } else if (hotbarResource(item) || availableFoods().includes(item)) {
      drawHeldResourceItem(item);
    } else if (heldSpec?.base === "spear") {
      drawHeldSpear(heldSpec);
    } else if (heldSpec?.base === "axe") {
      drawHeldAxe(heldSpec);
    } else if (heldSpec?.base === "hammer") {
      drawHeldHammer(heldSpec);
    } else if (item === "musket") {
      drawHeldMusket();
    } else if (item === "oar") {
      ctx.save();
      ctx.translate(16, 0);
      ctx.rotate(Math.sin(rowingTimer) * 0.28);
      ctx.strokeStyle = "#8c5a34";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(58, 0);
      ctx.stroke();
      ctx.fillStyle = "#b8783f";
      ellipse(73, 0, 18, 8, 0);
      ctx.fillStyle = "#704321";
      roundRect(-28, -4, 15, 8, 4);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function toolProgress(kind) {
    if (toolAnim.kind !== kind || toolAnim.duration <= 0) return 0;
    return 1 - toolAnim.t / toolAnim.duration;
  }

  function swingCurve(kind) {
    const p = toolProgress(kind);
    return p <= 0 ? 0 : Math.sin(p * Math.PI);
  }

  function toolDrawStyle(specOrMetal = false) {
    if (typeof specOrMetal === "boolean") {
      return { metal: specOrMetal, tierStep: specOrMetal ? 1 : 0, color: specOrMetal ? "#99a9af" : "#d4bd82" };
    }
    const spec = specOrMetal || TOOL_TIERS.wood;
    return { metal: spec.tier !== "wood", tierStep: tierIndex(spec.tier || "wood"), color: spec.color || TOOL_TIERS.wood.color };
  }

  function drawHeldSpear(specOrMetal = false) {
    const style = toolDrawStyle(specOrMetal);
    const jab = swingCurve("spear") * 26;
    ctx.save();
    ctx.translate(jab, 0);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.metal ? 5 : 4;
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.lineTo(style.metal ? 66 : 58, -8);
    ctx.stroke();
    ctx.fillStyle = style.metal ? "#e7eef0" : "#b7ccd0";
    ctx.beginPath();
    ctx.moveTo(style.metal ? 78 : 68, -8);
    ctx.lineTo(style.metal ? 62 : 55, style.metal ? -17 : -15);
    ctx.lineTo(style.metal ? 62 : 55, style.metal ? 1 : -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHeldAxe(specOrMetal = false) {
    const style = toolDrawStyle(specOrMetal);
    const swing = swingCurve("axe");
    ctx.save();
    ctx.translate(15, -4);
    ctx.rotate(-0.55 + swing * 1.55);
    ctx.strokeStyle = style.metal ? "#5e6b70" : "#8b5b35";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.lineTo(39, -8);
    ctx.stroke();
    ctx.fillStyle = style.metal ? style.color : "#c3d1d6";
    roundRect(32, -20, style.metal ? 20 : 16, 21, 4);
    ctx.fill();
    ctx.fillStyle = style.metal ? "#eef7f9" : "#eef6f8";
    ctx.beginPath();
    ctx.moveTo(style.metal ? 50 : 47, style.metal ? -22 : -19);
    ctx.lineTo(style.metal ? 64 : 58, -11);
    ctx.lineTo(style.metal ? 50 : 48, style.metal ? 0 : -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHeldHammer(specOrMetal = false) {
    const style = toolDrawStyle(specOrMetal);
    const swing = swingCurve("hammer");
    ctx.save();
    ctx.translate(15, 4);
    ctx.rotate(0.5 - swing * 1.45);
    ctx.strokeStyle = style.metal ? "#617178" : "#7a5133";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.lineTo(38, 9);
    ctx.stroke();
    ctx.fillStyle = style.metal ? style.color : "#9aaab0";
    roundRect(32, -1, style.metal ? 30 : 24, style.metal ? 16 : 14, 4);
    ctx.fill();
    ctx.fillStyle = "#cad5d8";
    ctx.fillRect(38, 1, 5, style.metal ? 13 : 12);
    ctx.restore();
  }

  function drawHeldMusket() {
    ctx.save();
    ctx.translate(18, 0);
    ctx.strokeStyle = "#6b4328";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-10, 5);
    ctx.lineTo(60, -2);
    ctx.stroke();
    ctx.strokeStyle = "#4d555b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(16, -4);
    ctx.lineTo(72, -8);
    ctx.stroke();
    ctx.fillStyle = "#2d3238";
    roundRect(28, -8, 12, 7, 2);
    ctx.fill();
    ctx.fillStyle = musketCooldown > 0 ? "#ffbb66" : "#dbe6e8";
    circle(73, -8, 3);
    if (musketCooldown > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(5, 12, 48, 5, 3);
      ctx.fill();
      ctx.fillStyle = "#ffbb66";
      roundRect(5, 12, 48 * (1 - musketCooldown / 7), 5, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHeldBuildItem() {
    if (!isBuildRecipe(buildChoice)) {
      const spec = toolSpec(buildChoice);
      if (buildChoice === "bandage") return drawHeldResourceItem("bandage");
      if (buildChoice === "flask") return drawHeldResourceItem("flask");
      if (spec?.base === "spear") return drawHeldSpear(spec);
      if (spec?.base === "axe") return drawHeldAxe(spec);
      if (spec?.base === "hammer") return drawHeldHammer(spec);
      if (buildChoice === "musket") return drawHeldMusket();
    }
    ctx.save();
    ctx.translate(34, 0);
    ctx.rotate(buildAngle);
    ctx.globalAlpha = 0.92;
    const f = footprint(buildChoice);
    ctx.fillStyle = buildChoice === "raft" ? "#b97538" : buildChoice === "waterMaker" ? "#6fb9cb" : buildChoice === "plantPot" ? "#8f5634" : buildChoice === "wall" ? "#9c642f" : buildChoice === "torch" ? "#ffb238" : buildChoice === "cannon" ? "#4d525b" : "#8e552e";
    if (buildChoice === "raft") {
      roundRect(-18, -14, 36, 28, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(89,49,25,0.32)";
      ctx.fillRect(-13, -7, 26, 4);
      ctx.fillRect(-13, 6, 26, 4);
    } else if (buildChoice === "torch") {
      ctx.fillStyle = "#6b4429";
      roundRect(-3, -3, 6, 22, 3);
      ctx.fill();
      ctx.fillStyle = "#ffb238";
      circle(0, -9, 8);
    } else if (buildChoice === "wall") {
      roundRect(-f.w / 2, -f.h / 2, f.w, f.h, f.h / 2);
      ctx.fill();
    } else if (buildChoice === "cannon") {
      roundRect(-f.w / 2, -f.h / 2, f.w, f.h, 7);
      ctx.fill();
      ctx.fillStyle = "#252931";
      roundRect(0, -7, 31, 14, 7);
      ctx.fill();
    } else {
      roundRect(-f.w / 2, -f.h / 2, f.w, f.h, 5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawHeldResourceItem(name) {
    ctx.save();
    ctx.translate(35, 0);
    const color = {
      wood: "#b87942",
      leaves: "#64b957",
      scrap: "#a9c3c8",
      iron: "#d6dde0",
      steel: "#e7f3f5",
      cloth: "#e4e1cf",
      rope: "#d0ad62",
      glass: "#9ae9ff",
      flask: "#9ae9ff",
      waterFlask: "#52c4ec",
      rawFish: "#9bd3e2",
      cookedFish: "#f0a85d",
      sharkMeat: "#d96d70",
      meat: "#c75b55",
      cookedMeat: "#b96242",
      coconut: "#82522e",
      tomato: "#d94b45"
    }[name] || "#d8eef4";
    ctx.fillStyle = color;
    if (name === "rope") {
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, TAU);
      ctx.stroke();
    } else if (name === "scrap" || name === "iron" || name === "steel") {
      const colors = {
        scrap: ["#879aa1", "#c9d8dc"],
        iron: ["#b4bdc2", "#eef4f5"],
        steel: ["#6f858e", "#e8fbff"]
      }[name];
      drawScrapModel(0, 0, 0.82, colors[0], colors[1]);
    } else if (name === "glass") {
      drawGlassModel(0, 0, 0.82);
    } else if (name === "flask" || name === "waterFlask") {
      drawFlaskModel(0, 0, 0.72, name === "waterFlask");
    } else if (name === "coconut" || name === "tomato") {
      circle(0, 0, 10);
    } else if (name.includes("Fish") || name === "rawFish") {
      ellipse(0, 0, 16, 7, 0);
    } else {
      roundRect(-11, -8, 22, 16, 4);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      circle(p.x, p.y, p.size);
      ctx.globalAlpha = 1;
    }
  }

  function drawBuildGhost() {
    const spot = buildPlacementPoint();
    const legal = buildChoice === "raft" ? true : Boolean(buildSiteAt(spot.x, spot.y));
    ctx.globalAlpha = 0.58;
    ctx.fillStyle = legal ? "#64fff0" : "#ff6b80";
    if (buildChoice === "raft") {
      const gx = Math.round((spot.x - state.raftOffset.x - TILE / 2) / TILE);
      const gy = Math.round((spot.y - state.raftOffset.y - TILE / 2) / TILE);
      roundRect(state.raftOffset.x + gx * TILE + 2, state.raftOffset.y + gy * TILE + 2, TILE - 4, TILE - 4, 5);
    } else {
      const f = footprint(buildChoice);
      ctx.save();
      ctx.translate(spot.x, spot.y);
      ctx.rotate(state.player.facing + buildAngle);
      roundRect(-f.w / 2, -f.h / 2, f.w, f.h, buildChoice === "wall" ? f.h / 2 : 5);
      ctx.restore();
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawVignette(w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.26)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawMinimap() {
    const s = mini.width;
    mctx.clearRect(0, 0, s, s);
    mctx.fillStyle = "#0b6f8b";
    mctx.fillRect(0, 0, s, s);
    const scale = s / WORLD;
    for (const island of state.islands) {
      mctx.fillStyle = island.kind === "large" ? "#d5b66a" : "#c8a45f";
      mctx.beginPath();
      mctx.arc(island.x * scale, island.y * scale, island.r * scale, 0, TAU);
      mctx.fill();
    }
    mctx.fillStyle = "#d79045";
    for (const rt of state.raft) {
      const r = raftTileRect(rt);
      mctx.fillRect(r.x * scale, r.y * scale, Math.max(1, TILE * scale), Math.max(1, TILE * scale));
    }
    mctx.fillStyle = "#d2b783";
    for (const world of remoteWorlds.values()) {
      for (const rt of world.raft || []) {
        const r = remoteRaftTileRect(world, rt);
        mctx.fillRect(r.x * scale, r.y * scale, Math.max(1, TILE * scale), Math.max(1, TILE * scale));
      }
    }
    for (const shark of state.sharks) {
      mctx.fillStyle = shark.aggressive || shark.aggro > 0 ? "#ff6576" : "#2f454f";
      mctx.beginPath();
      mctx.arc(shark.x * scale, shark.y * scale, 2.2, 0, TAU);
      mctx.fill();
    }
    mctx.fillStyle = "#ffffff";
    mctx.beginPath();
    mctx.arc(state.player.x * scale, state.player.y * scale, 3, 0, TAU);
    mctx.fill();
  }

  function healthBar(x, y, ratio, width) {
    ratio = clamp(ratio, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(x - width / 2, y, width, 5, 3);
    ctx.fill();
    ctx.fillStyle = ratio > 0.45 ? "#68df73" : "#ff677d";
    roundRect(x - width / 2, y, width * ratio, 5, 3);
    ctx.fill();
  }

  function blob(x, y, r, points, wobble) {
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * TAU;
      const rr = r * (1 + Math.sin(i * 2.17 + x) * wobble + Math.cos(i * 1.71 + y) * wobble);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function ellipse(x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/[A-Z]/g, (m) => ` ${m.toLowerCase()}`);
  }

  function label(s) {
    const spec = toolSpec(s);
    if (spec) return spec.label;
    return {
      raft: "Raft Tile",
      grill: "Grill",
      waterMaker: "Water Maker",
      plantPot: "Plant Pot",
      chest: "Chest",
      wall: "Wall",
      torch: "Torch",
      cannon: "Cannon",
      flask: "Empty Water Flask",
      waterFlask: "Filled Water Flask",
      musket: "Musket",
      sharkMeat: "Raw Shark Meat",
      rawFish: "Raw Fish",
      cookedFish: "Cooked Fish",
      meat: "Raw Meat",
      cookedMeat: "Cooked Meat"
    }[s] || cap(s);
  }
})();
