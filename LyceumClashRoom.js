import { Room } from "colyseus";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

const WORLD_W = 1728;
const WORLD_H = 972;
const MATCH_MS = 75_000;
const TICK_MS = 1000 / 30;
const SNAPSHOT_MS = 50;
const PLAYER_SPEED = 225;
const PLAYER_RADIUS = 24;
const SHOT_RANGE = 430;
const SHOT_WIDTH = 52;
const SHOT_DAMAGE = 20;
const SHOT_COOLDOWN = 330;
const RESPAWN_MS = 2500;

const SPAWNS = [
  { x: 180, y: 180 },
  { x: WORLD_W - 180, y: 180 },
  { x: 180, y: WORLD_H - 180 },
  { x: WORLD_W - 180, y: WORLD_H - 180 },
  { x: WORLD_W / 2, y: WORLD_H - 150 },
];

const HERO_HP = {
  blaster: 100,
  sprinter: 90,
  scholar: 105,
  hacker: 95,
  historian: 110,
  geographer: 105,
  chemist: 100,
  artist: 95,
  musician: 95,
  guardian: 125,
  phantom: 90,
  captain: 115,
  sniper: 85,
  medic: 100,
  engineer: 110,
  stormer: 100,
  illusionist: 90,
};

function cleanText(value, max = 24) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

function normalizeInput(dx, dy) {
  dx = clamp(dx, -1, 1);
  dy = clamp(dy, -1, 1);
  const mag = Math.hypot(dx, dy);
  if (mag > 1) {
    dx /= mag;
    dy /= mag;
  }
  return { dx, dy };
}

function rayHit(shooter, target, angle) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const vx = target.x - shooter.x;
  const vy = target.y - shooter.y;
  const along = vx * ux + vy * uy;
  if (along <= 0 || along > SHOT_RANGE) return null;

  const perp = Math.abs(vx * uy - vy * ux);
  if (perp > SHOT_WIDTH) return null;

  return { along, perp };
}

export class LyceumClashRoom extends Room {
  maxClients = 5;
  autoDispose = true;

  players = new Map();
  hostSessionId = "";
  phase = "lobby";
  startedAt = 0;
  endsAt = 0;
  round = 0;
  objectiveClock = 0;

  async onCreate(options = {}) {
    this.roomId = await this.generateRoomCode();
    this.metadata = {
      game: "LYCEUM CLASH",
      version: "colyseus-1",
      phase: "lobby",
    };

    this.onMessage("start", (client) => this.handleStart(client));
    this.onMessage("input", (client, data) => this.handleInput(client, data));
    this.onMessage("shoot", (client, data) => this.handleShoot(client, data));
    this.onMessage("hero", (client, data) => this.handleHero(client, data));
    this.onMessage("ping", (client, data) => {
      client.send("pong", { t: data?.t ?? Date.now(), serverNow: Date.now() });
    });

    this.clock.setInterval(() => this.tick(), TICK_MS);
    this.clock.setInterval(() => this.broadcastSnapshot(), SNAPSHOT_MS);

    console.log(`[CLASH] room ${this.roomId} created`);
  }

  async generateRoomCode() {
    const channel = "$lyceum-clash-room-codes";
    const existing = await this.presence.smembers(channel);

    let code = "";
    do {
      code = "";
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
    } while (existing.includes(code));

    await this.presence.sadd(channel, code);
    return code;
  }

  onJoin(client, options = {}) {
    if (this.phase !== "lobby") {
      throw new Error("MATCH_ALREADY_STARTED");
    }

    const slot = this.firstFreeSlot();
    if (slot < 0) {
      throw new Error("ROOM_FULL");
    }

    if (!this.hostSessionId) {
      this.hostSessionId = client.sessionId;
    }

    const hero = cleanText(options.hero || "blaster", 20) || "blaster";
    const maxHp = HERO_HP[hero] || 100;
    const spawn = SPAWNS[slot];

    this.players.set(client.sessionId, {
      sessionId: client.sessionId,
      name: cleanText(options.name || `Учень ${slot + 1}`, 24) || `Учень ${slot + 1}`,
      hero,
      slot,
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: maxHp,
      maxHp,
      alive: true,
      score: 0,
      deaths: 0,
      lastShotAt: 0,
      respawnAt: 0,
      input: { dx: 0, dy: 0, seq: 0 },
    });

    client.send("room_ready", {
      code: this.roomId,
      sessionId: client.sessionId,
      hostSessionId: this.hostSessionId,
      maxPlayers: this.maxClients,
      world: { width: WORLD_W, height: WORLD_H },
    });

    this.broadcastLobby();
    this.broadcastSnapshot();

    console.log(`[CLASH] ${client.sessionId} joined ${this.roomId}`);
  }

