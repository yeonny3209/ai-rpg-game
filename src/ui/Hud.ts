import Phaser from 'phaser';
import { GAME_W } from '../config';
import { LEVELS } from '../data';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';

const SKILL_KEYS = ['Q', 'E', 'F'];

/** 체력·경험치·쿨다운·보스 체력 표시. 게임 규칙은 모르고 값만 그린다. */
export class Hud {
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly xpFill: Phaser.GameObjects.Rectangle;
  private readonly cdText: Phaser.GameObjects.Text;
  private readonly infoText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly bossBack: Phaser.GameObjects.Rectangle;
  private readonly bossFill: Phaser.GameObjects.Rectangle;
  private readonly bossName: Phaser.GameObjects.Text;
  private readonly barWidth = 220;
  private readonly bossWidth = 420;

  constructor(scene: Phaser.Scene) {
    const style = { fontSize: '16px', color: '#cfefff' };
    scene.add.rectangle(56, 14, this.barWidth, 14, 0x23283a).setOrigin(0, 0.5).setDepth(100);
    this.hpFill = scene.add.rectangle(56, 14, this.barWidth, 14, 0x3ddc84).setOrigin(0, 0.5).setDepth(101);
    this.hpText = scene.add.text(290, 14, '', style).setOrigin(0, 0.5).setDepth(101);
    scene.add.text(12, 14, 'HP', style).setOrigin(0, 0.5).setDepth(101);

    scene.add.rectangle(56, 32, this.barWidth, 6, 0x23283a).setOrigin(0, 0.5).setDepth(100);
    this.xpFill = scene.add.rectangle(56, 32, 0, 6, 0x7d8cff).setOrigin(0, 0.5).setDepth(101);
    scene.add.text(12, 32, 'XP', { fontSize: '12px', color: '#9aa8ff' }).setOrigin(0, 0.5).setDepth(101);

    this.cdText = scene.add.text(12, 524, '', style).setOrigin(0, 0.5).setDepth(101);
    this.infoText = scene.add.text(948, 14, '', style).setOrigin(1, 0.5).setDepth(101);
    this.hintText = scene.add.text(948, 524, '', { fontSize: '16px', color: '#ffe66d' }).setOrigin(1, 0.5).setDepth(101);

    this.bossBack = scene.add.rectangle(GAME_W / 2, 52, this.bossWidth, 12, 0x3a1f26).setDepth(100).setVisible(false);
    this.bossFill = scene.add.rectangle(GAME_W / 2 - this.bossWidth / 2, 52, this.bossWidth, 12, 0xff5555).setOrigin(0, 0.5).setDepth(101).setVisible(false);
    this.bossName = scene.add.text(GAME_W / 2, 70, '', { fontSize: '14px', color: '#ffb3b3' }).setOrigin(0.5).setDepth(101).setVisible(false);
  }

  update(player: Player, wave: number, kills: number, boss?: Enemy): void {
    const ratio = player.hp / player.maxHp;
    this.hpFill.width = Math.max(0, this.barWidth * ratio);
    this.hpFill.setFillStyle(ratio > 0.5 ? 0x3ddc84 : ratio > 0.25 ? 0xffc23d : 0xff4d4d);
    this.hpText.setText(`${player.hp} / ${player.maxHp}`);

    const lv = player.level;
    const lo = LEVELS.xpCumulative[lv - 1];
    const hi = lv >= LEVELS.maxLevel ? lo : LEVELS.xpCumulative[lv];
    this.xpFill.width = hi > lo ? this.barWidth * Math.min(1, (player.xp - lo) / (hi - lo)) : this.barWidth;

    const f = (cd: number): string => (cd <= 0 ? '준비' : `${cd.toFixed(1)}초`);
    const parts = player.skills.map((s, i) =>
      player.ranks[i] === 0 ? `[${SKILL_KEYS[i]}] 잠김` : `[${SKILL_KEYS[i]}] ${s.name} ${f(player.skillCd[i])}`,
    );
    this.cdText.setText(`${parts.join('  ')}  [Space] 회피 ${f(player.dodgeCd)}`);
    this.infoText.setText(`${player.cls.name} Lv.${lv}  웨이브 ${wave}  처치 ${kills}`);
    this.hintText.setText(
      `${player.skillPoints > 0 ? `스킬 포인트 ${player.skillPoints}개!  ` : ''}[T] 스킬  [I] 장비`,
    );

    const show = !!boss && !boss.dead;
    this.bossBack.setVisible(show);
    this.bossFill.setVisible(show);
    this.bossName.setVisible(show);
    if (show && boss) {
      this.bossFill.width = Math.max(0, this.bossWidth * (boss.hp / boss.data.hp));
      this.bossName.setText(`${boss.data.name}  ${Math.max(0, Math.round(boss.hp))} / ${boss.data.hp}`);
    }
  }
}
