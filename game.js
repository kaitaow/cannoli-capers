/**
 * Cannoli Capers — original cartoon gangster run-and-gun
 * Polished indie visuals · offline HTML5 canvas · no stolen assets
 */
(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // Crisp text on HiDPI (CSS handles displayed size)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  // ─── Input ───────────────────────────────────────────────
  const keys = Object.create(null);
  let mouseDown = false;
  let mouseAimX = W / 2;
  let mouseAimY = H / 2;
  let mouseClickX = 0;
  let mouseClickY = 0;
  let mouseClicked = false;

  const uiButtons = []; // {id,x,y,w,h} rebuilt each overlay draw

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (e.code === "KeyP") togglePause();
    if (e.code === "KeyR" && (state === "gameover" || state === "win" || state === "paused")) startGame();
    if ((e.code === "Enter" || e.code === "Space") && (state === "menu" || state === "gameover" || state === "win")) startGame();
    if (e.code === "Enter" && state === "paused") { state = "playing"; }
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    updateMouse(e);
    mouseClickX = mouseAimX;
    mouseClickY = mouseAimY;
    mouseClicked = true;
    handleUiClick(mouseAimX, mouseAimY);
  });
  window.addEventListener("mouseup", () => { mouseDown = false; });
  canvas.addEventListener("mousemove", updateMouse);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function updateMouse(e) {
    const r = canvas.getBoundingClientRect();
    mouseAimX = ((e.clientX - r.left) / r.width) * W;
    mouseAimY = ((e.clientY - r.top) / r.height) * H;
  }

  function handleUiClick(x, y) {
    for (const b of uiButtons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.id === "start" || b.id === "retry" || b.id === "again") startGame();
        if (b.id === "resume") state = "playing";
        if (b.id === "menu") { state = "menu"; cameraX = 0; }
        return;
      }
    }
    // fallback: whole screen on menu/end screens
    if (state === "menu" || state === "gameover" || state === "win") startGame();
  }

  // ─── Helpers ─────────────────────────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

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

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ─── State ───────────────────────────────────────────────
  let state = "menu";
  let score = 0;
  let displayScore = 0;
  let scorePop = 0;
  let levelIndex = 0;
  let cameraX = 0;
  let shake = 0;
  let animT = 0;
  let particles = [];
  let bullets = [];
  let enemyBullets = [];
  let pickups = [];
  let enemies = [];
  let platforms = [];
  let props = [];
  let levelWidth = 3200;
  let levelGoalX = 3000;
  let waveTimer = 0;
  let titlePulse = 0;
  let messageFlash = "";
  let messageTimer = 0;
  let bannerTimer = 0;
  let bannerText = "";
  let vignettePulse = 0;
  let menuIdle = 0;

  const player = {
    x: 120, y: 300, w: 28, h: 46,
    vx: 0, vy: 0,
    facing: 1,
    onGround: false,
    wasOnGround: false,
    hp: 100, maxHp: 100,
    lives: 3,
    invuln: 0,
    shootCD: 0,
    fireRate: 0.14,
    jumpPower: -520,
    speed: 260,
    coyote: 0,
    anim: 0,
    dead: false,
    muzzle: 0,
    shootPose: 0,
    hurtFlash: 0,
  };

  // ─── Level data ──────────────────────────────────────────
  const LEVELS = [
    {
      name: "Dockside Dust-Up",
      width: 3400,
      goal: 3180,
      skyTop: "#0e1a2e",
      skyMid: "#1e2a3a",
      skyBot: "#3a2a28",
      fog: "rgba(40,60,90,0.15)",
      accent: "#c9a227",
      neon: false,
      platforms: [
        { x: 0, y: 480, w: 900, h: 60 },
        { x: 980, y: 480, w: 700, h: 60 },
        { x: 1800, y: 480, w: 1600, h: 60 },
        { x: 200, y: 380, w: 140, h: 18 },
        { x: 420, y: 320, w: 120, h: 18 },
        { x: 700, y: 360, w: 160, h: 18 },
        { x: 1100, y: 360, w: 140, h: 18 },
        { x: 1300, y: 280, w: 180, h: 18 },
        { x: 1550, y: 380, w: 120, h: 18 },
        { x: 2000, y: 380, w: 160, h: 18 },
        { x: 2250, y: 300, w: 200, h: 18 },
        { x: 2550, y: 360, w: 140, h: 18 },
        { x: 2800, y: 300, w: 180, h: 18 },
      ],
      props: [
        { kind: "crate", x: 160, y: 448 },
        { kind: "crate", x: 196, y: 448 },
        { kind: "barrel", x: 640, y: 448 },
        { kind: "crate", x: 1120, y: 448 },
        { kind: "barrel", x: 1500, y: 448 },
        { kind: "sign", x: 820, y: 400, text: "DOCK 9", color: "#d4af37" },
        { kind: "crate", x: 2100, y: 448 },
        { kind: "barrel", x: 2400, y: 448 },
        { kind: "crate", x: 2680, y: 448 },
        { kind: "lamp", x: 400, y: 480 },
        { kind: "lamp", x: 1600, y: 480 },
        { kind: "lamp", x: 2600, y: 480 },
      ],
      spawns: [
        { type: "thug", x: 500, y: 400 },
        { type: "thug", x: 750, y: 300 },
        { type: "runner", x: 1050, y: 400 },
        { type: "thug", x: 1200, y: 300 },
        { type: "brute", x: 1450, y: 400 },
        { type: "thug", x: 1700, y: 400 },
        { type: "runner", x: 1950, y: 300 },
        { type: "thug", x: 2150, y: 400 },
        { type: "shooter", x: 2350, y: 240 },
        { type: "thug", x: 2500, y: 400 },
        { type: "brute", x: 2700, y: 400 },
        { type: "shooter", x: 2900, y: 240 },
        { type: "thug", x: 3000, y: 400 },
      ],
    },
    {
      name: "Speakeasy Showdown",
      width: 3800,
      goal: 3550,
      skyTop: "#100818",
      skyMid: "#1a1024",
      skyBot: "#2a1420",
      fog: "rgba(90,30,70,0.12)",
      accent: "#ff4d8d",
      neon: true,
      platforms: [
        { x: 0, y: 480, w: 600, h: 60 },
        { x: 700, y: 480, w: 500, h: 60 },
        { x: 1300, y: 480, w: 800, h: 60 },
        { x: 2200, y: 480, w: 1600, h: 60 },
        { x: 150, y: 360, w: 120, h: 18 },
        { x: 350, y: 280, w: 140, h: 18 },
        { x: 550, y: 340, w: 100, h: 18 },
        { x: 850, y: 360, w: 160, h: 18 },
        { x: 1050, y: 260, w: 180, h: 18 },
        { x: 1400, y: 360, w: 140, h: 18 },
        { x: 1600, y: 280, w: 200, h: 18 },
        { x: 1850, y: 360, w: 120, h: 18 },
        { x: 2100, y: 300, w: 160, h: 18 },
        { x: 2400, y: 380, w: 140, h: 18 },
        { x: 2600, y: 280, w: 220, h: 18 },
        { x: 2900, y: 360, w: 160, h: 18 },
        { x: 3150, y: 280, w: 200, h: 18 },
        { x: 3400, y: 360, w: 180, h: 18 },
      ],
      props: [
        { kind: "barrel", x: 80, y: 448 },
        { kind: "crate", x: 280, y: 448 },
        { kind: "sign", x: 480, y: 400, text: "OPEN", color: "#ff4d8d" },
        { kind: "neon", x: 1000, y: 380, text: "SPEAKEASY", color: "#5ce1ff" },
        { kind: "crate", x: 1450, y: 448 },
        { kind: "barrel", x: 1750, y: 448 },
        { kind: "neon", x: 2300, y: 400, text: "JAZZ", color: "#ff4d8d" },
        { kind: "crate", x: 2500, y: 448 },
        { kind: "barrel", x: 2800, y: 448 },
        { kind: "sign", x: 3300, y: 320, text: "VIP", color: "#d4af37" },
        { kind: "lamp", x: 300, y: 480 },
        { kind: "lamp", x: 1500, y: 480 },
        { kind: "lamp", x: 2700, y: 480 },
        { kind: "lamp", x: 3400, y: 480 },
      ],
      spawns: [
        { type: "thug", x: 400, y: 400 },
        { type: "runner", x: 550, y: 280 },
        { type: "shooter", x: 900, y: 300 },
        { type: "thug", x: 1100, y: 200 },
        { type: "brute", x: 1350, y: 400 },
        { type: "runner", x: 1550, y: 220 },
        { type: "shooter", x: 1700, y: 220 },
        { type: "thug", x: 1900, y: 400 },
        { type: "thug", x: 2100, y: 240 },
        { type: "brute", x: 2350, y: 400 },
        { type: "runner", x: 2500, y: 300 },
        { type: "shooter", x: 2700, y: 220 },
        { type: "thug", x: 2950, y: 300 },
        { type: "brute", x: 3200, y: 220 },
        { type: "shooter", x: 3350, y: 300 },
        { type: "boss", x: 3500, y: 400 },
      ],
    },
  ];

  function makeEnemy(type, x, y) {
    const base = {
      type, x, y, vx: 0, vy: 0, facing: -1,
      onGround: false, dead: false, hurtT: 0, shootCD: 0, anim: 0,
      aiTimer: rand(0.3, 1.2), muzzle: 0,
    };
    switch (type) {
      case "thug":
        return Object.assign(base, { w: 26, h: 42, hp: 30, maxHp: 30, speed: 90, points: 100, color: "#3d5a7a", accent: "#2a3f55" });
      case "runner":
        return Object.assign(base, { w: 22, h: 36, hp: 18, maxHp: 18, speed: 180, points: 150, color: "#4a7a3a", accent: "#2f5528" });
      case "shooter":
        return Object.assign(base, { w: 26, h: 42, hp: 25, maxHp: 25, speed: 60, points: 200, color: "#7a3a5a", accent: "#552840", fireRate: 1.1 });
      case "brute":
        return Object.assign(base, { w: 40, h: 52, hp: 80, maxHp: 80, speed: 55, points: 300, color: "#6a4a32", accent: "#4a3220" });
      case "boss":
        return Object.assign(base, { w: 48, h: 60, hp: 220, maxHp: 220, speed: 70, points: 1000, color: "#8a2228", accent: "#5a1218", fireRate: 0.55 });
      default:
        return Object.assign(base, { w: 26, h: 42, hp: 30, maxHp: 30, speed: 90, points: 100, color: "#3d5a7a", accent: "#2a3f55" });
    }
  }

  // ─── Particles ───────────────────────────────────────────
  function splat(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(80, 380);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(60, 200),
        life: rand(0.4, 1.0), maxLife: 1.0,
        size: rand(2.5, 8), color: color || (chance(0.65) ? "#c02828" : "#8a1414"),
        g: 980, kind: "blood",
      });
    }
  }

  function spark(x, y, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y, vx: rand(-240, 240), vy: rand(-240, 100),
        life: rand(0.12, 0.35), maxLife: 0.35,
        size: rand(1.5, 4), color: chance(0.5) ? "#ffd76a" : "#fff6c8",
        g: 180, kind: "spark",
      });
    }
  }

  function puff(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: x + rand(-10, 10), y: y + rand(-6, 6),
        vx: rand(-50, 50), vy: rand(-70, -8),
        life: rand(0.35, 0.8), maxLife: 0.8,
        size: rand(5, 14), color: color || "rgba(190,170,130,0.45)",
        g: -30, kind: "dust",
      });
    }
  }

  function casing(x, y, facing) {
    particles.push({
      x, y,
      vx: -facing * rand(80, 160) + rand(-20, 20),
      vy: rand(-220, -120),
      life: 0.7, maxLife: 0.7,
      size: 3, color: "#c9a227",
      g: 900, kind: "casing", rot: rand(0, 6), spin: rand(-12, 12),
    });
  }

  function starBurst(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      particles.push({
        x, y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
        life: 0.5, maxLife: 0.5, size: 3, color: "#ffe08a", g: 0, kind: "spark",
      });
    }
  }

  // ─── Game flow ───────────────────────────────────────────
  function startGame() {
    score = 0;
    displayScore = 0;
    scorePop = 0;
    levelIndex = 0;
    player.lives = 3;
    player.hp = player.maxHp;
    player.dead = false;
    loadLevel(0);
    state = "playing";
  }

  function loadLevel(idx) {
    levelIndex = idx;
    const L = LEVELS[idx];
    levelWidth = L.width;
    levelGoalX = L.goal;
    platforms = L.platforms.map((p) => ({ ...p }));
    props = (L.props || []).map((p) => ({ ...p }));
    enemies = L.spawns.map((s) => makeEnemy(s.type, s.x, s.y));
    bullets = [];
    enemyBullets = [];
    pickups = [];
    particles = [];
    cameraX = 0;
    shake = 0;
    waveTimer = 0;
    bannerText = L.name;
    bannerTimer = 2.8;
    messageFlash = "";
    messageTimer = 0;
    Object.assign(player, {
      x: 80, y: 300, vx: 0, vy: 0, facing: 1,
      onGround: false, wasOnGround: false, invuln: 1.2, shootCD: 0,
      dead: false, anim: 0, muzzle: 0, shootPose: 0, hurtFlash: 0,
      hp: Math.min(player.hp + 25, player.maxHp),
    });
  }

  function nextLevel() {
    if (levelIndex + 1 >= LEVELS.length) {
      state = "win";
      starBurst(W / 2, H / 2);
      return;
    }
    loadLevel(levelIndex + 1);
  }

  function togglePause() {
    if (state === "playing") state = "paused";
    else if (state === "paused") state = "playing";
  }

  function addScore(n) {
    score += n;
    scorePop = 1;
  }

  function killPlayer() {
    if (player.dead) return;
    player.dead = true;
    splat(player.x + player.w / 2, player.y + player.h / 2, 32);
    shake = 16;
    player.lives -= 1;
    if (player.lives <= 0) {
      setTimeout(() => { if (state === "playing") state = "gameover"; }, 1000);
    } else {
      setTimeout(() => {
        if (state !== "playing") return;
        player.dead = false;
        player.hp = player.maxHp;
        player.x = Math.max(40, cameraX + 80);
        player.y = 200;
        player.vx = 0;
        player.vy = 0;
        player.invuln = 2;
      }, 1000);
    }
  }

  function hurtPlayer(dmg) {
    if (player.invuln > 0 || player.dead) return;
    player.hp -= dmg;
    player.invuln = 0.7;
    player.hurtFlash = 0.25;
    shake = 10;
    vignettePulse = 0.5;
    splat(player.x + player.w / 2, player.y + player.h / 2, 10);
    if (player.hp <= 0) {
      player.hp = 0;
      killPlayer();
    }
  }

  // ─── Physics ─────────────────────────────────────────────
  function collidePlatforms(ent, dt) {
    ent.onGround = false;
    ent.x += ent.vx * dt;
    for (const p of platforms) {
      if (rectsOverlap(ent, p)) {
        if (ent.vx > 0) ent.x = p.x - ent.w;
        else if (ent.vx < 0) ent.x = p.x + p.w;
        ent.vx = 0;
      }
    }
    ent.vy += 1600 * dt;
    ent.y += ent.vy * dt;
    for (const p of platforms) {
      if (rectsOverlap(ent, p)) {
        if (ent.vy > 0 && ent.y + ent.h - ent.vy * dt <= p.y + 4) {
          ent.y = p.y - ent.h;
          ent.vy = 0;
          ent.onGround = true;
        } else if (ent.vy < 0) {
          ent.y = p.y + p.h;
          ent.vy = 0;
        } else {
          if (ent.x + ent.w / 2 < p.x + p.w / 2) ent.x = p.x - ent.w;
          else ent.x = p.x + p.w;
        }
      }
    }
    if (ent.y > H + 80) {
      if (ent === player) {
        if (!player.dead) { ent.hp = 0; killPlayer(); }
      } else ent.dead = true;
    }
  }

  // ─── Update ──────────────────────────────────────────────
  function update(dt) {
    titlePulse += dt;
    animT += dt;
    menuIdle += dt;
    if (messageTimer > 0) messageTimer -= dt;
    if (bannerTimer > 0) bannerTimer -= dt;
    if (scorePop > 0) scorePop = Math.max(0, scorePop - dt * 3);
    if (vignettePulse > 0) vignettePulse = Math.max(0, vignettePulse - dt);
    displayScore += (score - displayScore) * Math.min(1, dt * 10);
    if (Math.abs(score - displayScore) < 1) displayScore = score;

    // idle particles on menu
    if (state === "menu" && chance(0.08)) {
      particles.push({
        x: rand(0, W), y: H + 10, vx: rand(-10, 10), vy: rand(-40, -15),
        life: rand(2, 4), maxLife: 4, size: rand(1, 2.5),
        color: "rgba(212,175,55,0.35)", g: -5, kind: "spark",
      });
    }

    updateParticles(dt);

    if (state !== "playing") return;
    if (player.dead) return;

    let mx = 0;
    if (keys["KeyA"] || keys["ArrowLeft"]) mx -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) mx += 1;
    player.vx = mx * player.speed;
    if (mx !== 0) player.facing = mx > 0 ? 1 : -1;

    player.wasOnGround = player.onGround;
    if (player.onGround) player.coyote = 0.12;
    else player.coyote = Math.max(0, player.coyote - dt);

    const jumpPressed = keys["KeyW"] || keys["ArrowUp"] || keys["KeyZ"];
    if (jumpPressed && player.coyote > 0 && player.vy >= -40) {
      player.vy = player.jumpPower;
      player.onGround = false;
      player.coyote = 0;
      puff(player.x + player.w / 2, player.y + player.h, 5);
    }

    collidePlatforms(player, dt);
    player.x = clamp(player.x, 0, levelWidth - player.w);

    // land dust
    if (player.onGround && !player.wasOnGround && player.vy >= 0) {
      puff(player.x + player.w / 2, player.y + player.h, 8, "rgba(180,160,120,0.5)");
    }

    if (player.invuln > 0) player.invuln -= dt;
    if (player.shootCD > 0) player.shootCD -= dt;
    if (player.muzzle > 0) player.muzzle -= dt;
    if (player.shootPose > 0) player.shootPose -= dt;
    if (player.hurtFlash > 0) player.hurtFlash -= dt;
    player.anim += Math.abs(player.vx) * dt * 0.025 + dt * 2;

    const wantShoot = keys["Space"] || mouseDown;
    if (wantShoot && player.shootCD <= 0) {
      player.shootCD = player.fireRate;
      player.muzzle = 0.08;
      player.shootPose = 0.15;
      const bx = player.x + player.w / 2 + player.facing * 20;
      const by = player.y + 16;
      if (mouseDown) {
        const wx = mouseAimX + cameraX;
        const wy = mouseAimY;
        const dx = wx - bx;
        const dy = wy - by;
        const len = Math.hypot(dx, dy) || 1;
        bullets.push({
          x: bx, y: by, vx: (dx / len) * 640, vy: (dy / len) * 640,
          life: 1.2, r: 4, trail: [],
        });
        if (dx !== 0) player.facing = dx > 0 ? 1 : -1;
      } else {
        bullets.push({
          x: bx, y: by, vx: player.facing * 640, vy: rand(-20, 20),
          life: 1.2, r: 4, trail: [],
        });
      }
      spark(bx + player.facing * 8, by, 5);
      casing(bx - player.facing * 6, by - 4, player.facing);
      shake = Math.max(shake, 2.5);
    }

    const targetCam = player.x - W * 0.35;
    cameraX += (targetCam - cameraX) * Math.min(1, dt * 6);
    cameraX = clamp(cameraX, 0, Math.max(0, levelWidth - W));
    if (shake > 0) shake = Math.max(0, shake - dt * 28);

    // enemies
    for (const e of enemies) {
      if (e.dead) continue;
      e.anim += dt * 3;
      if (e.hurtT > 0) e.hurtT -= dt;
      if (e.muzzle > 0) e.muzzle -= dt;
      e.aiTimer -= dt;
      const dx = player.x - e.x;
      const see = Math.abs(dx) < 520 && Math.abs(player.y - e.y) < 180;

      if (e.type === "thug" || e.type === "runner" || e.type === "brute") {
        if (see) {
          e.facing = dx > 0 ? 1 : -1;
          e.vx = e.facing * e.speed;
          if (e.aiTimer <= 0 && e.onGround && Math.abs(dx) > 40) {
            if (chance(0.35)) e.vy = -380 - (e.type === "brute" ? 40 : 0);
            e.aiTimer = rand(0.6, 1.4);
          }
        } else if (e.aiTimer <= 0) {
          e.facing *= chance(0.5) ? -1 : 1;
          e.vx = e.facing * e.speed * 0.5;
          e.aiTimer = rand(0.8, 2);
        }
        if (rectsOverlap(player, e) && player.invuln <= 0) {
          hurtPlayer(e.type === "brute" ? 22 : e.type === "runner" ? 12 : 15);
          player.vx += e.facing * 200;
        }
      }

      if (e.type === "shooter" || e.type === "boss") {
        if (see) {
          e.facing = dx > 0 ? 1 : -1;
          if (Math.abs(dx) < 180) e.vx = -e.facing * e.speed;
          else if (Math.abs(dx) > 320) e.vx = e.facing * e.speed * 0.7;
          else e.vx = 0;
          e.shootCD = (e.shootCD || 0) - dt;
          if (e.shootCD <= 0) {
            e.shootCD = e.fireRate || 1;
            e.muzzle = 0.1;
            const bx = e.x + e.w / 2 + e.facing * 14;
            const by = e.y + 16;
            const ang = Math.atan2(player.y + 20 - by, player.x + 14 - bx);
            const spd = e.type === "boss" ? 340 : 280;
            enemyBullets.push({ x: bx, y: by, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 2.5, r: e.type === "boss" ? 6 : 4 });
            spark(bx, by, 3);
            if (e.type === "boss" && chance(0.5)) {
              for (const off of [-0.25, 0.25]) {
                enemyBullets.push({
                  x: bx, y: by,
                  vx: Math.cos(ang + off) * spd * 0.9,
                  vy: Math.sin(ang + off) * spd * 0.9,
                  life: 2.2, r: 5,
                });
              }
              shake = Math.max(shake, 6);
            }
          }
        } else e.vx *= 0.9;
        if (rectsOverlap(player, e) && player.invuln <= 0) {
          hurtPlayer(e.type === "boss" ? 28 : 14);
        }
      }
      collidePlatforms(e, dt);
    }
    enemies = enemies.filter((e) => !e.dead);

    for (const b of bullets) {
      if (!b.trail) b.trail = [];
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 6) b.trail.shift();
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const e of enemies) {
        if (e.dead) continue;
        if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          b.life = 0;
          e.hp -= 12;
          e.hurtT = 0.15;
          e.vx += Math.sign(b.vx) * 40;
          spark(b.x, b.y, 5);
          splat(b.x, b.y, 6);
          if (e.hp <= 0) {
            e.dead = true;
            addScore(e.points);
            splat(e.x + e.w / 2, e.y + e.h / 2, 24 + (e.type === "boss" ? 36 : 0));
            puff(e.x + e.w / 2, e.y + e.h / 2, 10);
            shake = Math.max(shake, e.type === "boss" ? 18 : 8);
            if (e.type === "boss") vignettePulse = 0.6;
            if (chance(0.35) || e.type === "boss") {
              pickups.push({
                x: e.x + e.w / 2 - 8, y: e.y + 10, w: 16, h: 16,
                kind: chance(0.5) ? "health" : "score", bob: 0,
              });
            }
          }
          break;
        }
      }
      for (const p of platforms) {
        if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) {
          b.life = 0;
          spark(b.x, b.y, 3);
        }
      }
    }
    bullets = bullets.filter((b) => b.life > 0 && b.x > cameraX - 40 && b.x < cameraX + W + 40);

    for (const b of enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.x > player.x && b.x < player.x + player.w && b.y > player.y && b.y < player.y + player.h) {
        b.life = 0;
        hurtPlayer(b.r > 5 ? 18 : 12);
        spark(b.x, b.y, 6);
      }
      for (const p of platforms) {
        if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) b.life = 0;
      }
    }
    enemyBullets = enemyBullets.filter((b) => b.life > 0);

    for (const p of pickups) {
      p.bob += dt * 4;
      p.y += Math.sin(p.bob) * 0.15;
      if (rectsOverlap(player, p)) {
        p.dead = true;
        if (p.kind === "health") {
          player.hp = Math.min(player.maxHp, player.hp + 28);
          messageFlash = "+HEALTH";
          messageTimer = 0.9;
        } else {
          addScore(50);
          messageFlash = "+50";
          messageTimer = 0.7;
        }
        spark(p.x + 8, p.y + 8, 10);
      }
    }
    pickups = pickups.filter((p) => !p.dead);

    if (player.x + player.w >= levelGoalX) {
      const alive = enemies.filter((e) => !e.dead).length;
      if (alive <= 2 || levelIndex === 0) {
        addScore(500);
        nextLevel();
      } else {
        messageFlash = "CLEAR THE MOB!";
        messageTimer = 1;
      }
    }

    if (enemies.length === 0 && player.x < levelGoalX - 200) {
      waveTimer += dt;
      if (waveTimer > 2.5) {
        waveTimer = 0;
        const types = ["thug", "runner", "shooter"];
        for (let i = 0; i < 3; i++) {
          enemies.push(makeEnemy(types[i % types.length], player.x + 400 + i * 120, 200));
        }
        messageFlash = "MORE GOONS!";
        messageTimer = 1.2;
      }
    }

    mouseClicked = false;
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vx *= 0.985;
      if (p.kind === "casing") p.rot = (p.rot || 0) + (p.spin || 0) * dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  // ─── Draw ────────────────────────────────────────────────
  function draw() {
    uiButtons.length = 0;
    const L = LEVELS[levelIndex] || LEVELS[0];
    if (state === "menu") cameraX = 0;
    const sx = shake > 0 ? rand(-shake, shake) : 0;
    const sy = shake > 0 ? rand(-shake, shake) : 0;

    ctx.save();
    ctx.translate(sx, sy);

    drawSky(L);
    drawParallaxFar(L);
    ctx.translate(-Math.floor(cameraX), 0);
    drawCityscape(L);
    drawParallaxNear(L);
    drawPlatforms(L);
    drawProps(L);
    drawGoal(L);
    drawPickups();
    for (const e of enemies) drawEnemy(e);
    if (!player.dead || Math.floor(animT * 12) % 2 === 0) {
      if (state !== "menu") drawPlayer();
    }
    drawBullets();
    drawParticlesWorld();
    ctx.restore();

    // screen-space particles (menu sparkles etc that used screen coords)
    drawParticlesScreen();

    drawVignette();
    if (state === "playing" || state === "paused") drawHUD(L);
    if (state === "menu") drawMenu();
    else if (state === "paused") drawPanel("PAUSED", "Take five, capo.", [
      { id: "resume", label: "RESUME", primary: true },
      { id: "retry", label: "RESTART" },
    ]);
    else if (state === "gameover") drawPanel("WHACKED!", `Score  ${Math.floor(displayScore)}`, [
      { id: "retry", label: "TRY AGAIN", primary: true },
      { id: "menu", label: "TITLE" },
    ]);
    else if (state === "win") drawPanel("CITY'S YOURS!", `Final Score  ${Math.floor(displayScore)}`, [
      { id: "again", label: "PLAY AGAIN", primary: true },
      { id: "menu", label: "TITLE" },
    ]);

    if (bannerTimer > 0 && state === "playing") drawLevelBanner();
    if (messageTimer > 0 && state === "playing") {
      ctx.save();
      ctx.globalAlpha = Math.min(1, messageTimer * 2);
      ctx.font = "700 26px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#0a0608";
      ctx.fillText(messageFlash, W / 2 + 2, 118);
      ctx.fillStyle = "#ffe08a";
      ctx.fillText(messageFlash, W / 2, 116);
      ctx.restore();
    }
  }

  function drawSky(L) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, L.skyTop);
    g.addColorStop(0.45, L.skyMid);
    g.addColorStop(1, L.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // stars
    ctx.fillStyle = "rgba(255,240,200,0.55)";
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97 + 13) % W);
      const y = ((i * 53 + 29) % 200);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(animT * 2 + i));
      ctx.globalAlpha = tw * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, i % 5 === 0 ? 1.6 : 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // moon / neon glow orb
    if (L.neon) {
      const glow = ctx.createRadialGradient(W - 140, 80, 5, W - 140, 80, 90);
      glow.addColorStop(0, "rgba(255,77,141,0.35)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(W - 140, 80, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffb0c8";
      ctx.beginPath();
      ctx.arc(W - 140, 80, 26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#f2e6b8";
      ctx.beginPath();
      ctx.arc(W - 120, 70, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = L.skyTop;
      ctx.beginPath();
      ctx.arc(W - 106, 60, 24, 0, Math.PI * 2);
      ctx.fill();
      // moon glow
      const glow = ctx.createRadialGradient(W - 120, 70, 20, W - 120, 70, 80);
      glow.addColorStop(0, "rgba(242,230,184,0.15)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(W - 200, 0, 160, 150);
    }
  }

  function drawParallaxFar(L) {
    const off = cameraX * 0.12;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    for (let i = -1; i < 14; i++) {
      const x = i * 200 - (off % 200);
      const h = 50 + ((i * 41) % 90);
      ctx.beginPath();
      ctx.moveTo(x, H - 100);
      ctx.lineTo(x + 30, H - 100 - h);
      ctx.lineTo(x + 90, H - 100 - h * 0.7);
      ctx.lineTo(x + 150, H - 100 - h * 1.1);
      ctx.lineTo(x + 200, H - 100);
      ctx.fill();
    }
    if (L.fog) {
      ctx.fillStyle = L.fog;
      ctx.fillRect(0, H * 0.45, W, H * 0.55);
    }
  }

  function drawParallaxNear(L) {
    // water / street reflection strip
    const g = ctx.createLinearGradient(0, 470, 0, H);
    if (L.neon) {
      g.addColorStop(0, "rgba(40,10,30,0.0)");
      g.addColorStop(1, "rgba(60,15,40,0.35)");
    } else {
      g.addColorStop(0, "rgba(20,40,60,0.0)");
      g.addColorStop(1, "rgba(20,50,70,0.3)");
    }
    ctx.fillStyle = g;
    ctx.fillRect(cameraX - 20, 470, W + 40, H - 470);
  }

  function drawCityscape(L) {
    const start = Math.floor(cameraX / 170) - 1;
    const end = start + Math.ceil(W / 170) + 3;
    for (let i = start; i < end; i++) {
      const x = i * 170;
      const h = 100 + (Math.abs(Math.sin(i * 1.7)) * 110) | 0;
      const top = 480 - h;
      // building body
      const bg = ctx.createLinearGradient(x, top, x, 480);
      bg.addColorStop(0, i % 3 === 0 ? "#1a1218" : "#161018");
      bg.addColorStop(1, "#0c080c");
      ctx.fillStyle = bg;
      ctx.fillRect(x, top, 150, h);
      // roof ledge
      ctx.fillStyle = "#2a1e24";
      ctx.fillRect(x - 4, top - 6, 158, 8);
      // windows
      for (let wy = top + 14; wy < 460; wy += 24) {
        for (let wx = x + 14; wx < x + 130; wx += 22) {
          const lit = ((wx * 3 + wy * 7 + i * 11) % 11) > 3;
          if (!lit) continue;
          const flicker = 0.55 + 0.45 * Math.abs(Math.sin(animT * 1.5 + wx * 0.01));
          ctx.globalAlpha = flicker * (L.neon ? 0.7 : 0.45);
          ctx.fillStyle = L.neon
            ? (chance(0.01) ? "#ff4d8d" : "#ffd27a")
            : "#c9a04a";
          // deterministic lit color
          ctx.fillStyle = L.neon
            ? ((wx + wy) % 5 === 0 ? "#ff6aa8" : "#ffd27a")
            : "#d4b05a";
          ctx.fillRect(wx, wy, 10, 12);
          // pane
          ctx.globalAlpha = flicker * 0.15;
          ctx.fillStyle = "#fff";
          ctx.fillRect(wx, wy, 10, 4);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPlatforms(L) {
    for (const p of platforms) {
      const isGround = p.h > 30;
      // shadow under float
      if (!isGround) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(p.x + 4, p.y + p.h, p.w - 4, 6);
      }
      // body
      const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      g.addColorStop(0, "#6b4530");
      g.addColorStop(0.15, "#5a3a24");
      g.addColorStop(1, isGround ? "#2a1a10" : "#3a2414");
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // top highlight edge
      ctx.fillStyle = "#a07848";
      ctx.fillRect(p.x, p.y, p.w, 4);
      ctx.fillStyle = "#c9a06a";
      ctx.fillRect(p.x, p.y, p.w, 2);
      // plank lines
      ctx.strokeStyle = "rgba(30,16,8,0.45)";
      ctx.lineWidth = 1;
      for (let x = p.x + 24; x < p.x + p.w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, p.y + 2);
        ctx.lineTo(x, p.y + p.h);
        ctx.stroke();
      }
      // end caps
      ctx.fillStyle = "#8a6038";
      ctx.fillRect(p.x, p.y, 4, p.h);
      ctx.fillRect(p.x + p.w - 4, p.y, 4, p.h);
      // nails
      ctx.fillStyle = "#c9a227";
      for (let x = p.x + 12; x < p.x + p.w; x += 48) {
        ctx.beginPath();
        ctx.arc(x, p.y + 8, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (isGround) {
        // dirt / moss trim
        ctx.fillStyle = "#2f6a3a";
        for (let x = p.x; x < p.x + p.w; x += 14) {
          if (((x / 14) | 0) % 3 !== 0) ctx.fillRect(x, p.y + 5, 9, 3);
        }
        // brick-ish lower
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        for (let y = p.y + 16; y < p.y + p.h; y += 12) {
          ctx.beginPath();
          ctx.moveTo(p.x, y);
          ctx.lineTo(p.x + p.w, y);
          ctx.stroke();
        }
      }
    }
  }

  function drawProps(L) {
    for (const pr of props) {
      if (pr.kind === "crate") {
        ctx.fillStyle = "#7a5230";
        ctx.fillRect(pr.x, pr.y, 32, 32);
        ctx.fillStyle = "#9a6a3a";
        ctx.fillRect(pr.x, pr.y, 32, 4);
        ctx.strokeStyle = "#3a2410";
        ctx.strokeRect(pr.x + 0.5, pr.y + 0.5, 31, 31);
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x + 32, pr.y + 32);
        ctx.moveTo(pr.x + 32, pr.y);
        ctx.lineTo(pr.x, pr.y + 32);
        ctx.stroke();
        ctx.fillStyle = "#c9a227";
        ctx.fillRect(pr.x + 13, pr.y + 13, 6, 6);
      } else if (pr.kind === "barrel") {
        ctx.fillStyle = "#5a3a22";
        roundRect(pr.x, pr.y, 26, 32, 4);
        ctx.fill();
        ctx.strokeStyle = "#c9a227";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pr.x + 2, pr.y + 8);
        ctx.lineTo(pr.x + 24, pr.y + 8);
        ctx.moveTo(pr.x + 2, pr.y + 24);
        ctx.lineTo(pr.x + 24, pr.y + 24);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#3a2414";
        ctx.fillRect(pr.x + 8, pr.y + 12, 10, 8);
      } else if (pr.kind === "lamp") {
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(pr.x + 10, pr.y - 90, 4, 90);
        ctx.fillStyle = "#3a3a3a";
        ctx.fillRect(pr.x + 2, pr.y - 96, 20, 8);
        const glow = ctx.createRadialGradient(pr.x + 12, pr.y - 100, 2, pr.x + 12, pr.y - 100, 50);
        glow.addColorStop(0, L.neon ? "rgba(255,100,160,0.35)" : "rgba(255,200,100,0.3)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pr.x + 12, pr.y - 100, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = L.neon ? "#ff8ab0" : "#ffe08a";
        ctx.beginPath();
        ctx.arc(pr.x + 12, pr.y - 100, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.kind === "sign" || pr.kind === "neon") {
        const pulse = 0.7 + 0.3 * Math.sin(animT * (pr.kind === "neon" ? 5 : 2) + pr.x);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.font = "700 14px Outfit, sans-serif";
        ctx.textAlign = "center";
        const tw = ctx.measureText(pr.text).width + 20;
        const bx = pr.x - tw / 2;
        const by = pr.y - 18;
        // glow
        ctx.shadowColor = pr.color;
        ctx.shadowBlur = pr.kind === "neon" ? 18 : 8;
        roundRect(bx, by, tw, 28, 4);
        ctx.fillStyle = "rgba(10,6,10,0.85)";
        ctx.fill();
        ctx.strokeStyle = pr.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = pr.color;
        ctx.shadowBlur = 12;
        ctx.fillText(pr.text, pr.x, by + 19);
        ctx.restore();
        // pole
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(pr.x - 2, pr.y + 10, 4, 40);
      }
    }
  }

  function drawGoal(L) {
    const x = levelGoalX;
    const wave = Math.sin(animT * 3) * 3;
    // pole
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(x, 200, 8, 280);
    ctx.fillStyle = "#e8c84a";
    ctx.fillRect(x, 200, 3, 280);
    // flag
    ctx.beginPath();
    ctx.moveTo(x + 8, 205);
    ctx.lineTo(x + 72 + wave, 228);
    ctx.lineTo(x + 8, 255);
    ctx.closePath();
    const fg = ctx.createLinearGradient(x, 205, x + 70, 255);
    fg.addColorStop(0, L.accent || "#c9a227");
    fg.addColorStop(1, "#8a6020");
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.fillStyle = "#fff8d0";
    ctx.font = "700 11px Outfit, sans-serif";
    ctx.fillText("EXIT", x + 16, 236);
    // light pillar
    const glow = ctx.createLinearGradient(x - 20, 200, x + 40, 480);
    glow.addColorStop(0, "rgba(212,175,55,0.15)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 20, 200, 60, 280);
  }

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(animT * 22) % 2 === 0) return;

    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h);
    ctx.scale(p.facing, 1);

    const walking = p.onGround && Math.abs(p.vx) > 20;
    const bob = walking ? Math.sin(p.anim * 1.2) * 2 : (p.onGround ? 0 : 0);
    const legSwing = walking ? Math.sin(p.anim * 2.2) * 7 : 0;
    const armSwing = walking ? Math.sin(p.anim * 2.2) * 5 : 0;
    const recoil = p.shootPose > 0 ? -3 : 0;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 1, 15, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    ctx.fillStyle = "#1e2438";
    ctx.fillRect(-11, -18 + bob, 8, 16 + legSwing);
    ctx.fillRect(2, -18 + bob, 8, 16 - legSwing);
    // shoes
    ctx.fillStyle = "#0e0e14";
    ctx.fillRect(-12, -4 + bob + legSwing, 10, 4);
    ctx.fillRect(1, -4 + bob - legSwing, 10, 4);
    // shoe highlight
    ctx.fillStyle = "#3a3a48";
    ctx.fillRect(-11, -4 + bob + legSwing, 8, 1.5);

    // body suit
    const bodyG = ctx.createLinearGradient(-14, -42, 14, -18);
    bodyG.addColorStop(0, "#3a4a6a");
    bodyG.addColorStop(1, "#243048");
    ctx.fillStyle = bodyG;
    roundRect(-13, -42 + bob, 26, 26, 3);
    ctx.fill();
    // outline
    ctx.strokeStyle = "#121820";
    ctx.lineWidth = 1.5;
    roundRect(-13, -42 + bob, 26, 26, 3);
    ctx.stroke();
    // gold vest
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(-5, -40 + bob, 10, 20);
    ctx.fillStyle = "#f0d070";
    ctx.fillRect(-3, -39 + bob, 3, 18);
    // lapels
    ctx.fillStyle = "#2a3548";
    ctx.beginPath();
    ctx.moveTo(-13, -42 + bob);
    ctx.lineTo(-5, -36 + bob);
    ctx.lineTo(-13, -28 + bob);
    ctx.fill();

    // back arm
    ctx.fillStyle = "#3a4a6a";
    ctx.fillRect(-16, -38 + bob + armSwing * 0.3, 6, 14);

    // gun arm
    ctx.fillStyle = "#3a4a6a";
    ctx.fillRect(8 + recoil, -38 + bob, 12, 7);
    // hand
    ctx.fillStyle = "#e0b890";
    ctx.fillRect(18 + recoil, -37 + bob, 5, 5);
    // pistol
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(20 + recoil, -36 + bob, 16, 5);
    ctx.fillRect(32 + recoil, -39 + bob, 4, 9);
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(22 + recoil, -35 + bob, 3, 3);

    // muzzle flash
    if (p.muzzle > 0) {
      ctx.save();
      ctx.translate(38 + recoil, -34 + bob);
      ctx.fillStyle = "#fff6c0";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? 14 : 6;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
      ctx.fillStyle = "#ffaa40";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // head
    const skin = p.hurtFlash > 0 ? "#f0a0a0" : "#e8c4a0";
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -52 + bob, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b89070";
    ctx.lineWidth = 1;
    ctx.stroke();

    // fedora
    ctx.fillStyle = "#14101c";
    ctx.beginPath();
    ctx.ellipse(0, -58 + bob, 15, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-10, -68 + bob, 20, 11);
    // crown curve
    ctx.fillStyle = "#1c1624";
    ctx.fillRect(-9, -67 + bob, 18, 3);
    // band
    ctx.fillStyle = "#a01830";
    ctx.fillRect(-10, -58 + bob, 20, 3.5);
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(4, -58 + bob, 4, 3.5);

    // face
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(3, -54 + bob, 4.5, 3.5);
    // brow
    ctx.fillRect(1, -56 + bob, 7, 1.5);
    // smile / grit
    ctx.strokeStyle = "#8a4050";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (p.shootPose > 0) {
      ctx.moveTo(2, -45 + bob);
      ctx.lineTo(8, -45 + bob);
    } else {
      ctx.arc(4, -46 + bob, 3.5, 0.15, Math.PI - 0.15);
    }
    ctx.stroke();

    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    ctx.scale(e.facing, 1);
    const flash = e.hurtT > 0;
    const walking = e.onGround && Math.abs(e.vx) > 15;
    const bob = walking ? Math.sin(e.anim * 1.4) * 1.8 : 0;
    const leg = walking ? Math.sin(e.anim * 2.4) * 5 : 0;

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 1, e.w * 0.38, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    ctx.fillStyle = flash ? "#fff" : "#1a1a22";
    ctx.fillRect(-e.w * 0.28, -e.h * 0.35 + bob, e.w * 0.22, e.h * 0.32 + leg);
    ctx.fillRect(e.w * 0.05, -e.h * 0.35 + bob, e.w * 0.22, e.h * 0.32 - leg);

    // body
    const bw = e.w * 0.85;
    const bh = e.h * 0.48;
    ctx.fillStyle = flash ? "#ffffff" : e.color;
    roundRect(-bw / 2, -e.h * 0.72 + bob, bw, bh, 3);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = e.accent;
      ctx.fillRect(-bw / 2, -e.h * 0.72 + bob, bw * 0.2, bh);
    }
    ctx.strokeStyle = flash ? "#fff" : "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.2;
    roundRect(-bw / 2, -e.h * 0.72 + bob, bw, bh, 3);
    ctx.stroke();

    // head
    ctx.fillStyle = flash ? "#fff" : "#d4a878";
    ctx.beginPath();
    ctx.arc(0, -e.h * 0.8 + bob, e.w * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // hat
    if (e.type === "boss") {
      ctx.fillStyle = flash ? "#fff" : "#1a0808";
      ctx.beginPath();
      ctx.ellipse(0, -e.h * 0.92 + bob, e.w * 0.42, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-e.w * 0.28, -e.h * 1.08 + bob, e.w * 0.56, 16);
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(-e.w * 0.28, -e.h * 0.94 + bob, e.w * 0.56, 3);
    } else if (e.type === "brute") {
      ctx.fillStyle = flash ? "#fff" : "#3a2a1a";
      ctx.beginPath();
      ctx.arc(0, -e.h * 0.85 + bob, e.w * 0.36, Math.PI, 0);
      ctx.fill();
    } else if (e.type === "runner") {
      ctx.fillStyle = flash ? "#fff" : "#2a4a2a";
      ctx.fillRect(-e.w * 0.28, -e.h * 0.95 + bob, e.w * 0.56, 5);
    } else {
      ctx.fillStyle = flash ? "#fff" : "#222";
      ctx.beginPath();
      ctx.ellipse(0, -e.h * 0.92 + bob, e.w * 0.34, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-e.w * 0.22, -e.h * 1.0 + bob, e.w * 0.44, 10);
    }

    // eye (angry)
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(2, -e.h * 0.84 + bob, 4, 3);
    ctx.fillStyle = "#c03030";
    ctx.fillRect(2, -e.h * 0.84 + bob, 4, 1);

    // weapon
    if (e.type === "shooter" || e.type === "boss") {
      ctx.fillStyle = "#111";
      ctx.fillRect(e.w * 0.28, -e.h * 0.55 + bob, e.type === "boss" ? 18 : 14, 5);
      if (e.muzzle > 0) {
        ctx.fillStyle = "#ffe08a";
        ctx.beginPath();
        ctx.arc(e.w * 0.28 + (e.type === "boss" ? 20 : 16), -e.h * 0.53 + bob, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (e.type === "brute") {
      // fists
      ctx.fillStyle = flash ? "#fff" : "#c4a070";
      ctx.beginPath();
      ctx.arc(e.w * 0.45, -e.h * 0.45 + bob, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (e.hp < e.maxHp) {
      const bx = e.x;
      const by = e.y - 10;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(bx - 1, by - 1, e.w + 2, 6, 2);
      ctx.fill();
      ctx.fillStyle = e.type === "boss" ? "#d4af37" : "#e04040";
      roundRect(bx, by, Math.max(2, e.w * (e.hp / e.maxHp)), 4, 1);
      ctx.fill();
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      if (b.trail) {
        for (let i = 0; i < b.trail.length; i++) {
          const t = b.trail[i];
          ctx.globalAlpha = (i / b.trail.length) * 0.4;
          ctx.fillStyle = "#ffd76a";
          ctx.beginPath();
          ctx.arc(t.x, t.y, b.r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // glow
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 10);
      g.addColorStop(0, "rgba(255,230,140,0.5)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8d0";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffaa40";
      ctx.beginPath();
      ctx.arc(b.x - Math.sign(b.vx || 1) * 2, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of enemyBullets) {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 8);
      g.addColorStop(0, "rgba(255,80,60,0.5)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff6a4a";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd0c0";
      ctx.beginPath();
      ctx.arc(b.x - 1, b.y - 1, b.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPickups() {
    for (const p of pickups) {
      const lift = Math.sin(p.bob) * 3;
      ctx.save();
      ctx.translate(p.x + 8, p.y + 8 + lift);
      // aura
      ctx.fillStyle = p.kind === "health" ? "rgba(224,80,80,0.25)" : "rgba(212,175,55,0.25)";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      if (p.kind === "health") {
        ctx.fillStyle = "#e05050";
        ctx.fillRect(-8, -3, 16, 8);
        ctx.fillRect(-3, -8, 8, 16);
        ctx.fillStyle = "#fff";
        ctx.fillRect(-5, -1, 10, 4);
        ctx.fillRect(-1, -5, 4, 10);
      } else {
        ctx.fillStyle = "#d4af37";
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff8d0";
        ctx.font = "700 11px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", 0, 1);
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();
    }
  }

  function drawParticlesWorld() {
    for (const p of particles) {
      // skip screen-space sparkles (those with tiny g and gold that spawn on menu at screen coords — actually menu ones are in screen space while camera transforms)
      // All particles are drawn in world space during playing; on menu cameraX is 0 so OK
      const a = clamp(p.life / (p.maxLife || 1), 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === "casing") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-3, -1.2, 6, 2.4);
        ctx.restore();
      } else if (p.kind === "blood") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.65, p.vx * 0.01, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawParticlesScreen() {
    // reserved — world draw already covers menu when cameraX=0
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    const edge = 0.45 + vignettePulse * 0.35;
    g.addColorStop(0, "transparent");
    g.addColorStop(1, `rgba(0,0,0,${edge})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (vignettePulse > 0) {
      ctx.fillStyle = `rgba(160,20,20,${vignettePulse * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawHUD(L) {
    // frosted top bar
    const hg = ctx.createLinearGradient(0, 0, 0, 56);
    hg.addColorStop(0, "rgba(8,4,10,0.82)");
    hg.addColorStop(1, "rgba(8,4,10,0.0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, 56);

    // HP segmented bar
    ctx.font = "700 11px Outfit, sans-serif";
    ctx.fillStyle = "#c9b896";
    ctx.textAlign = "left";
    ctx.fillText("HP", 18, 22);
    const segments = 10;
    const segW = 14;
    const gap = 2;
    const filled = Math.ceil((player.hp / player.maxHp) * segments);
    for (let i = 0; i < segments; i++) {
      const x = 42 + i * (segW + gap);
      ctx.fillStyle = "rgba(40,12,12,0.8)";
      roundRect(x, 12, segW, 14, 2);
      ctx.fill();
      if (i < filled) {
        const low = player.hp / player.maxHp < 0.35;
        ctx.fillStyle = low ? "#ff6a30" : "#e04848";
        roundRect(x, 12, segW, 14, 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(x + 1, 13, segW - 2, 4);
      }
    }

    // lives as fedora icons
    ctx.fillStyle = "#c9b896";
    ctx.fillText("LIVES", 220, 22);
    for (let i = 0; i < player.lives; i++) {
      const lx = 268 + i * 22;
      ctx.fillStyle = "#e8c4a0";
      ctx.beginPath();
      ctx.arc(lx, 19, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14101c";
      ctx.beginPath();
      ctx.ellipse(lx, 15, 8, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(lx - 5, 9, 10, 7);
      ctx.fillStyle = "#a01830";
      ctx.fillRect(lx - 5, 14.5, 10, 2);
    }

    // level chip
    ctx.textAlign = "center";
    roundRect(W / 2 - 110, 8, 220, 26, 13);
    ctx.fillStyle = "rgba(20,12,18,0.7)";
    ctx.fill();
    ctx.strokeStyle = L.accent || "#d4af37";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#f3e6c8";
    ctx.font = "600 12px Outfit, sans-serif";
    ctx.fillText(`LV ${levelIndex + 1}  ·  ${L.name}`, W / 2, 26);

    // score with pop
    const sc = Math.floor(displayScore);
    const popScale = 1 + scorePop * 0.35;
    ctx.save();
    ctx.translate(W - 24, 26);
    ctx.scale(popScale, popScale);
    ctx.textAlign = "right";
    ctx.font = "700 22px Outfit, sans-serif";
    ctx.fillStyle = "#0a0608";
    ctx.fillText(String(sc).padStart(6, "0"), 2, 2);
    ctx.fillStyle = scorePop > 0 ? "#ffe08a" : "#d4af37";
    ctx.fillText(String(sc).padStart(6, "0"), 0, 0);
    ctx.restore();
  }

  function drawLevelBanner() {
    const t = bannerTimer;
    const alpha = t > 2.3 ? (2.8 - t) / 0.5 : t < 0.5 ? t / 0.5 : 1;
    const slide = t > 2.3 ? easeOut((2.8 - t) / 0.5) : 1;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    const y = 90 + (1 - slide) * -30;
    roundRect(W / 2 - 200, y, 400, 52, 8);
    ctx.fillStyle = "rgba(10,6,12,0.85)";
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#d4af37";
    ctx.font = "700 11px Outfit, sans-serif";
    ctx.fillText("NOW ENTERING", W / 2, y + 18);
    ctx.fillStyle = "#f3e6c8";
    ctx.font = "700 22px Cinzel, Georgia, serif";
    ctx.fillText(bannerText, W / 2, y + 42);
    ctx.restore();
  }

  function drawMenu() {
    // dim world already drawn; deepen
    ctx.fillStyle = "rgba(6,3,8,0.55)";
    ctx.fillRect(0, 0, W, H);

    // decorative lines
    ctx.strokeStyle = "rgba(212,175,55,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 280, 118);
    ctx.lineTo(W / 2 - 160, 118);
    ctx.moveTo(W / 2 + 160, 118);
    ctx.lineTo(W / 2 + 280, 118);
    ctx.stroke();

    // logo
    const pulse = 1 + Math.sin(titlePulse * 2.5) * 0.02;
    ctx.save();
    ctx.translate(W / 2, 150);
    ctx.scale(pulse, pulse);
    ctx.textAlign = "center";
    ctx.font = "900 62px Cinzel, Georgia, serif";
    // shadow layers
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText("CANNOLI CAPERS", 4, 6);
    // glow
    ctx.shadowColor = "rgba(212,175,55,0.55)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#d4af37";
    ctx.fillText("CANNOLI CAPERS", 0, 0);
    ctx.shadowBlur = 0;
    // top highlight
    ctx.fillStyle = "#ffe9a0";
    ctx.globalAlpha = 0.85;
    ctx.fillText("CANNOLI CAPERS", 0, -1);
    ctx.globalAlpha = 1;
    ctx.font = "600 16px Outfit, sans-serif";
    ctx.fillStyle = "#c9b896";
    ctx.shadowBlur = 0;
    ctx.fillText("A cartoon mob run-and-gun", 0, 36);
    ctx.restore();

    // idle hero showcase
    ctx.save();
    const hx = W / 2;
    const hy = 340 + Math.sin(menuIdle * 2) * 6;
    // fake ground ring
    ctx.fillStyle = "rgba(212,175,55,0.12)";
    ctx.beginPath();
    ctx.ellipse(hx, hy + 8, 50, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // draw a scaled player at screen space
    const saved = { x: player.x, y: player.y, facing: player.facing, anim: player.anim, onGround: player.onGround, vx: player.vx, muzzle: player.muzzle, shootPose: player.shootPose, invuln: player.invuln, hurtFlash: player.hurtFlash };
    player.x = hx - player.w / 2 + cameraX;
    player.y = hy - player.h;
    player.facing = Math.sin(menuIdle * 0.7) > 0 ? 1 : -1;
    player.anim = menuIdle * 3;
    player.onGround = true;
    player.vx = 80;
    player.muzzle = 0;
    player.shootPose = 0;
    player.invuln = 0;
    player.hurtFlash = 0;
    // temporarily undo camera for this draw — drawPlayer uses world coords, and we're still at identity after restore from main… wait, draw() already restored. So camera is 0. Setting player.x = hx - w/2 works.
    player.x = hx - player.w / 2;
    drawPlayer();
    Object.assign(player, saved);
    ctx.restore();

    // Start button
    const bw = 220, bh = 52;
    const bx = W / 2 - bw / 2;
    const by = 400;
    const hover = mouseAimX >= bx && mouseAimX <= bx + bw && mouseAimY >= by && mouseAimY <= by + bh;
    const bob = Math.sin(titlePulse * 3) * 2;
    drawButton(bx, by + bob, bw, bh, "START HEIST", true, hover);
    uiButtons.push({ id: "start", x: bx, y: by + bob, w: bw, h: bh });

    ctx.textAlign = "center";
    ctx.font = "400 13px Outfit, sans-serif";
    ctx.fillStyle = "rgba(243,230,200,0.45)";
    ctx.fillText("WASD move  ·  Jump  ·  Space / Click shoot  ·  P pause", W / 2, 480);
    ctx.font = "400 11px Outfit, sans-serif";
    ctx.fillStyle = "rgba(243,230,200,0.28)";
    ctx.fillText("Original game — not affiliated with any commercial title", W / 2, 505);
  }

  function drawButton(x, y, w, h, label, primary, hover) {
    ctx.save();
    if (primary) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, hover ? "#f0d060" : "#d4af37");
      g.addColorStop(1, hover ? "#c09020" : "#8a6820");
      roundRect(x, y, w, h, 8);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowColor = "rgba(212,175,55,0.45)";
      ctx.shadowBlur = hover ? 20 : 10;
      roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffe9a0";
      ctx.lineWidth = 1.5;
      roundRect(x + 1, y + 1, w - 2, h - 2, 7);
      ctx.stroke();
      ctx.fillStyle = "#1a1008";
      ctx.font = "700 18px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    } else {
      roundRect(x, y, w, h, 8);
      ctx.fillStyle = hover ? "rgba(243,230,200,0.12)" : "rgba(20,12,18,0.7)";
      ctx.fill();
      ctx.strokeStyle = hover ? "#d4af37" : "rgba(212,175,55,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#f3e6c8";
      ctx.font = "600 15px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    }
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  function drawPanel(title, sub, buttons) {
    ctx.fillStyle = "rgba(4,2,6,0.72)";
    ctx.fillRect(0, 0, W, H);

    const pw = 420, ph = 260;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2 - 10;

    // panel glow
    ctx.shadowColor = "rgba(212,175,55,0.25)";
    ctx.shadowBlur = 30;
    roundRect(px, py, pw, ph, 14);
    ctx.fillStyle = "rgba(16,10,18,0.95)";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 2;
    ctx.stroke();
    // inner line
    roundRect(px + 8, py + 8, pw - 16, ph - 16, 10);
    ctx.strokeStyle = "rgba(212,175,55,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = "900 36px Cinzel, Georgia, serif";
    ctx.fillStyle = "#0a0608";
    ctx.fillText(title, W / 2 + 2, py + 62);
    ctx.fillStyle = "#d4af37";
    ctx.fillText(title, W / 2, py + 60);

    ctx.font = "600 16px Outfit, sans-serif";
    ctx.fillStyle = "#c9b896";
    ctx.fillText(sub, W / 2, py + 100);

    const btnW = 180, btnH = 44;
    buttons.forEach((b, i) => {
      const bx = W / 2 - btnW / 2;
      const by = py + 130 + i * 54;
      const hover = mouseAimX >= bx && mouseAimX <= bx + btnW && mouseAimY >= by && mouseAimY <= by + btnH;
      drawButton(bx, by, btnW, btnH, b.label, !!b.primary, hover);
      uiButtons.push({ id: b.id, x: bx, y: by, w: btnW, h: btnH });
    });
  }

  // ─── Loop ────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05);
    // reset CSS-sized canvas transform each frame after potential resize — keep dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