  onLeave(client) {
    this.players.delete(client.sessionId);

    if (client.sessionId === this.hostSessionId) {
      const next = this.players.keys().next();
      this.hostSessionId = next.done ? "" : next.value;
      if (this.hostSessionId) {
        this.broadcast("host_changed", { hostSessionId: this.hostSessionId });
      }
    }

    this.broadcastLobby();
    console.log(`[CLASH] ${client.sessionId} left ${this.roomId}`);
  }

  async onDispose() {
    try {
      await this.presence.srem("$lyceum-clash-room-codes", this.roomId);
    } catch (error) {
      console.warn("[CLASH] room code cleanup:", error);
    }
    console.log(`[CLASH] room ${this.roomId} disposed`);
  }

  firstFreeSlot() {
    const used = new Set([...this.players.values()].map((p) => p.slot));
    for (let i = 0; i < 5; i++) {
      if (!used.has(i)) return i;
    }
    return -1;
  }

  handleHero(client, data) {
    if (this.phase !== "lobby") return;
    const p = this.players.get(client.sessionId);
    if (!p) return;

    const hero = cleanText(data?.hero || "", 20);
    if (!hero) return;

    p.hero = hero;
    p.maxHp = HERO_HP[hero] || 100;
    p.hp = p.maxHp;
    this.broadcastLobby();
  }

  handleStart(client) {
    if (client.sessionId !== this.hostSessionId) {
      client.send("server_error", { code: "NOT_HOST", message: "Лише HOST може почати матч." });
      return;
    }

    if (this.phase === "playing" || this.phase === "countdown") return;
    if (this.players.size < 1) return;

    this.round += 1;
    this.phase = "countdown";
    this.startedAt = Date.now() + 1200;
    this.endsAt = this.startedAt + MATCH_MS;
    this.objectiveClock = 0;

    let i = 0;
    for (const p of this.players.values()) {
      const spawn = SPAWNS[p.slot] || SPAWNS[i % SPAWNS.length];
      const maxHp = HERO_HP[p.hero] || 100;
      p.x = spawn.x;
      p.y = spawn.y;
      p.angle = 0;
      p.maxHp = maxHp;
      p.hp = maxHp;
      p.alive = true;
      p.score = 0;
      p.deaths = 0;
      p.lastShotAt = 0;
      p.respawnAt = 0;
      p.input = { dx: 0, dy: 0, seq: 0 };
      i++;
    }

    this.lock();
    this.metadata = { ...this.metadata, phase: "playing" };

    this.broadcast("match_started", {
      startedAt: this.startedAt,
      endsAt: this.endsAt,
      durationMs: MATCH_MS,
      round: this.round,
      world: { width: WORLD_W, height: WORLD_H },
    });

    this.broadcastSnapshot();
    console.log(`[CLASH] ${this.roomId} match ${this.round} starting`);
  }

  handleInput(client, data = {}) {
    const p = this.players.get(client.sessionId);
    if (!p) return;

    const { dx, dy } = normalizeInput(data.dx, data.dy);
    const seq = Math.max(0, Number(data.seq) || 0);
    const angle = Number(data.angle);

    p.input = { dx, dy, seq };
    if (Number.isFinite(angle)) {
      p.angle = angle;
    }
  }

