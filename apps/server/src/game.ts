import crypto from "node:crypto";
import type { Aim, PlayerId, PublicRoom, Target, TargetKind } from "@rift/protocol";

export const ROUND_SECONDS = 180;
export const COMBO_WINDOW_MS = 1_000;
export const TOTAL_WAVES = 3;
export const MAX_AMMO = 6;

export interface InternalTarget extends Target {
  hitAt: Partial<Record<PlayerId, number>>;
}

export interface GameState extends PublicRoom {
  target: InternalTarget | null;
}

export interface ShotResult {
  hit: boolean;
  combo: boolean;
  scored: boolean;
}

export function initialState(code: string): GameState {
  return {
    code,
    phase: "lobby",
    outcome: null,
    players: { 1: false, 2: false },
    aims: {
      1: { x: 0.3, y: 0.5, sequence: 0 },
      2: { x: 0.7, y: 0.5, sequence: 0 },
    },
    stats: {
      1: { shots: 0, hits: 0, misses: 0, combos: 0 },
      2: { shots: 0, hits: 0, misses: 0, combos: 0 },
    },
    ammo: { 1: MAX_AMMO, 2: MAX_AMMO },
    maxAmmo: MAX_AMMO,
    target: null,
    score: 0,
    health: 5,
    timeLeft: ROUND_SECONDS,
    countdown: 3,
    wave: 1,
    totalWaves: TOTAL_WAVES,
    tutorialStep: 0,
  };
}

export function waveForTime(timeLeft: number): number {
  const bounded = Math.max(0, Math.min(ROUND_SECONDS, timeLeft));
  const elapsed = ROUND_SECONDS - bounded;
  return Math.min(TOTAL_WAVES, Math.floor(elapsed / (ROUND_SECONDS / TOTAL_WAVES)) + 1);
}

export function outcomeFor(health: number, timeLeft: number): "victory" | "defeat" | null {
  if (health <= 0) return "defeat";
  if (timeLeft <= 0) return "victory";
  return null;
}

export function targetLifetime(wave: number): number {
  return [2_600, 2_050, 1_500][Math.max(1, Math.min(TOTAL_WAVES, wave)) - 1];
}

export function createTarget(
  timeLeft: number,
  now = Date.now(),
  random = Math.random,
  id: string = crypto.randomUUID(),
): InternalTarget {
  const wave = waveForTime(timeLeft);
  const pools: Record<number, TargetKind[]> = {
    1: ["red", "red", "blue", "blue", "combo"],
    2: ["red", "blue", "combo", "combo"],
    3: ["red", "blue", "combo", "combo", "combo"],
  };
  const kinds = pools[wave];
  const kind = kinds[Math.floor(random() * kinds.length)];
  return {
    id,
    kind,
    x: 0.12 + random() * 0.76,
    y: 0.18 + random() * 0.62,
    radius: kind === "combo" ? 0.075 : 0.06,
    expiresAt: now + targetLifetime(wave),
    hits: [],
    hitAt: {},
  };
}

export function clampAim(aim: Aim): Aim | null {
  if (![aim.x, aim.y, aim.sequence].every(Number.isFinite) || aim.sequence < 0) return null;
  return {
    x: Math.max(0, Math.min(1, aim.x)),
    y: Math.max(0, Math.min(1, aim.y)),
    sequence: Math.floor(aim.sequence),
  };
}

export function intersects(aim: Pick<Aim, "x" | "y">, target: Target): boolean {
  return Math.hypot(aim.x - target.x, aim.y - target.y) <= target.radius;
}

export function resolveShot(
  state: GameState,
  playerId: PlayerId,
  now = Date.now(),
): ShotResult {
  const target = state.target;
  const stats = state.stats[playerId];
  stats.shots++;
  const matching = target?.kind === "combo" || target?.kind === (playerId === 1 ? "red" : "blue");
  const hit = Boolean(target && matching && intersects(state.aims[playerId], target));

  if (!hit || !target) {
    stats.misses++;
    state.score = Math.max(0, state.score - 10);
    return { hit: false, combo: false, scored: false };
  }

  if (target.kind !== "combo") {
    stats.hits++;
    state.score += 100;
    return { hit: true, combo: false, scored: true };
  }

  target.hitAt[playerId] = now;
  stats.hits++;
  if (!target.hits.includes(playerId)) target.hits.push(playerId);
  const other = playerId === 1 ? 2 : 1;
  const otherHitAt = target.hitAt[other];
  const combo = otherHitAt !== undefined && now - otherHitAt <= COMBO_WINDOW_MS;

  if (combo) {
    state.score += 300;
    state.stats[1].combos++;
    state.stats[2].combos++;
  }
  return { hit: true, combo, scored: combo };
}

export function shiftTargetExpiry(state: GameState, duration: number): void {
  if (state.target && duration > 0) state.target.expiresAt += duration;
}
