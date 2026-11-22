import Phaser from 'phaser';
import { GAME_W, GAME_H, ROOM, PLAYER_RADIUS, ENEMY_RADIUS, DODGE, COMBAT } from '../config';
import { CLASSES, SKILLS, ENEMIES } from '../data';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Hud } from '../ui/Hud';
import { calcDamage, circlesOverlap, inCone } from '../systems/combat';
import { inputVector, clamp } from '../systems/movement';

interface Projectile {
  obj: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  traveled: number;
  mult: number;
  radius: number;
}

const MAX_SUBSTEP = 1 / 90; // 한 번에 계산하는 최대 시간(초)

type KeyMap = Record<'W' | 'A' | 'S' | 'D' | 'SPACE' | 'Q' | 'R', Phaser.Input.Keyboard.Key>;

/** 작은 방 전투 씬. 시스템(systems/)과 엔티티·HUD를 연결하고 생명주기만 관리한다. */
export class PlayScene extends Phaser.Scene {
  private classId = CLASSES[0].id;
  private player!: Player;
  private hud!: Hud;
  private keys!: KeyMap;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private wave = 0;
  private kills = 0;
  private waitingNextWave = false;
  private deathText?: Phaser.GameObjects.Text;

  constructor() {
    super('PlayScene');
  }

  init(data: { classId?: string }): void {
    this.classId = data.classId ?? CLASSES[0].id;
    this.enemies = [];
    this.projectiles = [];
    this.wave = 0;
    this.kills = 0;
    this.waitingNextWave = false;
    this.deathText = undefined;
  }

  create(): void {
    const cls = CLASSES.find((c) => c.id === this.classId) ?? CLASSES[0];
    const skill = SKILLS[cls.skillId];

    this.add
      .rectangle((ROOM.left + ROOM.right) / 2, (ROOM.top + ROOM.bottom) / 2, ROOM.right - ROOM.left, ROOM.bottom - ROOM.top, 0x111526)
      .setStrokeStyle(2, 0x2b3a67);

    this.player = new Player(this, cls, skill, GAME_W / 2, GAME_H / 2);
    this.hud = new Hud(this);

    const kb = this.input.keyboard;
    if (!kb) throw new Error('키보드 입력을 사용할 수 없어요');
    this.keys = kb.addKeys('W,A,S,D,SPACE,Q,R') as KeyMap;

    this.spawnWave();

    if (import.meta.env.DEV) {
      // 개발 중 브라우저 확인용 (배포 빌드에서는 제거됨)
      (window as unknown as { __rpg?: unknown }).__rpg = { scene: this };
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05); // 프레임이 늘어져도 한 번에 크게 움직이지 않게
    const p = this.player;

    if (p.dead) {
      this.showDeath();
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.start('ClassSelectScene');
      return;
    }

    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    p.aim = Math.atan2(pointer.worldY - p.y, pointer.worldX - p.x);
    this.handleActions(pointer);

    // 프레임이 늘어져도 돌진·투사체가 적을 건너뛰지 않게 한 프레임을 잘게 쪼개 계산한다 (코덱스 검토 반영)
    const steps = Math.ceil(dt / MAX_SUBSTEP);
    const h = dt / steps;
    for (let i = 0; i < steps && !p.dead; i++) {
      p.tickTimers(h);
      this.movePlayer(h);
      this.updateChargeHits();
      this.updateEnemies(h);
      this.updateProjectiles(h);
    }
    this.checkWave();

    p.syncVisual();
    this.hud.update(p, this.wave, this.kills);
  }