  handleShoot(client, data = {}) {
    if (this.phase !== "playing") return;

    const now = Date.now();
    if (now < this.startedAt) return;

    const shooter = this.players.get(client.sessionId);
    if (!shooter || !shooter.alive) return;
    if (now - shooter.lastShotAt < SHOT_COOLDOWN) return;

    const angle = Number.isFinite(Number(data.angle)) ? Number(data.angle) : shooter.angle;
    shooter.angle = angle;
    shooter.lastShotAt = now;

    let best = null;

    for (const target of this.players.values()) {
      if (target.sessionId === shooter.sessionId || !target.alive) continue;
      const hit = rayHit(shooter, target, angle);
      if (!hit) continue;
      if (!best || hit.along < best.hit.along) {
        best = { target, hit };
      }
    }

    const shotId = `${client.sessionId}:${now}`;
    this.broadcast("shot", {
      id: shotId,
      by: client.sessionId,
      x: shooter.x,
      y: shooter.y,
      angle,
      range: SHOT_RANGE,
      at: now,
    });

    if (!best) return;

    best.target.hp = Math.max(0, best.target.hp - SHOT_DAMAGE);

    this.broadcast("hit", {
      by: client.sessionId,
      target: best.target.sessionId,
      damage: SHOT_DAMAGE,
      hp: best.target.hp,
    });

    if (best.target.hp <= 0) {
      best.target.alive = false;
      best.target.deaths += 1;
      best.target.respawnAt = now + RESPAWN_MS;
      shooter.score += 5;

      this.broadcast("ko", {
        by: client.sessionId,
        target: best.target.sessionId,
        score: shooter.score,
        respawnAt: best.target.respawnAt,
      });
    }
  }

  tick() {
    const now = Date.now();

    if (this.phase === "countdown" && now >= this.startedAt) {
      this.phase = "playing";
    }

    if (this.phase !== "playing") return;

    if (now >= this.endsAt) {
      this.finishMatch();
      return;
    }

    const dt = TICK_MS / 1000;

    for (const p of this.players.values()) {
      if (!p.alive) {
        if (p.respawnAt && now >= p.respawnAt) {
          const spawn = SPAWNS[p.slot] || SPAWNS[0];
          p.x = spawn.x;
          p.y = spawn.y;
          p.hp = p.maxHp;
          p.alive = true;
          p.respawnAt = 0;
          this.broadcast("respawn", { sessionId: p.sessionId, x: p.x, y: p.y });
        }
        continue;
      }

      p.x = clamp(
        p.x + p.input.dx * PLAYER_SPEED * dt,
        PLAYER_RADIUS,
        WORLD_W - PLAYER_RADIUS
      );
      p.y = clamp(
        p.y + p.input.dy * PLAYER_SPEED * dt,
        PLAYER_RADIUS,
        WORLD_H - PLAYER_RADIUS
      );
    }

    // Small central objective: +1 point/second while inside the bell zone.
    this.objectiveClock += TICK_MS;
    if (this.objectiveClock >= 1000) {
      this.objectiveClock -= 1000;
      const cx = WORLD_W / 2;
      const cy = WORLD_H / 2;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - cx, p.y - cy) <= 120) {
          p.score += 1;
        }
      }
    }
  }

  finishMatch() {
    this.phase = "finished";

    const ranking = [...this.players.values()]
      .sort((a, b) => b.score - a.score || a.deaths - b.deaths)
      .map((p, index) => ({
        place: index + 1,
        sessionId: p.sessionId,
        name: p.name,
        score: p.score,
        deaths: p.deaths,
      }));

    this.broadcast("match_ended", {
      round: this.round,
      ranking,
      winner: ranking[0] || null,
    });

    this.metadata = { ...this.metadata, phase: "finished" };
    this.unlock();

    // Return to lobby after results; host can launch again.
    this.clock.setTimeout(() => {
      if (this.phase === "finished") {
        this.phase = "lobby";
        this.metadata = { ...this.metadata, phase: "lobby" };
        this.broadcastLobby();
      }
    }, 4500);
  }

  broadcastLobby() {
    const players = [...this.players.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((p) => ({
        sessionId: p.sessionId,
        name: p.name,
        hero: p.hero,
        slot: p.slot,
      }));

    this.broadcast("lobby", {
      code: this.roomId,
      phase: this.phase,
      hostSessionId: this.hostSessionId,
      players,
      maxPlayers: this.maxClients,
    });
  }

  broadcastSnapshot() {
    const players = [...this.players.values()].map((p) => ({
      sessionId: p.sessionId,
      name: p.name,
      hero: p.hero,
      slot: p.slot,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      angle: p.angle,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      score: p.score,
      deaths: p.deaths,
      respawnAt: p.respawnAt,
      seq: p.input.seq,
    }));

    this.broadcast("snapshot", {
      serverNow: Date.now(),
      phase: this.phase,
      startedAt: this.startedAt,
      endsAt: this.endsAt,
      round: this.round,
      hostSessionId: this.hostSessionId,
      players,
    });
  }
}
