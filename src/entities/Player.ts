import Phaser from 'phaser';
import { PLAYER_RADIUS, COMBAT } from '../config';
import { SKILLS, LEVELS } from '../data';
import type { ClassData, SkillData, SlotId, StatKey } from '../data';
import type { Item } from '../systems/loot';
import { baseStatsAt, levelForXp } from '../systems/progression';
import type { Enemy } from './Enemy';

export const MAX_SKILL_RANK = 3;
export const INVENTORY_SIZE = 16;

/** 플레이어 상태와 겉모습. 이동·공격 판정 로직은 PlayScene/systems가 맡는다. */
export class Player {
  readonly cls: ClassData;
  readonly skills: SkillData[];
  readonly body: Phaser.GameObjects.Arc;
  private readonly aimMark: Phaser.GameObjects.Arc;
  private readonly baseColor: number;

  hp: number;
  aim = 0;

  level = 1;
  xp = 0;
  skillPoints = 0;
  /** 스킬별 랭크 (0 = 잠김). 첫 스킬은 처음부터 랭크 1. */
  readonly ranks: number[];
  readonly skillCd: number[] = [0, 0, 0];

  readonly equipment: Partial<Record<SlotId, Item>> = {};
  readonly inventory: Item[] = [];

  attackCd = 0;
  dodgeCd = 0;
  dodgeTime = 0;
  dodgeDirX = 0;
  dodgeDirY = 0;
  chargeTime = 0;
  chargeDirX = 0;
  chargeDirY = 0;
  readonly chargeHit = new Set<Enemy>();
  guardTime = 0;
  guardReduction = 0;

  constructor(scene: Phaser.Scene, cls: ClassData, x: number, y: number) {
    this.cls = cls;
    this.skills = cls.skillIds.map((id) => SKILLS[id]);
    this.ranks = [1, 0, 0];
    this.baseColor = Phaser.Display.Color.HexStringToColor(cls.color).color;
    this.body = scene.add.circle(x, y, PLAYER_RADIUS, this.baseColor).setDepth(10);
    this.aimMark = scene.add.circle(x, y, 4, 0xffffff).setDepth(11);
    this.hp = this.maxHp;
  }

  // ───── 능력치 (레벨 + 장비) ─────
  private equipBonus(stat: StatKey): number {
    let sum = 0;
    for (const it of Object.values(this.equipment)) sum += it?.stats[stat] ?? 0;
    return sum;
  }
  get maxHp(): number {
    return baseStatsAt(this.cls, this.level).hp + this.equipBonus('hp');
  }
  get atk(): number {
    return baseStatsAt(this.cls, this.level).atk + this.equipBonus('atk');
  }
  get def(): number {
    return baseStatsAt(this.cls, this.level).def + this.equipBonus('def');
  }
  get speed(): number {
    return baseStatsAt(this.cls, this.level).speed + this.equipBonus('speed');
  }

  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }
  get dodging(): boolean {
    return this.dodgeTime > 0;
  }
  get charging(): boolean {
    return this.chargeTime > 0;
  }
  get guarding(): boolean {
    return this.guardTime > 0;
  }
  get dead(): boolean {
    return this.hp <= 0;
  }

  // ───── 성장 ─────
  /** 경험치를 얻고, 오른 레벨 수를 돌려준다. 레벨업마다 스킬 포인트 1, 체력 성장분만큼 회복. */
  addXp(amount: number): number {
    this.xp += amount;
    const newLevel = levelForXp(this.xp, LEVELS);
    const gained = newLevel - this.level;
    for (let i = 0; i < gained; i++) {
      this.level += 1;
      this.skillPoints += 1;
      this.hp = Math.min(this.maxHp, this.hp + this.cls.growth.hp);
    }
    return gained;
  }

  /** 스킬 잠금 해제 또는 랭크 업. 성공하면 true. */
  upgradeSkill(index: number): boolean {
    if (index < 0 || index >= this.ranks.length) return false;
    if (this.ranks[index] >= MAX_SKILL_RANK || this.skillPoints < 1) return false;
    this.skillPoints -= 1;
    this.ranks[index] += 1;
    return true;
  }

  // ───── 장비·인벤토리 ─────
  /** 인벤토리의 아이템을 장착한다. 기존 장비는 인벤토리로 돌아간다. */
  equipFromInventory(itemId: number): boolean {
    const idx = this.inventory.findIndex((i) => i.id === itemId);
    if (idx < 0) return false;
    const item = this.inventory[idx];
    const before = this.maxHp;
    const old = this.equipment[item.slot];
    this.inventory.splice(idx, 1);
    if (old) this.inventory.push(old);
    this.equipment[item.slot] = item;
    this.afterGearChange(before);
    return true;
  }

  unequip(slot: SlotId): boolean {
    const item = this.equipment[slot];
    if (!item || this.inventory.length >= INVENTORY_SIZE) return false;
    const before = this.maxHp;
    delete this.equipment[slot];
    this.inventory.push(item);
    this.afterGearChange(before);
    return true;
  }

  addToInventory(item: Item): boolean {
    if (this.inventory.length >= INVENTORY_SIZE) return false;
    this.inventory.push(item);
    return true;
  }

  private afterGearChange(maxHpBefore: number): void {
    const diff = this.maxHp - maxHpBefore;
    this.hp = Math.min(this.maxHp, Math.max(1, this.hp + Math.max(0, diff)));
  }

  setPosition(x: number, y: number): void {
    this.body.setPosition(x, y);
  }

  tickTimers(dt: number): void {
    this.attackCd = Math.max(0, this.attackCd - dt);
    for (let i = 0; i < this.skillCd.length; i++) this.skillCd[i] = Math.max(0, this.skillCd[i] - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.dodgeTime = Math.max(0, this.dodgeTime - dt);
    this.chargeTime = Math.max(0, this.chargeTime - dt);
    this.guardTime = Math.max(0, this.guardTime - dt);
  }

  /** 조준 방향 표시, 회피 중 반투명, 방어 태세 중 테두리 */
  syncVisual(): void {
    this.aimMark.setPosition(this.x + Math.cos(this.aim) * 24, this.y + Math.sin(this.aim) * 24);
    this.body.setAlpha(this.dodging ? 0.45 : 1);
    if (this.guarding) this.body.setStrokeStyle(4, 0x7df9ff);
    else this.body.setStrokeStyle(0);
  }

  /** 피해를 입힌다(방어 태세면 줄어듦). 무적이면 무시하고 0을 돌려준다. 실제 받은 피해를 반환. */
  takeDamage(amount: number, scene: Phaser.Scene): number {
    if (this.dodging || this.dead) return 0;
    const real = Math.max(1, Math.round(amount * (this.guarding ? 1 - this.guardReduction : 1)));
    this.hp = Math.max(0, this.hp - real);
    this.body.setFillStyle(0xffffff);
    scene.time.delayedCall(COMBAT.hitFlashSec * 1000, () => this.body.setFillStyle(this.baseColor));
    return real;
  }

  destroy(): void {
    this.body.destroy();
    this.aimMark.destroy();
  }
}
