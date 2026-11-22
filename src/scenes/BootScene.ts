import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'AI RPG - Phase 0\n준비 완료', {
        fontSize: '32px',
        color: '#7df9ff',
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
