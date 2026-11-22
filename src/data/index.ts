import classesJson from './classes.json';
import skillsJson from './skills.json';
import enemiesJson from './enemies.json';

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
  skillId: string;
}
export interface SkillData {
  name: string;
  mult: number;
  cooldown: number;
}
export interface EnemyData {
  name: string;
  color: string;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  attackInterval: number;
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

// 불러올 때 한 번 검사: 누락·범위 오류를 실행 중 이상 동작 대신 명확한 오류로 알린다.
function validate(classes: ClassData[], skills: Record<string, SkillData>, enemies: Record<string, EnemyData>): void {
  for (const c of classes) {
    const w = `직업 ${c.id}`;
    for (const k of ['hp', 'atk', 'speed', 'attackInterval'] as const) positive(w, k, c[k]);
    nonNegative(w, 'def', c.def);
    if (c.attackType !== 'melee' && c.attackType !== 'ranged') fail(`${w}.attackType 값이 이상해요`);
    if (!skills[c.skillId]) fail(`${w}.skillId '${c.skillId}'에 해당하는 스킬이 없어요`);
  }
  for (const [id, s] of Object.entries(skills)) {
    positive(`스킬 ${id}`, 'mult', s.mult);
    positive(`스킬 ${id}`, 'cooldown', s.cooldown);
  }
  for (const [id, e] of Object.entries(enemies)) {
    const w = `적 ${id}`;
    for (const k of ['hp', 'atk', 'speed', 'attackInterval'] as const) positive(w, k, e[k]);
    nonNegative(w, 'def', e.def);
  }
}

export const CLASSES = classesJson as ClassData[];
export const SKILLS = skillsJson as Record<string, SkillData>;
export const ENEMIES = enemiesJson as Record<string, EnemyData>;
validate(CLASSES, SKILLS, ENEMIES);
