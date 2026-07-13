export interface Point { x: number; y: number }

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function palmScale(marks: Point[]): number {
  return Math.max(0.035, distance(marks[0], marks[9]));
}

export function pinchRatio(marks: Point[]): number {
  return distance(marks[4], marks[8]) / palmScale(marks);
}

export function nextPinch(ratio: number, active: boolean): boolean {
  return active ? ratio < 0.72 : ratio < 0.52;
}

export function isFist(marks: Point[]): boolean {
  const scale = palmScale(marks);
  const folded = [8, 12, 16, 20].filter((tip) => distance(marks[tip], marks[0]) / scale < 1.75).length;
  const jointsFolded = [6, 10, 14, 18].filter((joint, index) => distance(marks[joint + 2], marks[0]) < distance(marks[joint], marks[0]) * 1.08).length;
  return folded >= 3 && jointsFolded >= 3;
}

export function smoothAim(previous: Point, raw: Point): Point {
  const delta = distance(previous, raw);
  if (delta < 0.006) return previous;
  const alpha = delta > 0.14 ? 0.58 : delta > 0.055 ? 0.38 : 0.22;
  return { x: previous.x + (raw.x - previous.x) * alpha, y: previous.y + (raw.y - previous.y) * alpha };
}

export function assignPlayers(xs: number[]): (1 | 2)[] {
  if (xs.length === 1) return [xs[0] < 0.5 ? 1 : 2];
  return xs.map((_, index) => (index + 1) as 1 | 2);
}

export function isOpenPalm(marks: Point[]): boolean {
  const scale = palmScale(marks);
  const tips = [4, 8, 12, 16, 20];
  return tips.filter(tip => distance(marks[tip], marks[0]) / scale > 2.0).length >= 4;
}

export function detectSwipe(prev: Point, curr: Point, dt: number): boolean {
  if (dt > 300 || dt <= 0) return false;
  const dx = Math.abs(curr.x - prev.x);
  return dx > 0.15;
}

export function isThumbsUp(marks: Point[]): boolean {
  const thumbY = marks[4].y;
  const tips = [8, 12, 16, 20];
  return tips.every(tip => thumbY < marks[tip].y - 0.03) && distance(marks[4], marks[8]) / palmScale(marks) > 0.7;
}

export function isTwoHandPinch(p1Active: boolean, p2Active: boolean, dt: number): boolean {
  return p1Active && p2Active && dt <= 200;
}
