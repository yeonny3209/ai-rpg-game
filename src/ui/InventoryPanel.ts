import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { ITEMS } from '../data';
import type { SlotId } from '../data';
import { INVENTORY_SIZE } from '../entities/Player';
import type { Player } from '../entities/Player';
import { describeStats } from '../systems/loot';
import type { Item } from '../systems/loot';

const SLOT_ORDER: SlotId[] = ['weapon', 'armor', 'accessory'];

/** 장비·인벤토리 화면. 가지고 있는 아이템을 누르면 장착, 장착 칸을 누르면 해제. */
export class InventoryPanel {
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

  private clear(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  private gradeColor(item: Item): string {
    return ITEMS.grades[item.gradeIndex].color;
  }

  private render(): void {
    this.clear();
    const s = this.scene;
    const p = this.player;
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    this.add(s.add.rectangle(cx, cy, 880, 470, 0x0d1020, 0.96).setStrokeStyle(2, 0x3a4a8a).setDepth(300));
    this.add(s.add.text(cx, cy - 215, '장비·인벤토리   (I 또는 Esc로 닫기)', { fontSize: '20px', color: '#7df9ff' }).setOrigin(0.5).setDepth(301));

    // 왼쪽: 장착 중
    const lx = cx - 420;
    this.add(s.add.text(lx, cy - 180, '장착 중 (누르면 해제)', { fontSize: '16px', color: '#9aa8ff' }).setDepth(301));
    SLOT_ORDER.forEach((slot, i) => {
      const item = p.equipment[slot];
      const y = cy - 145 + i * 72;
      const box = this.add(
        s.add.rectangle(lx + 190, y + 28, 380, 66, 0x161b2e).setStrokeStyle(2, item ? Phaser.Display.Color.HexStringToColor(this.gradeColor(item)).color : 0x2b3350).setDepth(301),
      );
      this.add(s.add.text(lx + 10, y + 4, ITEMS.slots[slot].name, { fontSize: '14px', color: '#8fa3c7' }).setDepth(302));
      this.add(
        s.add.text(lx + 10, y + 24, item ? `${ITEMS.grades[item.gradeIndex].name} ${item.name}` : '(비어 있음)', {
          fontSize: '16px',
          color: item ? this.gradeColor(item) : '#5a6480',
        }).setDepth(302),
      );
      if (item) this.add(s.add.text(lx + 10, y + 42, describeStats(item.stats), { fontSize: '13px', color: '#cfefff' }).setDepth(302));
      if (item) {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerup', () => {
          if (!p.unequip(slot)) this.flash('인벤토리가 가득 찼어요');
          this.render();
        });
      }
    });

    // 능력치
    const stat = [`레벨 ${p.level}`, `체력 ${p.maxHp}`, `공격 ${p.atk}`, `방어 ${p.def}`, `이동 ${p.speed}`];
    this.add(s.add.text(lx, cy + 90, stat.join('   '), { fontSize: '16px', color: '#cfefff' }).setDepth(301));

    // 오른쪽: 인벤토리
    const rx = cx + 10;
    this.add(s.add.text(rx, cy - 180, `가방 ${p.inventory.length}/${INVENTORY_SIZE} (누르면 장착)`, { fontSize: '16px', color: '#9aa8ff' }).setDepth(301));
    if (p.inventory.length === 0) {
      this.add(s.add.text(rx, cy - 140, '비어 있어요. 적을 잡아 아이템을 얻어 보세요.', { fontSize: '14px', color: '#5a6480' }).setDepth(301));
    }
    p.inventory.forEach((item, i) => {
      const y = cy - 150 + i * 23;
      const row = this.add(s.add.rectangle(rx + 200, y + 9, 400, 21, 0x161b2e).setDepth(301).setInteractive({ useHandCursor: true }));
      this.add(
        s.add.text(rx + 6, y, `${ITEMS.grades[item.gradeIndex].name} ${item.name}  ${describeStats(item.stats)}`, {
          fontSize: '14px',
          color: this.gradeColor(item),
        }).setDepth(302),
      );
      row.on('pointerover', () => (row as Phaser.GameObjects.Rectangle).setFillStyle(0x222a48));
      row.on('pointerout', () => (row as Phaser.GameObjects.Rectangle).setFillStyle(0x161b2e));
      row.on('pointerup', () => {
        p.equipFromInventory(item.id);
        this.render();
      });
    });
  }

  private flash(msg: string): void {
    const t = this.scene.add.text(GAME_W / 2, GAME_H / 2 + 200, msg, { fontSize: '16px', color: '#ff6b6b' }).setOrigin(0.5).setDepth(310);
    this.scene.time.delayedCall(1200, () => t.destroy());
  }
}
