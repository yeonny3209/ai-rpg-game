import Phaser from 'phaser';
import { ENEMY_RADIUS, COMBAT } from '../config';
import type { EnemyData } from '../data';

/** 적 상태와 겉모습. 추적·공격 로직은 PlayScene이 맡는다. */
export class Enemy {
  readonly data: EnemyData;
  readonly body: Phaser.GameObjects.Arc;
  private readonly baseColor: number;
  hp: number;
  attackCd = 0.5; // 생성 직후 바로 때리지 않게 약간의 대기

  constructor(scene: Phaser.Scene, data: EnemyData, x: number, y: number) {
    this.data = data;
    this.hp = data.hp;
    this.baseColor = Phaser.Display.Color.HexStringToColor(data.color).color;
    this.body = scene.add.circle(x, y, ENEMY_RADIUS, this.baseColor).setDepth(5);
  }

  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }
  get dead(): boolean {
    return this.hp <= 0;
  }

  /** 피해를 입히고, 이번 피해로 죽었는지 돌려준다. */
  takeDamage(amount: number, scene: Phaser.Scene): boolean {
    if (this.dead) return false;
    this.hp -= amount;
    this.body.setFillStyle(0xffffff);
    scene.time.delayedCall(COMBAT.hitFlashSec * 1000, () => {
      if (this.body.active) this.body.setFillStyle(this.baseColor);
    });
    return this.dead;
  }

  destroy(): void {
    this.body.destroy();
  }
}
