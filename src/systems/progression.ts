import type { ClassData, LevelData } from '../data';

/** 레벨 L의 기본 능력치 (장비 제외) */
export function baseStatsAt(cls: ClassData, level: number): { hp: number; atk: number; def: number; speed: number } {
  const n = level - 1;
  return {
    hp: cls.hp + n * cls.growth.hp,
    atk: cls.atk + n * cls.growth.atk,
    def: cls.def + n * cls.growth.def,
    speed: cls.speed,
  };
}

/** 누적 경험치로 지금 레벨을 구한다 (최대 레벨에서 멈춤) */
export function levelForXp(xp: number, levels: LevelData): number {
  let level = 1;
  while (level < levels.maxLevel && xp >= levels.xpCumulative[level]) level++;
  return level;
}

/** 스킬 랭크에 따른 피해 배율: 랭크가 1 오를 때마다 +20% */
export function skillMult(baseMult: number, rank: number): number {
  return baseMult * (1 + 0.2 * (Math.max(1, rank) - 1));
}
