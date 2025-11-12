export const TRACK_LEN = 400;      // percent
export const BASE_SPEED = 0.5;      // % per second baseline
export const CHAR_INC = 0.2;     // +%/s per correct char
export const MAX_SPEED = 40;      // cap %/s
export const IDLE_DECAY = 0;       // %/s decay when idle

export const MONSTER_START_GAP = 8;
export const MONSTER_START_DELAY = 0.8; // seconds: wait before monster moves
export const MONSTER_SAFE_TIME = 1.5; // seconds: no collision checks
export const HIT_BOX = 0.1;
export const MONSTER_BASE = 0.4;  // starts slower than a player
export const MONSTER_ACCEL= 0.1; // +%/s^2, slow ramp up
export const MONSTER_MAX = 40;

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// bump speed on a correct keystroke
export function applyCorrectChar(speed) {
  return clamp(speed + CHAR_INC, 0, MAX_SPEED);
}

// decay toward base when idle, dt in seconds
export function decaySpeed(speed, dt) {
  if (speed <= BASE_SPEED) return BASE_SPEED;
  const newSpeed = speed - IDLE_DECAY * dt;
  return newSpeed <= BASE_SPEED ? BASE_SPEED : newSpeed;
}

// integrate position with current speed, dt in seconds
export function integratePosition(position, speed, dt, trackLen = TRACK_LEN) {
  const next = position + speed * dt;
  return clamp(next, 0, trackLen);
}

// Monster constant-acceleration step
export function monsterStep(speed, dt) {
  return clamp(speed + MONSTER_ACCEL * dt, MONSTER_BASE, MONSTER_MAX);
}