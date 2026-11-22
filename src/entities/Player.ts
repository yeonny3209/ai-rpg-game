import Phaser from 'phaser';
import { PLAYER_RADIUS, COMBAT } from '../config';
import type { ClassData, SkillData } from '../data';
import type { Enemy } from './Enemy';

/** 플레이어 상태와 겉모습. 이동·공격 판정 로직은 PlayScene/systems가 맡는다. */
export class Player {
  readonly cls: ClassData;
  readonly skill: SkillData;
  readonly body: Phaser.GameObjects.Arc;
  private readonly aimMark: Phaser.GameObjects.Arc;
  private readonly baseColor: number;

  hp: number;
  readonly maxHp: number;
  aim = 0;

  attackCd = 0;
  skillCd = 0;
  dodgeCd = 0;
  dodgeTime = 0;
  dodgeDirX = 0;
  dodgeDirY = 0;
  chargeTime = 0;
  chargeDirX = 0;
  chargeDirY = 0;
  readonly chargeHit = new Set<Enemy>();

  constructor(scene: Phaser.Scene, cls: ClassData, skill: SkillData, x: number, y: number) {
    this.cls = cls;
    this.skill = skill;
    this.hp = this.maxHp = cls.hp;
    this.baseColor = Phaser.Display.Color.HexStringToColor(cls.color).color;
    this.body = scene.add.circle(x, y, PLAYER_RADIUS, this.baseColor).setDepth(10);
    this.aimMark = scene.add.circle(x, y, 4, 0xffffff).setDepth(11);
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
  get dead(): boolean {
    return this.hp <= 0;
  }

  setPosition(x: number, y: number): void {
    this.body.setPosition(x, y);
  }

  tickTimers(dt: number): void {
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.dodgeTime = Math.max(0, this.dodgeTime - dt);
    this.chargeTime = Math.max(0, this.chargeTime - dt);
  }

  /** 조준 방향 표시와 회피 중 반투명 처리 */
  syncVisual(): void {
    this.aimMark.setPosition(this.x + Math.cos(this.aim) * 24, this.y + Math.sin(this.aim) * 24);
    this.body.setAlpha(this.dodging ? 0.45 : 1);
  }

  /** 피해를 입힌다. 무적이면 무시하고 false를 돌려준다. */
  takeDamage(amount: number, scene: Phaser.Scene): boolean {
    if (this.dodging || this.dead) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.body.setFillStyle(0xffffff);
    scene.time.delayedCall(COMBAT.hitFlashSec * 1000, () => this.body.setFillStyle(this.baseColor));
    return true;
  }

  destroy(): void {
    this.body.destroy();
    this.aimMark.destroy();
  }
}
