import Phaser from 'phaser';
import type { Player } from '../entities/Player';

/** 체력바와 쿨다운 표시. 게임 규칙은 모르고 값만 그린다. */
export class Hud {
  private readonly hpBack: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly cdText: Phaser.GameObjects.Text;
  private readonly infoText: Phaser.GameObjects.Text;
  private readonly barWidth = 220;

  constructor(scene: Phaser.Scene) {
    const style = { fontSize: '16px', color: '#cfefff' };
    this.hpBack = scene.add.rectangle(56, 14, this.barWidth, 14, 0x23283a).setOrigin(0, 0.5).setDepth(100);
    this.hpFill = scene.add.rectangle(56, 14, this.barWidth, 14, 0x3ddc84).setOrigin(0, 0.5).setDepth(101);
    this.hpText = scene.add.text(290, 14, '', style).setOrigin(0, 0.5).setDepth(101);
    scene.add.text(12, 14, 'HP', style).setOrigin(0, 0.5).setDepth(101);
    this.cdText = scene.add.text(12, 524, '', style).setOrigin(0, 0.5).setDepth(101);
    this.infoText = scene.add.text(948, 14, '', style).setOrigin(1, 0.5).setDepth(101);
  }

  update(player: Player, wave: number, kills: number): void {
    const ratio = player.hp / player.maxHp;
    this.hpFill.width = Math.max(0, this.barWidth * ratio);
    this.hpFill.setFillStyle(ratio > 0.5 ? 0x3ddc84 : ratio > 0.25 ? 0xffc23d : 0xff4d4d);
    this.hpText.setText(`${player.hp} / ${player.maxHp}`);
    const f = (cd: number): string => (cd <= 0 ? '준비' : `${cd.toFixed(1)}초`);
    this.cdText.setText(
      `[클릭] 공격   [Q] ${player.skill.name}: ${f(player.skillCd)}   [Space] 회피: ${f(player.dodgeCd)}`,
    );
    this.infoText.setText(`${player.cls.name}  웨이브 ${wave}  처치 ${kills}`);
  }
}
