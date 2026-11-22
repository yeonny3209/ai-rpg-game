import classesJson from './classes.json';
import skillsJson from './skills.json';
import enemiesJson from './enemies.json';
import levelsJson from './levels.json';
import itemsJson from './items.json';

export type StatKey = 'hp' | 'atk' | 'def' | 'speed';
export type SlotId = 'weapon' | 'armor' | 'accessory';
export type SkillType = 'charge' | 'sweep' | 'guard' | 'bolt' | 'flame' | 'stun';

export interface ClassData {
  id: string;
  name: string;
  color: string;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  attackInterval: number;
  attackType: 'melee' | 'ranged';
  skillIds: string[];
  growth: { hp: number; atk: number; def: number };
}
export interface SkillData {
  name: string;
  type: SkillType;
  mult: number;
  cooldown: number;
  radius?: number;
  duration?: number;
  reduction?: number;
  ticks?: number;
  range?: number;
  stunSec?: number;
}
export interface EnemyData {
  name: string;
  color: string;
  role: 'melee' | 'ranged' | 'boss';
  hp: number;
  atk: number;
  def: number;
  speed: number;
  attackInterval: number;
  radius: number;
  xp: number;
  dropChance: number;
  minDropGrade?: number;
  keepDistance?: number;
  projectileSpeed?: number;
  burstInterval?: number;
  burstCount?: number;
}
export interface LevelData {
  maxLevel: number;
  xpCumulative: number[];
}
export interface GradeData {
  id: string;
  name: string;
  color: string;
  mult: number;
  weight: number;
}
export interface SlotData {
  name: string;
  stats: Partial<Record<StatKey, number>>;
  names: string[];
}
export interface ItemsData {
  grades: GradeData[];
  slots: Record<SlotId, SlotData>;
}

function fail(msg: string): never {
  throw new Error(`[데이터 오류] ${msg}`);
}
function positive(where: string, key: string, v: unknown): void {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) fail(`${where}.${key}는 0보다 큰 숫자여야 해요 (값: ${String(v)})`);
}
function nonNegative(where: string, key: string, v: unknown): void {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) fail(`${where}.${key}는 0 이상 숫자여야 해요 (값: ${String(v)})`);
}

const SKILL_TYPES: SkillType[] = ['charge', 'sweep', 'guard', 'bolt', 'flame', 'stun'];

// 불러올 때 한 번 검사: 누락·범위 오류를 실행 중 이상 동작 대신 명확한 오류로 알린다.
function validate(
  classes: ClassData[],
  skills: Record<string, SkillData>,
  enemies: Record<string, EnemyData>,
  levels: LevelData,
  items: ItemsData,
): void {
  for (const c of classes) {
    const w = `직업 ${c.id}`;
    for (const k of ['hp', 'atk', 'speed', 'attackInterval'] as const) positive(w, k, c[k]);
    nonNegative(w, 'def', c.def);
    if (c.attackType !== 'melee' && c.attackType !== 'ranged') fail(`${w}.attackType 값이 이상해요`);
    if (!Array.isArray(c.skillIds) || c.skillIds.length !== 3) fail(`${w}.skillIds는 스킬 3개여야 해요`);
    for (const id of c.skillIds) if (!skills[id]) fail(`${w}의 스킬 '${id}'가 skills.json에 없어요`);
    for (const k of ['hp', 'atk', 'def'] as const) nonNegative(`${w}.growth`, k, c.growth?.[k]);
  }
  for (const [id, s] of Object.entries(skills)) {
    const w = `스킬 ${id}`;
    if (!SKILL_TYPES.includes(s.type)) fail(`${w}.type '${String(s.type)}'를 몰라요`);
    nonNegative(w, 'mult', s.mult);
    positive(w, 'cooldown', s.cooldown);
    if (['sweep', 'flame', 'stun'].includes(s.type)) positive(w, 'radius', s.radius);
    if (s.type === 'flame') {
      positive(w, 'duration', s.duration);
      positive(w, 'ticks', s.ticks);
      positive(w, 'range', s.range);
    }
    if (s.type === 'guard') {
      positive(w, 'duration', s.duration);
      if (typeof s.reduction !== 'number' || s.reduction <= 0 || s.reduction >= 1) fail(`${w}.reduction은 0과 1 사이여야 해요`);
    }
    if (s.type === 'stun') positive(w, 'stunSec', s.stunSec);
  }
  for (const [id, e] of Object.entries(enemies)) {
    const w = `적 ${id}`;
    for (const k of ['hp', 'atk', 'speed', 'attackInterval', 'radius', 'xp'] as const) positive(w, k, e[k]);
    nonNegative(w, 'def', e.def);
    if (typeof e.dropChance !== 'number' || e.dropChance < 0 || e.dropChance > 1) fail(`${w}.dropChance는 0~1이어야 해요`);
    if (!['melee', 'ranged', 'boss'].includes(e.role)) fail(`${w}.role 값이 이상해요`);
    if (e.role === 'ranged') {
      positive(w, 'keepDistance', e.keepDistance);
      positive(w, 'projectileSpeed', e.projectileSpeed);
    }
    if (e.role === 'boss') {
      positive(w, 'burstInterval', e.burstInterval);
      positive(w, 'burstCount', e.burstCount);
      positive(w, 'projectileSpeed', e.projectileSpeed);
    }
  }
  if (levels.xpCumulative.length !== levels.maxLevel) fail('levels.xpCumulative 길이는 maxLevel과 같아야 해요');
  for (let i = 1; i < levels.xpCumulative.length; i++) {
    if (levels.xpCumulative[i] <= levels.xpCumulative[i - 1]) fail('levels.xpCumulative는 점점 커져야 해요');
  }
  if (!items.grades.length) fail('items.grades가 비어 있어요');
  for (const g of items.grades) {
    positive(`등급 ${g.id}`, 'mult', g.mult);
    positive(`등급 ${g.id}`, 'weight', g.weight);
  }
  for (const [id, s] of Object.entries(items.slots)) {
    if (s.names.length !== items.grades.length) fail(`장비 슬롯 ${id}.names 개수는 등급 수와 같아야 해요`);
    if (!Object.keys(s.stats).length) fail(`장비 슬롯 ${id}.stats가 비어 있어요`);
  }
}

export const CLASSES = classesJson as ClassData[];
export const SKILLS = skillsJson as Record<string, SkillData>;
export const ENEMIES = enemiesJson as Record<string, EnemyData>;
export const LEVELS = levelsJson as LevelData;
export const ITEMS = itemsJson as ItemsData;
validate(CLASSES, SKILLS, ENEMIES, LEVELS, ITEMS);
