import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { CLASSES, SKILLS } from '../data';

/** 직업 선택 화면. 1·2 키 또는 클릭으로 고른다. */
export class ClassSelectScene extends Phaser.Scene {
  constructor() {
    super('ClassSelectScene');
  }

  create(): void {
    this.add
      .text(GAME_W / 2, 70, '직업을 고르세요', { fontSize: '36px', color: '#7df9ff' })
      .setOrigin(0.5);

    const w = 340;
    const gap = 40;
    const startX = GAME_W / 2 - (CLASSES.length * w + (CLASSES.length - 1) * gap) / 2 + w / 2;

    CLASSES.forEach((cls, i) => {
      const x = startX + i * (w + gap);
      const y = GAME_H / 2 + 10;
      const skillNames = cls.skillIds.map((id) => SKILLS[id].name).join(' · ');
      const color = Phaser.Display.Color.HexStringToColor(cls.color).color;

      const box = this.add
        .rectangle(x, y, w, 260, 0x161b2e)
        .setStrokeStyle(3, color)
        .setInteractive({ useHandCursor: true });
      this.add.circle(x, y - 80, 26, color);
      this.add
        .text(x, y - 30, `${i + 1}. ${cls.name}`, { fontSize: '28px', color: '#ffffff' })
        .setOrigin(0.5);
      this.add
        .text(
          x,
          y + 50,
          [
            `체력 ${cls.hp}   공격 ${cls.atk}   방어 ${cls.def}`,
            `이동 ${cls.speed}   공격 간격 ${cls.attackInterval}초`,
            `기본: ${cls.attackType === 'melee' ? '근접 베기' : '원거리 투사체'}`,
            `스킬: ${skillNames}`,
          ],
          { fontSize: '16px', color: '#cfefff', align: 'center', lineSpacing: 6 },
        )
        .setOrigin(0.5);

      box.on('pointerover', () => box.setFillStyle(0x1f2742));
      box.on('pointerout', () => box.setFillStyle(0x161b2e));
      box.on('pointerup', () => this.choose(cls.id));
    });

    this.add
      .text(GAME_W / 2, GAME_H - 40, 'WASD 이동 · 마우스 조준 · 클릭 공격 · Q/E/F 스킬 · Space 회피 · T 스킬 트리 · I 장비', {
        fontSize: '16px',
        color: '#8fa3c7',
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard;
    if (kb) {
      CLASSES.forEach((cls, i) => {
        kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i).once('down', () => this.choose(cls.id));
      });
    }
  }

  private choose(classId: string): void {
    this.scene.start('PlayScene', { classId });
  }
}
