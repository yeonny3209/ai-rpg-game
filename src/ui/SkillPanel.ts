import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { MAX_SKILL_RANK } from '../entities/Player';
import type { Player } from '../entities/Player';
import { skillMult } from '../systems/progression';

const SKILL_KEYS = ['Q', 'E', 'F'];

function describe(type: string): string {
  switch (type) {
    case 'charge': return '조준 방향으로 돌진하며 부딪힌 적을 벤다';
    case 'sweep': return '주변 원형 범위의 적을 모두 벤다';
    case 'guard': return '일정 시간 받는 피해가 줄어든다';
    case 'bolt': return '강력한 투사체를 발사한다';
    case 'flame': return '조준 지점에 일정 시간 불타는 지대를 만든다';
    case 'stun': return '주변 적에게 피해를 주고 기절시킨다';
    default: return '';
  }
}

/** 스킬 트리 화면. 스킬 포인트로 스킬을 열거나 랭크를 올린다(랭크 1 오를 때 피해 +20%). */
export class SkillPanel {
  private objs: Phaser.GameObjects.GameObject[] = [];
  open = false;

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player) {}

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  close(): void {
    this.open = false;
    this.clear();
  }

  show(): void {
    this.open = true;
    this.render();
  }

  /** 1·2·3 키로도 올릴 수 있게 PlayScene이 부른다 */
  upgrade(index: number): void {
    if (this.player.upgradeSkill(index)) this.render();
  }

  private clear(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  private render(): void {
    this.clear();
    const s = this.scene;
    const p = this.player;
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    this.add(s.add.rectangle(cx, cy, 760, 420, 0x0d1020, 0.96).setStrokeStyle(2, 0x3a4a8a).setDepth(300));
    this.add(s.add.text(cx, cy - 185, `스킬 트리   스킬 포인트 ${p.skillPoints}개   (T 또는 Esc로 닫기)`, { fontSize: '20px', color: '#7df9ff' }).setOrigin(0.5).setDepth(301));
    this.add(s.add.text(cx, cy - 155, '카드를 누르거나 1·2·3 키로 포인트 1개를 써요. 레벨이 오를 때마다 포인트 1개를 얻어요.', { fontSize: '14px', color: '#8fa3c7' }).setOrigin(0.5).setDepth(301));

    p.skills.forEach((sk, i) => {
      const x = cx - 240 + i * 240;
      const y = cy + 10;
      const rank = p.ranks[i];
      const maxed = rank >= MAX_SKILL_RANK;
      const can = !maxed && p.skillPoints > 0;
      const box = this.add(
        s.add.rectangle(x, y, 220, 260, 0x161b2e).setStrokeStyle(3, rank === 0 ? 0x3a4260 : 0x7d8cff).setDepth(301),
      ) as Phaser.GameObjects.Rectangle;
      this.add(s.add.text(x, y - 105, `[${SKILL_KEYS[i]}] ${sk.name}`, { fontSize: '20px', color: rank === 0 ? '#6b7596' : '#ffffff' }).setOrigin(0.5).setDepth(302));
      this.add(
        s.add.text(x, y - 60, describe(sk.type), { fontSize: '13px', color: '#cfefff', wordWrap: { width: 190 }, align: 'center' }).setOrigin(0.5).setDepth(302),
      );
      const dmg = sk.mult > 0 ? `피해 ${(skillMult(sk.mult, Math.max(1, rank)) * 100).toFixed(0)}%` : `피해 감소 ${((sk.reduction ?? 0) * 100).toFixed(0)}%`;
      this.add(s.add.text(x, y + 5, `${dmg}\n대기 ${sk.cooldown}초`, { fontSize: '15px', color: '#ffe66d', align: 'center' }).setOrigin(0.5).setDepth(302));
      const stars = rank === 0 ? '잠김' : '★'.repeat(rank) + '☆'.repeat(MAX_SKILL_RANK - rank);
      this.add(s.add.text(x, y + 55, stars, { fontSize: '22px', color: rank === 0 ? '#6b7596' : '#ffd24d' }).setOrigin(0.5).setDepth(302));
      const label = maxed ? '최대 랭크' : rank === 0 ? '잠금 해제 (1포인트)' : '랭크 업 (1포인트)';
      this.add(s.add.text(x, y + 100, label, { fontSize: '15px', color: maxed ? '#6b7596' : can ? '#7df9ff' : '#ff8a8a' }).setOrigin(0.5).setDepth(302));
      if (can) {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerup', () => this.upgrade(i));
      }
    });
  }
}