  // ───── 플레이어 ─────
  private movePlayer(dt: number): void {
    const p = this.player;
    const k = this.keys;
    const v = inputVector(k.A.isDown, k.D.isDown, k.W.isDown, k.S.isDown);
    let dx = v.x;
    let dy = v.y;
    let speed = p.cls.speed;

    if (p.dodging) {
      dx = p.dodgeDirX;
      dy = p.dodgeDirY;
      speed = DODGE.distance / DODGE.invuln;
    } else if (p.charging) {
      dx = p.chargeDirX;
      dy = p.chargeDirY;
      speed = COMBAT.chargeDistance / COMBAT.chargeDuration;
    }

    p.setPosition(
      clamp(p.x + dx * speed * dt, ROOM.left + PLAYER_RADIUS, ROOM.right - PLAYER_RADIUS),
      clamp(p.y + dy * speed * dt, ROOM.top + PLAYER_RADIUS, ROOM.bottom - PLAYER_RADIUS),
    );
  }

  private handleActions(pointer: Phaser.Input.Pointer): void {
    const p = this.player;
    const busy = p.dodging || p.charging;

    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) && p.dodgeCd <= 0 && !busy) {
      const v = inputVector(this.keys.A.isDown, this.keys.D.isDown, this.keys.W.isDown, this.keys.S.isDown);
      const hasInput = v.x !== 0 || v.y !== 0;
      p.dodgeDirX = hasInput ? v.x : Math.cos(p.aim);
      p.dodgeDirY = hasInput ? v.y : Math.sin(p.aim);
      p.dodgeTime = DODGE.invuln;
      p.dodgeCd = DODGE.cooldown;
      return;
    }
    if (busy) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.Q) && p.skillCd <= 0) {
      p.skillCd = p.skill.cooldown;
      // Phase 1은 스킬이 직업당 1개라 스킬 종류를 id로 구분한다 (Phase 2에서 데이터 기반으로 일반화)
      if (p.cls.skillId === 'charge') {
        p.chargeTime = COMBAT.chargeDuration;
        p.chargeDirX = Math.cos(p.aim);
        p.chargeDirY = Math.sin(p.aim);
        p.chargeHit.clear();
      } else {
        this.fireProjectile(p.skill.mult, COMBAT.skillProjectileRadius, 0xffe66d);
      }
      return;
    }

    if (pointer.leftButtonDown() && p.attackCd <= 0) {
      p.attackCd = p.cls.attackInterval;
      if (p.cls.attackType === 'melee') this.meleeAttack();
      else this.fireProjectile(1.0, COMBAT.projectileRadius, 0xb9b2ff);
    }
  }

  private meleeAttack(): void {
    const p = this.player;
    const half = (COMBAT.meleeHalfAngleDeg * Math.PI) / 180;
    const fx = this.add
      .circle(p.x + Math.cos(p.aim) * 45, p.y + Math.sin(p.aim) * 45, 32, 0xffffff, 0.35)
      .setDepth(9);
    this.tweens.add({ targets: fx, alpha: 0, duration: 120, onComplete: () => fx.destroy() });
    for (const e of [...this.enemies]) {
      if (inCone(p.x, p.y, p.aim, e.x, e.y, COMBAT.meleeRange + ENEMY_RADIUS, half)) this.hitEnemy(e, 1.0);
    }
  }

  private fireProjectile(mult: number, radius: number, color: number): void {
    const p = this.player;
    const obj = this.add.circle(p.x, p.y, radius, color).setDepth(8);
    this.projectiles.push({
      obj,
      vx: Math.cos(p.aim) * COMBAT.projectileSpeed,
      vy: Math.sin(p.aim) * COMBAT.projectileSpeed,
      traveled: 0,
      mult,
      radius,
    });
  }

  private updateChargeHits(): void {
    const p = this.player;
    if (!p.charging) return;
    for (const e of [...this.enemies]) {
      if (p.chargeHit.has(e)) continue;
      if (circlesOverlap(p.x, p.y, PLAYER_RADIUS + 6, e.x, e.y, ENEMY_RADIUS)) {
        p.chargeHit.add(e);
        this.hitEnemy(e, p.skill.mult);
      }
    }
  }

  // ───── 적 ─────
  private hitEnemy(e: Enemy, mult: number): void {
    const dmg = calcDamage(this.player.cls.atk, mult, e.data.def);
    this.floatText(e.x, e.y - 18, String(dmg), '#ffffff');
    if (e.takeDamage(dmg, this)) {
      this.kills += 1;
      this.enemies = this.enemies.filter((x) => x !== e);
      e.destroy();
    }
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const contact = PLAYER_RADIUS + ENEMY_RADIUS + 6;

    for (const e of this.enemies) {
      e.attackCd = Math.max(0, e.attackCd - dt);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > contact - 4) {
        e.body.setPosition(e.x + (dx / dist) * e.data.speed * dt, e.y + (dy / dist) * e.data.speed * dt);
      }
      if (dist <= contact && e.attackCd <= 0) {
        e.attackCd = e.data.attackInterval;
        const dmg = calcDamage(e.data.atk, 1.0, p.cls.def);
        if (p.takeDamage(dmg, this)) this.floatText(p.x, p.y - 24, `-${dmg}`, '#ff6b6b');
      }
    }

    // 적끼리 겹치지 않게 살짝 밀어낸다
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const min = ENEMY_RADIUS * 2;
        if (d < min) {
          const push = (min - d) / 2;
          a.body.setPosition(a.x - (dx / d) * push, a.y - (dy / d) * push);
          b.body.setPosition(b.x + (dx / d) * push, b.y + (dy / d) * push);
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const pr of [...this.projectiles]) {
      const sx = pr.vx * dt;
      const sy = pr.vy * dt;
      pr.obj.setPosition(pr.obj.x + sx, pr.obj.y + sy);
      pr.traveled += Math.hypot(sx, sy);

      let used = pr.traveled >= COMBAT.projectileRange;
      const out = pr.obj.x < ROOM.left || pr.obj.x > ROOM.right || pr.obj.y < ROOM.top || pr.obj.y > ROOM.bottom;
      if (out) used = true;
      if (!used) {
        for (const e of [...this.enemies]) {
          if (circlesOverlap(pr.obj.x, pr.obj.y, pr.radius, e.x, e.y, ENEMY_RADIUS)) {
            this.hitEnemy(e, pr.mult);
            used = true;
            break;
          }
        }
      }
      if (used) {
        pr.obj.destroy();
        this.projectiles = this.projectiles.filter((x) => x !== pr);
      }
    }
  }

  // ───── 웨이브 ─────
  private spawnWave(): void {
    this.wave += 1;
    const count = 2 + this.wave; // 1웨이브 3마리, 이후 1마리씩 증가
    const data = ENEMIES.cyberDog;
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 20; tries++) {
        x = Phaser.Math.Between(ROOM.left + 20, ROOM.right - 20);
        y = Phaser.Math.Between(ROOM.top + 20, ROOM.bottom - 20);
        if (Math.hypot(x - this.player.x, y - this.player.y) > 250) break;
      }
      this.enemies.push(new Enemy(this, data, x, y));
    }
    this.waitingNextWave = false;
  }

  private checkWave(): void {
    if (this.enemies.length > 0 || this.waitingNextWave) return;
    this.waitingNextWave = true;
    const t = this.add
      .text(GAME_W / 2, 90, `웨이브 ${this.wave} 클리어!`, { fontSize: '28px', color: '#7df9ff' })
      .setOrigin(0.5)
      .setDepth(50);
    this.time.delayedCall(1500, () => {
      t.destroy();
      if (!this.player.dead) this.spawnWave();
    });
  }

  // ───── 표시 ─────
  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontSize: '16px', color }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 500, onComplete: () => t.destroy() });
  }

  private showDeath(): void {
    if (this.deathText) return;
    this.deathText = this.add
      .text(GAME_W / 2, GAME_H / 2, '쓰러졌어요\nR 키: 직업 선택으로', {
        fontSize: '32px',
        color: '#ff6b6b',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(200);
  }
}
