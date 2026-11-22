import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';

// Phase 0: 빈 게임 화면이 뜨는지 확인하는 최소 설정
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#0b0d14',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene],
});
