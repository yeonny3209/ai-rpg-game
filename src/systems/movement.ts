/** 입력 방향을 길이 1로 맞춘다 (대각선이 더 빠르지 않게). 입력이 없으면 0,0 */
export function inputVector(left: boolean, right: boolean, up: boolean, down: boolean): { x: number; y: number } {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const y = (down ? 1 : 0) - (up ? 1 : 0);
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
