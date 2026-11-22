import Phaser from 'phaser';
import { GAME_W, GAME_H, ROOM, PLAYER_RADIUS, DODGE, COMBAT } from '../config';
import { CLASSES, ENEMIES, ITEMS } from '../data';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Hud } from '../ui/Hud';
import { InventoryPanel } from '../ui/InventoryPanel';
import { SkillPanel } from '../ui/SkillPanel';
import { calcDamage, circlesOverlap, inCone } from '../systems/combat';
import { inputVector, clamp } from '../systems/movement';
import { skillMult } from '../systems/progression';
import { rollDrop } from '../systems/loot';
import type { Item } from '../systems/loot';
import { waveComposition } from '../systems/waves';

const MAX_SUBSTEP = 1 / 90; // 한 번에 계산하는 최대 시간(초)
const DROP_LIFE = 45; // 바닥 아이템이 사라지기까지(초)
const PICKUP_RANGE = 28;

interface Shot {
  obj: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  traveled: number;
  radius: number;
  /** 플레이어 투사체: 피해 배율. 적 투사체: 공격력 */
  power: number;
}
interface Zone {
  obj: Phaser.GameObjects.Arc;
  x: number;
  y: number;
  radius: number;
  left: number;
  tickEvery: number;
  tickCd: number;
  mult: number;
}
interface Drop {
  item: Item;
  obj: Phaser.GameObjects.Rectangle;
  life: number;
  warnCd: number;
}

type KeyName = 'W' | 'A' | 'S' | 'D' | 'SPACE' | 'Q' | 'E' | 'F' | 'R' | 'I' | 'T' | 'ESC' | 'ONE' | 'TWO' | 'THREE';
type KeyMap = Record<KeyName, Phaser.Input.Keyboard.Key>;

/** 전투 씬. 시스템(systems/)과 엔티티·HUD·패널을 연결하고 생명주기만 관리한다. */
export class PlayScene extends Phaser.Scene {
  private classId = CLASSES[0].id;
  private player!: Player;
  private hud!: Hud;
  private invPanel!: InventoryPanel;
  private skillPanel!: SkillPanel;
  private keys!: KeyMap;
  private enemies: Enemy[] = [];
  private shots: Shot[] = []; // 플레이어 투사체
  private enemyShots: Shot[] = [];
  private zones: Zone[] = [];
  private drops: Drop[] = [];
  private wave = 0;
  private kills = 0;
  private waitingNextWave = false;
  private chargeMult = 1;
  private toastCount = 0;
  private deathText?: Phaser.GameObjects.Text;

  constructor() {
    super('PlayScene');
  }

  init(data: { classId?: string }): void {
    this.classId = data.classId ?? CLASSES[0].id;
    this.enemies = [];
    this.shots = [];
    this.enemyShots = [];
    this.zones = [];
    this.drops = [];
    this.wave = 0;
    this.kills = 0;
    this.waitingNextWave = false;
    this.chargeMult = 1;
    this.toastCount = 0;
    this.deathText = undefined;
  }

  create(): void {
    const cls = CLASSES.find((c) => c.id === this.classId) ?? CLASSES[0];

    this.add
      .rectangle((ROOM.left + ROOM.right) / 2, (ROOM.top + ROOM.bottom) / 2, ROOM.right - ROOM.left, ROOM.bottom - ROOM.top, 0x111526)
      .setStrokeStyle(2, 0x2b3a67);

    this.player = new Player(this, cls, GAME_W / 2, GAME_H / 2);
    this.hud = new Hud(this);
    this.invPanel = new InventoryPanel(this, this.player);
    this.skillPanel = new SkillPanel(this, this.player);

    const kb = this.input.keyboard;
    if (!kb) throw new Error('키보드 입력을 사용할 수 없어요');
    this.keys = kb.addKeys('W,A,S,D,SPACE,Q,E,F,R,I,T,ESC,ONE,TWO,THREE') as KeyMap;

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
      this.invPanel.close();
      this.skillPanel.close();
      this.showDeath();
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.start('ClassSelectScene');
      return;
    }

    if (this.handleMenus()) {
      this.hud.update(p, this.wave, this.kills, this.findBoss());
      return; // 메뉴가 열려 있으면 게임 시간이 멈춘다
    }

    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    p.aim = Math.atan2(pointer.worldY - p.y, pointer.worldX - p.x);
    this.handleActions(pointer);

