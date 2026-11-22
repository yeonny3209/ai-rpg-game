import { ITEMS, ENEMIES } from '../data';
import type { SlotId, StatKey } from '../data';

export interface Item {
  id: number;
  slot: SlotId;
  gradeIndex: number;
  name: string;
  stats: Partial<Record<StatKey, number>>;
}

export type Rng = () => number;

let nextId = 1;

export function gradeIndexFor(roll: number, minGrade = 0): number {
  const grades = ITEMS.grades;
  const total = grades.slice(minGrade).reduce((s, g) => s + g.weight, 0);
  let acc = 0;
  const target = roll * total;
  for (let i = minGrade; i < grades.length; i++) {
    acc += grades[i].weight;
    if (target < acc) return i;
  }
  return grades.length - 1;
}

/** 아이템 하나를 만든다. 웨이브가 높을수록 수치가 조금씩 커진다(웨이브당 +10%). */
export function createItem(rng: Rng, wave: number, minGrade = 0): Item {
  const slots = Object.keys(ITEMS.slots) as SlotId[];
  const slot = slots[Math.min(slots.length - 1, Math.floor(rng() * slots.length))];
  const gradeIndex = gradeIndexFor(rng(), minGrade);
  const grade = ITEMS.grades[gradeIndex];
  const slotData = ITEMS.slots[slot];
  const scale = grade.mult * (1 + 0.1 * (Math.max(1, wave) - 1));
  const stats: Partial<Record<StatKey, number>> = {};
  for (const [k, base] of Object.entries(slotData.stats) as [StatKey, number][]) {
    stats[k] = Math.max(1, Math.round(base * scale));
  }
  return { id: nextId++, slot, gradeIndex, name: slotData.names[gradeIndex], stats };
}

/** 적이 죽을 때 드롭 여부를 정하고 아이템을 돌려준다 (없으면 null) */
export function rollDrop(enemyId: string, wave: number, rng: Rng): Item | null {
  const e = ENEMIES[enemyId];
  if (!e || rng() >= e.dropChance) return null;
  return createItem(rng, wave, e.minDropGrade ?? 0);
}

const STAT_LABEL: Record<StatKey, string> = { hp: '체력', atk: '공격', def: '방어', speed: '이속' };
export function describeStats(stats: Partial<Record<StatKey, number>>): string {
  return (Object.entries(stats) as [StatKey, number][]).map(([k, v]) => `${STAT_LABEL[k]}+${v}`).join(' ');
}
