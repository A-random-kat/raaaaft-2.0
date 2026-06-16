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
  const scoreboardListEl = document.getElementById("scoreboard-list");
  const startScreenEl = document.getElementById("start-screen");
  const usernameEl = document.getElementById("username");
  const startButtonEl = document.getElementById("start-button");
  const gameOverEl = document.getElementById("game-over");
  const fallenNameEl = document.getElementById("fallen-name");

  const TAU = Math.PI * 2;
  const TILE = 72;
  const WORLD = 7200;
  const STRUCTURE_RADIUS = 21;
  const GRILL_TIME = 60;
  const WATER_TIME = 60;
  const TOMATO_GROW_TIME = 300;
  const DROWN_TIME = 20;
  const SHARK_HP = 120;
  const SHARK_BITE_DAMAGE = 36;
  const SHARK_RAFT_DAMAGE = 30;
  const CROCODILE_DAMAGE = 27;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const now = () => performance.now() / 1000;

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
    spear: { wood: 6, scrap: 3, rope: 2 }
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
    { id: "rod", name: "Rod", key: "1" },
    { id: "oar", name: "Oar", key: "2" },
    { id: "axe", name: "Axe", key: "3" },
    { id: "spear", name: "Spear", key: "4" },
    { id: "hammer", name: "Hammer", key: "5" },
    { id: "bandage", name: "Bandage", key: "6" },
    { id: "food", name: "Food", key: "7" },
    { id: "glass", name: "Glass", key: "8" },
    { id: "build", name: "Build", key: "9" },
    { id: "empty", name: "-", key: "0" }
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
  let pendingBuild = { raft: 1 };
  let dayClock = 0;
  let cast = null;
  let rowingTimer = 0;
  let waveTime = 0;
  let gameStarted = false;
  let playerName = "Captain";
  let serverPlayerId = null;
  let serverSyncTimer = 0;
  let scoreboardRows = [];
  let remotePlayers = [];
  let activeCannon = null;

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
      resources: {
        wood: 12,
        leaves: 8,
        scrap: 4,
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
        bandage: 1
      },
      camera: { x: player.x, y: player.y },
      raftOffset: { x: player.x - TILE * 0.5, y: player.y - TILE * 0.5 },
      sharks: createSharks(player),
      crocTimer: rnd(18, 35),
      messages: [],
      day: 1
    };
  }

  function createSharks(player, islands = null) {
    return Array.from({ length: 14 }, () => {
      const p = randomOceanPoint(520, player, islands);
      const a = rnd(0, TAU);
      const aggressive = Math.random() < 0.25;
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
    for (let i = 0; i < 175; i++) spawnDebris();
    const specs = [
      { x: 980, y: 980, r: 215, kind: "small" },
      { x: 2220, y: 860, r: 260, kind: "medium", wreck: true },
      { x: 4020, y: 930, r: 285, kind: "medium" },
      { x: 5900, y: 850, r: 330, kind: "large", wreck: true },
      { x: 1160, y: 2360, r: 300, kind: "medium" },
      { x: 2860, y: 2460, r: 430, kind: "large", wreck: true },
      { x: 4460, y: 2500, r: 245, kind: "small" },
      { x: 6200, y: 2720, r: 275, kind: "medium" },
      { x: 1020, y: 4150, r: 260, kind: "medium" },
      { x: 2660, y: 4320, r: 225, kind: "small" },
      { x: 4240, y: 4160, r: 380, kind: "large", wreck: true },
      { x: 5830, y: 4480, r: 230, kind: "small" },
      { x: 1260, y: 6160, r: 315, kind: "medium", wreck: true },
      { x: 3320, y: 6120, r: 260, kind: "medium" },
      { x: 5480, y: 6260, r: 390, kind: "large" }
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
        x: p.x + Math.cos(angle + Math.PI / 2) * rnd(-45, 45) + Math.cos(angle) * rnd(-60, 35),
        y: p.y + Math.sin(angle + Math.PI / 2) * rnd(-45, 45) + Math.sin(angle) * rnd(-60, 35),
        type: Math.random() < 0.55 ? "scrap" : Math.random() < 0.78 ? "glass" : "rope",
        qty: 1,
        dead: false
      });
    }
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
    const typingName = e.target === usernameEl;
    if (typingName && e.code !== "Enter") return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    const idx = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"].indexOf(e.code);
    if (idx >= 0) {
      selected = idx;
      buildMode = hotbar[selected].id === "build";
      heldItem = hotbar[selected].id;
      renderHotbar();
    }
    if (e.code === "KeyB") {
      buildMode = !buildMode;
      selected = 8;
      renderHotbar();
      toast(buildMode ? "Build mode: use craft buttons to choose pieces." : "Build mode off.");
    }
    if (e.code === "KeyR") rotateBuild();
    if (e.code === "KeyN") cycleBuildChoice();
    if (e.code === "KeyG") cycleFoodChoice();
    if (e.code === "KeyZ") train("speed");
    if (e.code === "KeyX") train("agility");
    if (e.code === "KeyV") train("strength");
    if (e.code === "KeyC") toggleRecipeBook();
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
  usernameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
  });

  function startGame() {
    playerName = cleanName(usernameEl.value);
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
    pendingBuild = { raft: 1 };
    buildMode = false;
    buildAngle = 0;
    heldItem = null;
    selectedFood = null;
    toolAnim = { kind: null, t: 0, duration: 0 };
    activeCannon = null;
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
    toast(`Welcome aboard, ${playerName}.`);
  }

  function showStartScreen() {
    gameStarted = false;
    gameOverEl.hidden = true;
    startScreenEl.hidden = false;
    usernameEl.value = playerName;
    usernameEl.focus();
  }

  function cleanName(value) {
    return value.trim().replace(/\s+/g, " ").slice(0, 18) || "Captain";
  }

  function renderHotbar() {
    hotbarEl.innerHTML = "";
    hotbar.forEach((item, i) => {
      const slot = document.createElement("div");
      slot.className = `slot ${i === selected ? "active" : ""}`;
      const icon = {
        rod: "ROD",
        oar: "OAR",
        axe: "AXE",
        spear: "SPR",
        hammer: "HAM",
        bandage: "BND",
        food: "EAT",
        glass: "H2O",
        build: "BLD",
        empty: ""
      }[item.id];
      const count = hotbarCount(item);
      slot.innerHTML = `<kbd>${item.key}</kbd>${count ? `<span class="count">${count}</span>` : ""}<div class="icon">${icon}</div><div class="name">${hotbarName(item)}</div>`;
      slot.addEventListener("click", () => {
        selected = i;
        buildMode = false;
        heldItem = item.id;
        renderHotbar();
      });
      hotbarEl.append(slot);
    });
  }

  function hotbarName(item) {
    if (item.id === "bandage") return `Bandage ${state.resources.bandage || 0}`;
    if (item.id === "glass") return `Glass ${state.resources.glass || 0}`;
    if (item.id === "food") return bestFoodLabel();
    if (item.id === "build") return buildMode ? label(buildChoice) : "Build";
    return item.name;
  }

  function hotbarCount(item) {
    if (item.id === "bandage") return state.resources.bandage || "";
    if (item.id === "glass") return state.resources.glass || "";
    if (item.id === "food") {
      const food = selectedFood || availableFoods()[0];
      return food ? state.resources[food] || "" : "";
    }
    if (item.id === "build") return pendingBuild[buildChoice] || "";
    return "";
  }

  function hotbarResource(id) {
    return ["bandage", "glass"].includes(id);
  }

  function bestFoodLabel() {
    const r = state.resources;
    if (selectedFood && r[selectedFood] > 0) return `${label(selectedFood)} ${r[selectedFood]}`;
    if (r.cookedFish > 0) return `Cooked Fish ${r.cookedFish}`;
    if (r.cookedMeat > 0) return `Cooked Meat ${r.cookedMeat}`;
    if (r.rawFish > 0) return `Raw Fish ${r.rawFish}`;
    if (r.coconut > 0) return `Coconut ${r.coconut}`;
    if (r.tomato > 0) return `Tomato ${r.tomato}`;
    return "Food 0";
  }

  function availableFoods() {
    return ["cookedFish", "cookedMeat", "rawFish", "tomato", "coconut"].filter((key) => (state.resources[key] || 0) > 0);
  }

  function renderRecipes() {
    renderRecipeBook();
  }

  function recipeText(name) {
    const recipe = recipes[name];
    if (!recipe) return "no recipe";
    return Object.entries(recipe).map(([res, qty]) => `${qty} ${label(res).toLowerCase()}`).join(", ");
  }

  function renderRecipeBook() {
    if (!recipeGridEl) return;
    recipeGridEl.innerHTML = "";
    for (const name of Object.keys(recipes)) {
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
    selected = 8;
    heldItem = name;
    renderHotbar();
    renderRecipes();
  }

  function chooseRecipe(name) {
    recipeBookEl.hidden = true;
    if (isBuildRecipe(name)) {
      selectBuildItem(name);
      if ((pendingBuild[name] || 0) > 0) {
        return toast(`Holding ${label(name)} to place.`);
      }
      if (canAfford(name)) return craftRecipe(name);
      return toast(`Selected ${label(name)}. Gather the recipe materials to build it.`);
    }
    craftRecipe(name);
  }

  function isBuildRecipe(name) {
    return Boolean(recipes[name]) && !["bandage", "spear"].includes(name);
  }

  function craftCycleChoices() {
    return Object.keys(recipes).filter((name) => isBuildRecipe(name) || name === "bandage");
  }

  function canAfford(name) {
    const recipe = recipes[name];
    return Boolean(recipe) && Object.entries(recipe).every(([res, qty]) => (state.resources[res] || 0) >= qty);
  }

  function toggleRecipeBook() {
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

  async function joinServerMode() {
    scoreboardRows = [{ name: playerName, level: state.player.level, xp: state.player.totalXp || 0 }];
    renderScoreboard();
    if (location.protocol === "file:") return;
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName })
      });
      const data = await res.json();
      serverPlayerId = data.id;
      remotePlayers = (data.players || []).filter((p) => p.id !== serverPlayerId);
    } catch {
      serverPlayerId = null;
    }
  }

  async function updateServerMode(dt) {
    serverSyncTimer += dt;
    if (serverSyncTimer < 1) return;
    serverSyncTimer = 0;
    const local = { name: playerName, level: state.player.level, xp: state.player.totalXp || 0 };
    if (location.protocol === "file:" || !serverPlayerId) {
      scoreboardRows = [local];
      remotePlayers = [];
      renderScoreboard();
      return;
    }
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: serverPlayerId,
          name: playerName,
          x: state.player.x,
          y: state.player.y,
          facing: state.player.facing,
          level: state.player.level,
          xp: state.player.totalXp || 0,
          health: state.player.health
        })
      });
      const data = await res.json();
      scoreboardRows = data.scoreboard || [local];
      remotePlayers = (data.players || []).filter((p) => p.id !== serverPlayerId);
      renderScoreboard();
    } catch {
      scoreboardRows = [local];
      remotePlayers = [];
      renderScoreboard();
    }
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
      item.innerHTML = `<span>${row.name || "Player"}</span><span>Lv ${row.level || 1}</span>`;
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
    p.attackCd = Math.max(0, p.attackCd - dt);
    if (toolAnim.t > 0) {
      toolAnim.t = Math.max(0, toolAnim.t - dt);
      if (toolAnim.t <= 0) toolAnim.kind = null;
    }
    p.invuln = Math.max(0, p.invuln - dt);
    dayClock += dt;
    state.day = Math.floor(dayClock / 90) + 1;

    const drain = isOnRaft(p) ? 1 : 1.35;
    p.hunger = clamp(p.hunger - dt * 0.34 * drain, 0, 100);
    p.thirst = clamp(p.thirst - dt * 0.46 * drain, 0, 100);
    if (p.hunger <= 0 || p.thirst <= 0) hurt((p.hunger <= 0 && p.thirst <= 0 ? 7 : 4) * dt, "Starvation and dehydration are winning.");

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

    if (isOnRaft(p) && hotbar[selected].id === "oar" && mouse.down) {
      if (!spendStamina(0.18, false)) {
        rowingTimer = Math.max(0, rowingTimer - dt * 7);
      } else {
      const a = angleTo(screenCenterWorld(), mouseWorld());
      const dx = Math.cos(a) * 72 * dt;
      const dy = Math.sin(a) * 72 * dt;
      if (moveRaft(dx, dy)) {
        p.x += dx;
        p.y += dy;
        rowingTimer += dt * 9;
      }
      }
    } else {
      rowingTimer = Math.max(0, rowingTimer - dt * 7);
    }

    updateCast(dt);
    updateDebris(dt);
    updateAnimals(dt);
    updateShark(dt);
    updateStructures(dt);
    updateProjectiles(dt);
    updateWorldRespawns(dt);
    updateParticles(dt);

    if (state.debris.length < 135) spawnDebris();
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
    return state.raft.some((rt) => {
      const r = raftTileRect(rt);
      return p.x > r.x && p.x < r.x + TILE && p.y > r.y && p.y < r.y + TILE;
    });
  }

  function isOnIsland(p) {
    return state.islands.some((island) => Math.hypot(p.x - island.x, p.y - island.y) < island.r * 0.92);
  }

  function raftTileRect(rt) {
    return {
      x: state.raftOffset.x + rt.gx * TILE,
      y: state.raftOffset.y + rt.gy * TILE,
      w: TILE,
      h: TILE
    };
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
      const haul = ["wood", "wood", "leaves", "scrap", "cloth", "rope", "glass"];
      const found = {};
      for (let i = 0; i < 4; i++) {
        const item = haul[Math.floor(Math.random() * haul.length)];
        found[item] = (found[item] || 0) + 1;
      }
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
      const near = dist(a, p);
      let vx = Math.cos(a.wander) * 0.25;
      let vy = Math.sin(a.wander) * 0.25;
      const playerIsland = islandAt(p);
      const crocodileOnLand = a.type === "crocodile" && playerIsland && a.homeIsland === playerIsland;
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
      if (a.type === "crocodile" && (!playerIsland || a.homeIsland !== playerIsland)) continue;
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
      const target = land ? sharkWaterPoint(land, s) : aggro && isOnRaft(p) ? nearestRaftEdge(s) : aggro ? p : null;
      let a = target ? (s.flee > 0 ? angleTo(target, s) : angleTo(s, target)) : s.wander;
      a = steerAroundIslands(s, a);
      const spd = s.flee > 0 ? 125 : aggro ? 105 : 42;
      s.x += Math.cos(a) * spd * dt;
      s.y += Math.sin(a) * spd * dt;
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
      const edge = nearestRaftEdge(s);
      if (aggro && isOnRaft(p) && dist(s, edge) < 42 && s.bite <= 0 && state.raft.length > 2) {
        const victim = state.raft[Math.floor(Math.random() * state.raft.length)];
        damageRaftBlock(victim, SHARK_RAFT_DAMAGE);
        s.bite = 2.2;
        toast("Angry shark is chewing the raft.");
        if (victim.hp <= 0) breakRaftTile(victim);
      }
    }
  }

  function islandAt(p) {
    return state.islands.find((island) => Math.hypot(p.x - island.x, p.y - island.y) < island.r * 0.92);
  }

  function sharkWaterPoint(island, s) {
    const a = angleTo(island, s);
    return {
      x: island.x + Math.cos(a) * (island.r + 90),
      y: island.y + Math.sin(a) * (island.r + 90)
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

  function breakRaftTile(rt) {
    if (state.raft.length <= 2) return;
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
          toast("Water maker filled a glass.");
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
      if (!shot.dead && shot.age > 0.06) {
        const hitAnimal = state.animals.some((a) => !a.dead && dist(a, shot) < 20);
        const hitShark = state.sharks.some((s) => dist(s, shot) < 35);
        const armedForBlocks = shot.age > 0.18;
        const hitStructure = armedForBlocks && state.structures.some((st) => dist(st, shot) < footprintRadius(st.type) + 8);
        const hitRaft = armedForBlocks && state.raft.some((rt) => {
          const r = raftTileRect(rt);
          return shot.x > r.x && shot.x < r.x + r.w && shot.y > r.y && shot.y < r.y + r.h;
        });
        if (hitAnimal || hitShark || hitStructure || hitRaft) shot.dead = true;
      }
      if (shot.dead && !shot.exploded) {
        shot.exploded = true;
        explodeCannonball(shot);
      }
    }
    state.projectiles = state.projectiles.filter((shot) => !shot.dead);
  }

  function fireCannon(cannon) {
    if (!cannon || cannon.hp <= 0) return;
    if (cannon.cooldown > 0) return toast("Cannon is reloading.");
    if (!spendStamina(12)) return;
    const angle = (cannon.angle || 0) + (cannon.aimOffset || 0);
    cannon.cooldown = 1.45;
    state.projectiles.push({
      type: "cannonball",
      x: cannon.x + Math.cos(angle) * 36,
      y: cannon.y + Math.sin(angle) * 36,
      vx: Math.cos(angle) * 430,
      vy: Math.sin(angle) * 430,
      age: 0,
      life: 1.28,
      damage: 42,
      radius: 52
    });
    burst(cannon.x + Math.cos(angle) * 32, cannon.y + Math.sin(angle) * 32, "#ffe0a3", 9);
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
      if (rt.hp <= 0 && state.raft.length > 2) breakRaftTile(rt);
    }
    gainXp(4);
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
        if (crocsHere < 2) {
          state.animals.push(animal("crocodile", waterPointAroundIsland(playerIsland, rnd(34, 76)), playerIsland));
          toast("A crocodile is swimming in from the shore.");
        }
        state.crocTimer = rnd(35, 60);
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
      const inWreck = island.shipwreck && dist(island.shipwreck, p) < 76;
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

  function useSelected() {
    if (!gameStarted) return;
    if (!state.player.alive) return;
    updateMouseWorld();
    if (activeCannon) return fireCannon(activeCannon);
    if (state.player.stamina <= 0) return toast("Too exhausted to act. Rest for a moment.");
    const id = hotbar[selected].id;
    if (buildMode) return placeBuild();
    if (id === "rod") return useRod();
    if (id === "axe") return swing("axe");
    if (id === "spear") return swing("spear");
    if (id === "hammer") return swing("hammer");
    if (id === "bandage") return useBandage();
    if (id === "food") return eatFood();
    if (id === "glass") return drinkWater();
  }

  function useRod() {
    if (cast) return;
    if (!spendStamina(4)) return;
    const p = state.player;
    const a = angleTo(p, mouseWorld());
    cast = { x: p.x, y: p.y, tx: p.x + Math.cos(a) * 330, ty: p.y + Math.sin(a) * 330, t: 0, hooked: false, catch: null };
  }

  function swing(kind) {
    const p = state.player;
    if (p.attackCd > 0) return;
    if (!spendStamina(kind === "spear" ? 9 : 8)) return;
    p.attackCd = kind === "spear" ? 0.48 : 0.62;
    toolAnim = { kind, t: p.attackCd, duration: p.attackCd };
    const reach = kind === "spear" ? 82 : 58;
    const damage = (kind === "spear" ? 28 : kind === "axe" ? 20 : 12) + p.strength * 3;
    const targetAngle = angleTo(p, mouseWorld());
    burst(p.x + Math.cos(targetAngle) * 34, p.y + Math.sin(targetAngle) * 34, kind === "hammer" ? "#b8d4de" : "#fff3c9", 6);

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
    if (kind === "axe" && damagePlacedItem(reach, targetAngle, Math.round(damage * 0.6))) return;
    if (kind === "axe") chopTree(reach, targetAngle, damage);
    if (kind === "hammer") repairTile(reach);
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
        if (rt.hp <= 0 && state.raft.length > 2) {
          breakRaftTile(rt);
          toast("Raft tile chopped apart.");
        } else {
          toast("Raft tile damaged.");
        }
        gainXp(1);
        return true;
      }
    }
    return false;
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
    const p = randomOceanPoint(700, state.player, state.islands);
    shark.x = p.x;
    shark.y = p.y;
    shark.hp = SHARK_HP;
    shark.bite = 0;
    shark.flee = 0;
    shark.aggressive = Math.random() < 0.25;
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

  function repairTile(reach) {
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
      closestStructure.hp = clamp(closestStructure.hp + 35, 0, closestStructure.maxHp);
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
    best.hp = clamp(best.hp + 30, 0, best.maxHp);
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
      if (wreck && dist(p, wreck) < 135) {
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
        return toast("Collected cooked food.");
      }
      const cookable = state.resources.rawFish > 0 ? "rawFish" : state.resources.sharkMeat > 0 ? "sharkMeat" : state.resources.meat > 0 ? "meat" : null;
      if (st.timer <= 0 && cookable) {
        state.resources[cookable]--;
        st.cooking = cookable;
        st.timer = GRILL_TIME;
        st.maxTimer = GRILL_TIME;
        st.ready = false;
        renderHotbar();
        return toast(`${label(cookable)} is cooking.`);
      }
      return toast("Need raw fish or raw meat for the grill.");
    }
    if (st.type === "waterMaker") {
      if (st.ready) {
        st.ready = false;
        st.hasGlass = false;
        state.resources.glass++;
        state.player.thirst = clamp(state.player.thirst + 34, 0, 100);
        gainXp(4);
        renderHotbar();
        return toast("Drank clean water. Glass returned.");
      }
      if (st.timer <= 0 && state.resources.glass > 0) {
        state.resources.glass--;
        st.hasGlass = true;
        st.timer = WATER_TIME;
        st.maxTimer = WATER_TIME;
        st.ready = false;
        renderHotbar();
        return toast("Water maker is distilling.");
      }
      return toast("Need an empty glass.");
    }
    if (st.type === "plantPot") {
      if (st.ready) {
        st.ready = false;
        st.planted = false;
        addRes("tomato", 2);
        gainXp(5);
        return toast("Tomatoes harvested.");
      }
      if (st.timer <= 0 && state.resources.tomato > 0) {
        state.resources.tomato--;
        st.planted = true;
        st.ready = false;
        st.timer = TOMATO_GROW_TIME;
        st.maxTimer = TOMATO_GROW_TIME;
        return toast("Tomato planted.");
      }
      if (st.timer > 0) return toast("Tomatoes are still growing.");
      return toast("Need a tomato to plant.");
    }
    if (st.type === "chest") {
      return toast("Chest placed. Supplies stay safe inside.");
    }
  }

  function craft(name, holdAfterCraft = false) {
    if (!gameStarted) return false;
    if (!spendStamina(3)) return false;
    const recipe = recipes[name];
    if (!recipe) return false;
    for (const [res, qty] of Object.entries(recipe)) {
      if ((state.resources[res] || 0) < qty) {
        toast(`Need ${qty} ${res}.`);
        return false;
      }
    }
    for (const [res, qty] of Object.entries(recipe)) state.resources[res] -= qty;
    if (name === "bandage") {
      addRes("bandage", 1);
      toast("Bandage crafted.");
    } else if (name === "spear") {
      hotbar[3].name = "Pig Spear";
      if (holdAfterCraft) selectHeldTool("spear");
      toast("Pig Spear crafted. Longer reach unlocked.");
    } else {
      pendingBuild[name] = (pendingBuild[name] || 0) + 1;
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
      if (buildChoice === "bandage") {
        if (craft("bandage", false)) toast("Bandage crafted into inventory.");
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
    if (state.structures.some((s) => footprintsOverlap(candidate, s))) return toast("That spot is occupied.");
    state.structures.push(candidate);
    consumeBuild(buildChoice);
    toast(`${label(buildChoice)} placed.`);
    gainXp(8);
  }

  function ensureBuildReady(name) {
    if ((pendingBuild[name] || 0) > 0) return true;
    if (!canAfford(name)) {
      toast(`${label(name)} selected. Need ${recipeText(name)} to craft it.`);
      return false;
    }
    for (const [res, qty] of Object.entries(recipes[name])) state.resources[res] -= qty;
    pendingBuild[name] = (pendingBuild[name] || 0) + 1;
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
    return { type, x, y, angle, base, hp: maxHp, maxHp, timer: 0, maxTimer: 0, ready: false, hasGlass: false, planted: false, aimOffset: 0, cooldown: 0 };
  }

  function footprint(type) {
    return blockFootprints[type] || { w: STRUCTURE_RADIUS * 2, h: STRUCTURE_RADIUS * 2 };
  }

  function footprintRadius(type) {
    const f = footprint(type);
    return Math.hypot(f.w, f.h) / 2;
  }

  function footprintsOverlap(a, b) {
    const aCorners = footprintCorners(a);
    const bCorners = footprintCorners(b);
    const axes = [...rectAxes(aCorners), ...rectAxes(bCorners)];
    return axes.every((axis) => projectionsOverlap(projectCorners(aCorners, axis), projectCorners(bCorners, axis)));
  }

  function footprintCorners(obj) {
    const f = footprint(obj.type);
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
    pendingBuild[name] = Math.max(0, (pendingBuild[name] || 0) - 1);
    if (!pendingBuild[name]) {
      const next = Object.keys(pendingBuild).find((key) => pendingBuild[key] > 0);
      if (next) buildChoice = next;
      else buildMode = false;
    }
    renderRecipes();
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
    selected = 6;
    buildMode = false;
    heldItem = selectedFood;
    renderHotbar();
    toast(`Food selected: ${label(selectedFood)}.`);
  }

  function buildSiteAt(x, y) {
    const radius = footprintRadius(buildChoice);
    const rt = raftAt(x, y);
    if (rt) {
      const r = raftTileRect(rt);
      const raftPadding = Math.max(6, radius * 0.45);
      const fits = x > r.x + raftPadding && x < r.x + TILE - raftPadding && y > r.y + raftPadding && y < r.y + TILE - raftPadding;
      return fits ? { kind: "raft", tile: rt } : null;
    }
    const island = islandAt({ x, y });
    if (island && Math.hypot(x - island.x, y - island.y) < island.r * 0.9 - radius) return { kind: "island", island };
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
    if (state.resources.bandage <= 0) return toast("No bandages.");
    state.resources.bandage--;
    state.player.health = clamp(state.player.health + 35, 0, 100);
    toast("Bandage used.");
  }

  function eatFood() {
    if (!spendStamina(2)) return;
    const r = state.resources;
    const foods = selectedFood && r[selectedFood] > 0 ? [selectedFood] : availableFoods();
    for (const food of foods) {
      if (eatSpecificFood(food)) return;
    }
    toast("No food.");
  }

  function eatSpecificFood(food) {
    const r = state.resources;
    if (!["cookedFish", "cookedMeat", "rawFish", "tomato", "coconut"].includes(food)) return false;
    if ((r[food] || 0) <= 0) return false;
    r[food]--;
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
    if ((r[food] || 0) <= 0 && selectedFood === food) {
      selectedFood = null;
      heldItem = null;
    }
    renderHotbar();
    return true;
  }

  function drinkWater() {
    if (!spendStamina(2)) return;
    const wm = state.structures.find((s) => s.type === "waterMaker" && dist(s, state.player) < 64);
    if (wm) return operateStructure(wm);
    if (state.resources.coconut > 0) {
      state.resources.coconut--;
      state.player.thirst = clamp(state.player.thirst + 15, 0, 100);
      state.player.hunger = clamp(state.player.hunger + 8, 0, 100);
      recoverStamina(8);
      return toast("Coconut water. Nice.");
    }
    toast("Find a water maker or coconut.");
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
      fallenNameEl.textContent = p.name || playerName;
      document.getElementById("survived").textContent = state.day;
      gameOverEl.hidden = false;
    }
  }

  function addRes(name, qty) {
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
    for (const key of ["wood", "leaves", "scrap", "cloth", "rope", "glass", "rawFish", "cookedFish", "sharkMeat", "meat", "cookedMeat", "coconut", "tomato"]) {
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
      ctx.fillStyle = loot.type === "scrap" ? "#a9c3c8" : loot.type === "glass" ? "#9ae9ff" : "#d0ad62";
      if (loot.type === "rope") {
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
      ctx.fillStyle = "#b97538";
      roundRect(r.x + 2, r.y + 2, TILE - 4, TILE - 4, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(89,49,25,0.32)";
      ctx.fillRect(r.x + 7, r.y + 8, TILE - 14, 5);
      ctx.fillRect(r.x + 7, r.y + 22, TILE - 14, 5);
      ctx.fillRect(r.x + 7, r.y + 36, TILE - 14, 5);
      ctx.strokeStyle = rt.hp < 35 ? "#ff7482" : "rgba(255,255,255,0.16)";
      ctx.lineWidth = 2;
      roundRect(r.x + 2, r.y + 2, TILE - 4, TILE - 4, 5);
      ctx.stroke();
      if (rt.hp < rt.maxHp) healthBar(r.x + TILE / 2, r.y - 8, rt.hp / rt.maxHp, 38);
    }
  }

  function drawStructures() {
    for (const st of state.structures) {
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.angle || 0);
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
        if (st.hasGlass || st.ready) {
          ctx.fillStyle = "rgba(215, 250, 255, 0.72)";
          roundRect(8, -16, 9, 16, 3);
          ctx.fill();
          ctx.fillStyle = st.ready ? "#75d7ff" : "#245e6d";
          ctx.fillRect(10, st.ready ? -11 : -6, 5, st.ready ? 9 : 4);
        }
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
      ctx.restore();
      if (st.hp < st.maxHp) healthBar(st.x, st.y - 30, st.hp / st.maxHp, 36);
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
    for (const shot of state.projectiles) {
      if (shot.type !== "cannonball") continue;
      const a = Math.atan2(shot.vy, shot.vx);
      ctx.save();
      ctx.translate(shot.x, shot.y);
      ctx.rotate(a);
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

  function drawPlayer() {
    const p = state.player;
    const moving = keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD");
    const handSwing = moving ? Math.sin(waveTime * 10) * 5 : Math.sin(waveTime * 3) * 1.5;
    const item = hotbar[selected].id;
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
    } else if (item === "food") {
      const food = selectedFood || availableFoods()[0];
      if (food) drawHeldResourceItem(food);
    } else if (hotbarResource(item) || availableFoods().includes(item)) {
      drawHeldResourceItem(item);
    } else if (item === "spear") {
      drawHeldSpear();
    } else if (item === "axe") {
      drawHeldAxe();
    } else if (item === "hammer") {
      drawHeldHammer();
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

  function drawHeldSpear() {
    const jab = swingCurve("spear") * 26;
    ctx.save();
    ctx.translate(jab, 0);
    ctx.strokeStyle = "#d4bd82";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.lineTo(58, -8);
    ctx.stroke();
    ctx.fillStyle = "#b7ccd0";
    ctx.beginPath();
    ctx.moveTo(68, -8);
    ctx.lineTo(55, -15);
    ctx.lineTo(55, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHeldAxe() {
    const swing = swingCurve("axe");
    ctx.save();
    ctx.translate(15, -4);
    ctx.rotate(-0.55 + swing * 1.55);
    ctx.strokeStyle = "#8b5b35";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.lineTo(39, -8);
    ctx.stroke();
    ctx.fillStyle = "#c3d1d6";
    roundRect(34, -18, 16, 18, 4);
    ctx.fill();
    ctx.fillStyle = "#eef6f8";
    ctx.beginPath();
    ctx.moveTo(47, -19);
    ctx.lineTo(58, -11);
    ctx.lineTo(48, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHeldHammer() {
    const swing = swingCurve("hammer");
    ctx.save();
    ctx.translate(15, 4);
    ctx.rotate(0.5 - swing * 1.45);
    ctx.strokeStyle = "#7a5133";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.lineTo(38, 9);
    ctx.stroke();
    ctx.fillStyle = "#9aaab0";
    roundRect(33, 0, 24, 14, 4);
    ctx.fill();
    ctx.fillStyle = "#cad5d8";
    ctx.fillRect(38, 1, 5, 12);
    ctx.restore();
  }

  function drawHeldBuildItem() {
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
      cloth: "#e4e1cf",
      rope: "#d0ad62",
      glass: "#9ae9ff",
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
    return {
      raft: "Raft Tile",
      grill: "Grill",
      waterMaker: "Water Maker",
      plantPot: "Plant Pot",
      chest: "Chest",
      wall: "Wall",
      torch: "Torch",
      cannon: "Cannon",
      sharkMeat: "Raw Shark Meat",
      meat: "Raw Meat",
      cookedMeat: "Cooked Meat"
    }[s] || cap(s);
  }
})();
