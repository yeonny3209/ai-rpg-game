import Phaser from 'phaser';

/** 시작 씬. 지금은 바로 직업 선택으로 넘어간다 (나중에 에셋 불러오기 단계가 들어올 자리). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.scene.start('ClassSelectScene');
  }
}