    // 프레임이 늘어져도 돌진·투사체가 적을 건너뛰지 않게 한 프레임을 잘게 쪼개 계산한다
    const steps = Math.ceil(dt / MAX_SUBSTEP);
    const h = dt / steps;
    for (let i = 0; i < steps && !p.dead; i++) {
      p.tickTimers(h);
      this.movePlayer(h);
      this.updateChargeHits();
      this.updateEnemies(h);
      this.updateShots(h);
      this.updateEnemyShots(h);
      this.updateZones(h);
      this.updateDrops(h);
    }
    this.checkWave();

    p.syncVisual();
    this.hud.update(p, this.wave, this.kills, this.findBoss());
  }

  // ───── 메뉴 ─────
  /** 메뉴 키 처리. 메뉴가 열려 있으면 true */
  private handleMenus(): boolean {
    const k = this.keys;
    if (Phaser.Input.Keyboard.JustDown(k.ESC)) {
      this.invPanel.close();
      this.skillPanel.close();
    }
    if (Phaser.Input.Keyboard.JustDown(k.I)) {
      this.skillPanel.close();
      this.invPanel.toggle();
    }
    if (Phaser.Input.Keyboard.JustDown(k.T)) {
      this.invPanel.close();
      this.skillPanel.toggle();
    }
    if (this.skillPanel.open) {
      if (Phaser.Input.Keyboard.JustDown(k.ONE)) this.skillPanel.upgrade(0);
      if (Phaser.Input.Keyboard.JustDown(k.TWO)) this.skillPanel.upgrade(1);
      if (Phaser.Input.Keyboard.JustDown(k.THREE)) this.skillPanel.upgrade(2);
    }
    return this.invPanel.open || this.skillPanel.open;
  }

  // ───── 플레이어 ─────
  private movePlayer(dt: number): void {
    const p = this.player;
    const k = this.keys;
    const v = inputVector(k.A.isDown, k.D.isDown, k.W.isDown, k.S.isDown);
    let dx = v.x;
    let dy = v.y;
    let speed = p.speed;

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
    const k = this.keys;
    const busy = p.dodging || p.charging;

    if (Phaser.Input.Keyboard.JustDown(k.SPACE) && p.dodgeCd <= 0 && !busy) {
      const v = inputVector(k.A.isDown, k.D.isDown, k.W.isDown, k.S.isDown);
      const hasInput = v.x !== 0 || v.y !== 0;
      p.dodgeDirX = hasInput ? v.x : Math.cos(p.aim);
      p.dodgeDirY = hasInput ? v.y : Math.sin(p.aim);
      p.dodgeTime = DODGE.invuln;
      p.dodgeCd = DODGE.cooldown;
      return;
    }
    if (busy) return;

    const skillKeys = [k.Q, k.E, k.F];
    for (let i = 0; i < skillKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(skillKeys[i]) && this.useSkill(i)) return;
    }

    if (pointer.leftButtonDown() && p.attackCd <= 0) {
      p.attackCd = p.cls.attackInterval;
      if (p.cls.attackType === 'melee') this.meleeAttack();
      else this.fireShot(1.0, COMBAT.projectileRadius, 0xb9b2ff);
    }
  }

  /** 스킬을 쓴다. 쓸 수 없으면(잠김·대기 중) false */
  private useSkill(i: number): boolean {
    const p = this.player;
    const rank = p.ranks[i];
    const sk = p.skills[i];
    if (rank === 0 || p.skillCd[i] > 0) return false;
    const mult = skillMult(sk.mult, rank);

    switch (sk.type) {
      case 'charge':
        this.chargeMult = mult;
        p.chargeTime = COMBAT.chargeDuration;
        p.chargeDirX = Math.cos(p.aim);
        p.chargeDirY = Math.sin(p.aim);
        p.chargeHit.clear();
        break;
      case 'sweep': {
        const r = sk.radius ?? 100;
        this.ring(p.x, p.y, r, 0xffffff);
        for (const e of [...this.enemies]) {
          if (circlesOverlap(p.x, p.y, r, e.x, e.y, e.radius)) this.hitEnemy(e, mult);
        }
        break;
      }
      case 'guard':
        p.guardTime = sk.duration ?? 4;
        p.guardReduction = sk.reduction ?? 0.5;
        this.toast('방어 태세!', '#7df9ff');
        break;
      case 'bolt':
        this.fireShot(mult, COMBAT.skillProjectileRadius, 0xffe66d);
        break;
      case 'flame': {
        const ptr = this.input.activePointer;
        const dist = Math.min(sk.range ?? 300, Math.hypot(ptr.worldX - p.x, ptr.worldY - p.y));
        const x = clamp(p.x + Math.cos(p.aim) * dist, ROOM.left, ROOM.right);
        const y = clamp(p.y + Math.sin(p.aim) * dist, ROOM.top, ROOM.bottom);
        const obj = this.add.circle(x, y, sk.radius ?? 90, 0xff7a29, 0.3).setStrokeStyle(2, 0xffb36b).setDepth(2);
        const ticks = sk.ticks ?? 6;
        const duration = sk.duration ?? 3;
        this.zones.push({ obj, x, y, radius: sk.radius ?? 90, left: duration, tickEvery: duration / ticks, tickCd: 0, mult: mult / ticks });
        break;
      }
      case 'stun': {
        const r = sk.radius ?? 120;
        this.ring(p.x, p.y, r, 0xffe66d);
        for (const e of [...this.enemies]) {
          if (!circlesOverlap(p.x, p.y, r, e.x, e.y, e.radius)) continue;
          e.stunTime = sk.stunSec ?? 2;
          this.hitEnemy(e, mult);
        }
        break;
      }
    }
    p.skillCd[i] = sk.cooldown;
    return true;
  }

  private meleeAttack(): void {
    const p = this.player;
    const half = (COMBAT.meleeHalfAngleDeg * Math.PI) / 180;
    const fx = this.add.circle(p.x + Math.cos(p.aim) * 45, p.y + Math.sin(p.aim) * 45, 32, 0xffffff, 0.35).setDepth(9);
    this.tweens.add({ targets: fx, alpha: 0, duration: 120, onComplete: () => fx.destroy() });
    for (const e of [...this.enemies]) {
      if (inCone(p.x, p.y, p.aim, e.x, e.y, COMBAT.meleeRange + e.radius, half)) this.hitEnemy(e, 1.0);
    }
  }

  private fireShot(mult: number, radius: number, color: number): void {
    const p = this.player;
    const obj = this.add.circle(p.x, p.y, radius, color).setDepth(8);
    this.shots.push({
      obj,
      vx: Math.cos(p.aim) * COMBAT.projectileSpeed,
      vy: Math.sin(p.aim) * COMBAT.projectileSpeed,
      traveled: 0,
      radius,
      power: mult,
    });
  }

  private updateChargeHits(): void {
    const p = this.player;
    if (!p.charging) return;
    for (const e of [...this.enemies]) {
      if (p.chargeHit.has(e)) continue;
      if (circlesOverlap(p.x, p.y, PLAYER_RADIUS + 6, e.x, e.y, e.radius)) {
        p.chargeHit.add(e);
        this.hitEnemy(e, this.chargeMult);
      }
    }
  }

  // ───── 적 ─────
  private hitEnemy(e: Enemy, mult: number): void {
    const dmg = calcDamage(this.player.atk, mult, e.data.def);
    this.floatText(e.x, e.y - e.radius - 6, String(dmg), '#ffffff');
    if (e.takeDamage(dmg, this)) this.onEnemyKilled(e);
  }

  private onEnemyKilled(e: Enemy): void {
    const p = this.player;
    this.kills += 1;
    this.enemies = this.enemies.filter((x) => x !== e);

    const levels = p.addXp(e.data.xp);
    this.floatText(e.x, e.y - 30, `+${e.data.xp} XP`, '#9aa8ff');
    if (levels > 0) this.toast(`레벨 ${p.level}!  스킬 포인트 +${levels}`, '#ffe66d');

    const item = rollDrop(e.id, this.wave, Math.random);
    if (item) this.spawnDrop(item, e.x, e.y);
    if (e.data.role === 'boss') this.toast('보스 처치!', '#ff9d9d');
    e.destroy();
  }

  private findBoss(): Enemy | undefined {
    return this.enemies.find((e) => e.data.role === 'boss');
  }

  private updateEnemies(dt: number): void {
    const p = this.player;

    for (const e of this.enemies) {
      e.tickTimers(dt);
      if (e.stunned) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const contact = PLAYER_RADIUS + e.radius + 6;
      const ux = dx / dist;
      const uy = dy / dist;
      const sp = e.data.speed * dt;

      if (e.data.role === 'ranged') {
        const keep = e.data.keepDistance ?? 250;
        let move = 0;
        if (dist > keep + 30) move = 1;
        else if (dist < keep - 30) move = -1;
        e.body.setPosition(
          clamp(e.x + ux * sp * move, ROOM.left + e.radius, ROOM.right - e.radius),
          clamp(e.y + uy * sp * move, ROOM.top + e.radius, ROOM.bottom - e.radius),
        );
        if (e.attackCd <= 0 && dist < 520) {
          e.attackCd = e.data.attackInterval;
          this.fireEnemyShot(e, Math.atan2(dy, dx));
        }
        continue;
      }

      // 근거리·보스: 추적하고 닿으면 공격
      if (dist > contact - 4) e.body.setPosition(e.x + ux * sp, e.y + uy * sp);
      if (dist <= contact && e.attackCd <= 0) {
        e.attackCd = e.data.attackInterval;
        const real = p.takeDamage(calcDamage(e.data.atk, 1.0, p.def), this);
        if (real > 0) this.floatText(p.x, p.y - 24, `-${real}`, '#ff6b6b');
      }
      if (e.data.role === 'boss' && e.burstCd <= 0) {
        e.burstCd = e.data.burstInterval ?? 4;
        const n = e.data.burstCount ?? 8;
        const offset = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) this.fireEnemyShot(e, offset + (i * Math.PI * 2) / n, 0.6);
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
        const min = a.radius + b.radius;
        if (d < min) {
          const push = (min - d) / 2;
          a.body.setPosition(a.x - (dx / d) * push, a.y - (dy / d) * push);
          b.body.setPosition(b.x + (dx / d) * push, b.y + (dy / d) * push);
        }
      }
    }
  }

  private fireEnemyShot(e: Enemy, angle: number, powerScale = 1): void {
    const speed = e.data.projectileSpeed ?? 280;
    const obj = this.add.circle(e.x, e.y, 6, 0xff6b6b).setDepth(7);
    this.enemyShots.push({
      obj,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      traveled: 0,
      radius: 6,
      power: e.data.atk * powerScale,
    });
  }

  private updateShots(dt: number): void {
    for (const s of [...this.shots]) {
      this.moveShot(s, dt);
      let used = s.traveled >= COMBAT.projectileRange || this.outOfRoom(s);
      if (!used) {
        for (const e of [...this.enemies]) {
          if (circlesOverlap(s.obj.x, s.obj.y, s.radius, e.x, e.y, e.radius)) {
            this.hitEnemy(e, s.power);
            used = true;
            break;
          }
        }
      }
      if (used) {
        s.obj.destroy();
        this.shots = this.shots.filter((x) => x !== s);
      }
    }
  }

  private updateEnemyShots(dt: number): void {
    const p = this.player;
    for (const s of [...this.enemyShots]) {
      this.moveShot(s, dt);
      let used = s.traveled >= 800 || this.outOfRoom(s);
      // 회피 중에는 맞지 않고 그대로 지나간다
      if (!used && !p.dodging && circlesOverlap(s.obj.x, s.obj.y, s.radius, p.x, p.y, PLAYER_RADIUS)) {
        const real = p.takeDamage(calcDamage(s.power, 1.0, p.def), this);
        if (real > 0) this.floatText(p.x, p.y - 24, `-${real}`, '#ff6b6b');
        used = true;
      }
      if (used) {
        s.obj.destroy();
        this.enemyShots = this.enemyShots.filter((x) => x !== s);
      }
    }
  }

  private moveShot(s: Shot, dt: number): void {
    const sx = s.vx * dt;
    const sy = s.vy * dt;
    s.obj.setPosition(s.obj.x + sx, s.obj.y + sy);
    s.traveled += Math.hypot(sx, sy);
  }

  private outOfRoom(s: Shot): boolean {
    return s.obj.x < ROOM.left || s.obj.x > ROOM.right || s.obj.y < ROOM.top || s.obj.y > ROOM.bottom;
  }

  private updateZones(dt: number): void {
    for (const z of [...this.zones]) {
      z.left -= dt;
      z.tickCd -= dt;
      while (z.tickCd <= 0 && z.left > -z.tickEvery) {
        z.tickCd += z.tickEvery;
        for (const e of [...this.enemies]) {
          if (circlesOverlap(z.x, z.y, z.radius, e.x, e.y, e.radius)) this.hitEnemy(e, z.mult);
        }
      }
      if (z.left <= 0) {
        z.obj.destroy();
        this.zones = this.zones.filter((x) => x !== z);
      }
    }
  }

  // ───── 드롭 ─────
  private spawnDrop(item: Item, x: number, y: number): void {
    const color = Phaser.Display.Color.HexStringToColor(ITEMS.grades[item.gradeIndex].color).color;
    const obj = this.add
      .rectangle(clamp(x, ROOM.left + 10, ROOM.right - 10), clamp(y, ROOM.top + 10, ROOM.bottom - 10), 14, 14, color)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(3);
    this.drops.push({ item, obj, life: DROP_LIFE, warnCd: 0 });
  }

  private updateDrops(dt: number): void {
    const p = this.player;
    for (const d of [...this.drops]) {
      d.life -= dt;
      d.warnCd = Math.max(0, d.warnCd - dt);
      const near = Math.hypot(d.obj.x - p.x, d.obj.y - p.y) < PICKUP_RANGE;
      if (near) {
        if (p.addToInventory(d.item)) {
          const g = ITEMS.grades[d.item.gradeIndex];
          this.toast(`획득: ${g.name} ${d.item.name}`, g.color);
          d.obj.destroy();
          this.drops = this.drops.filter((x) => x !== d);
          continue;
        }
        if (d.warnCd <= 0) {
          d.warnCd = 2;
          this.toast('가방이 가득 찼어요 ([I]에서 정리)', '#ff8a8a');
        }
      }
      if (d.life <= 0) {
        d.obj.destroy();
        this.drops = this.drops.filter((x) => x !== d);
      } else if (d.life < 8) {
        d.obj.setAlpha(Math.floor(d.life * 4) % 2 === 0 ? 1 : 0.35); // 곧 사라진다는 깜빡임
      }
    }
  }

  // ───── 웨이브 ─────
  private spawnWave(): void {
    this.wave += 1;
    for (const entry of waveComposition(this.wave)) {
      const data = ENEMIES[entry.id];
      for (let i = 0; i < entry.count; i++) {
        let x = 0;
        let y = 0;
        for (let tries = 0; tries < 20; tries++) {
          x = Phaser.Math.Between(ROOM.left + 40, ROOM.right - 40);
          y = Phaser.Math.Between(ROOM.top + 40, ROOM.bottom - 40);
          if (Math.hypot(x - this.player.x, y - this.player.y) > 250) break;
        }
        this.enemies.push(new Enemy(this, entry.id, data, x, y));
      }
    }
    if (this.wave % 5 === 0) this.toast('보스 등장!', '#ff6b6b');
    this.waitingNextWave = false;
  }

  private checkWave(): void {
    if (this.enemies.length > 0 || this.waitingNextWave) return;
    this.waitingNextWave = true;
    this.onWaveCleared();
    this.time.delayedCall(2000, () => {
      if (!this.player.dead) this.spawnWave();
    });
  }

  /** 웨이브 클리어 보상: 체력 일부 회복 */
  private onWaveCleared(): void {
    const p = this.player;
    const heal = Math.round(p.maxHp * COMBAT.healOnClear);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    this.toast(`웨이브 ${this.wave} 클리어!  체력 +${heal}`, '#7df9ff');
  }

  // ───── 표시 ─────
  private ring(x: number, y: number, r: number, color: number): void {
    const fx = this.add.circle(x, y, r, color, 0.18).setStrokeStyle(2, color).setDepth(9);
    this.tweens.add({ targets: fx, alpha: 0, duration: 200, onComplete: () => fx.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontSize: '16px', color }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 500, onComplete: () => t.destroy() });
  }

  private toast(text: string, color: string): void {
    const y = 96 + (this.toastCount++ % 3) * 24;
    const t = this.add.text(GAME_W / 2, y, text, { fontSize: '20px', color }).setOrigin(0.5).setDepth(120);
    this.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 600, onComplete: () => t.destroy() });
  }

  private showDeath(): void {
    if (this.deathText) return;
    this.deathText = this.add
      .text(GAME_W / 2, GAME_H / 2, '쓰러졌어요\nR 키: 직업 선택으로', { fontSize: '32px', color: '#ff6b6b', align: 'center' })
      .setOrigin(0.5)
      .setDepth(400);
  }
}
