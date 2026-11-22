// 화면과 무관한 순수 함수 모음 (나중에 자동 테스트하기 쉽게 분리)

/** 피해 = 공격력 × 피해배율 × 100 / (100 + 방어력), 최소 1 (docs/BALANCE_P1.md 1장) */
export function calcDamage(atk: number, mult: number, def: number): number {
  return Math.max(1, Math.round((atk * mult * 100) / (100 + def)));
}

export function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/** 시전자 (px,py)가 dirAngle 방향으로 range 안, ±halfAngle 부채꼴 안에 목표 (tx,ty)가 있는지 */
export function inCone(px: number, py: number, dirAngle: number, tx: number, ty: number, range: number, halfAngle: number): boolean {
  const dx = tx - px;
  const dy = ty - py;
  if (dx * dx + dy * dy > range * range) return false;
  let diff = Math.atan2(dy, dx) - dirAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= halfAngle;
}
