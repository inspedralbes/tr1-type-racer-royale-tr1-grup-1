export function calcPlayerSpeed(
  wpm,
  { minWpm = 20, maxWpm = 160, minSpeed = 1, maxSpeed = 10, curve = 1.4 } = {}
) {
  if (!Number.isFinite(wpm)) return 0;
  const clamped = Math.min(Math.max(wpm, minWpm), maxWpm);
  const normalized = (clamped - minWpm) / (maxWpm - minWpm);
  const curved = Math.pow(normalized, curve);
  return Number((minSpeed + curved * (maxSpeed - minSpeed)).toFixed(2));
}

export function integratePosition(pos, speed, dtSec, trackLen = 100) {
  const next = (pos || 0) + (speed || 0) * (dtSec || 0);
  return Math.min(Math.max(0, next), trackLen);
}

//to check