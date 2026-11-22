// 공통 상수. 밸런스 수치는 data/*.json, 여기는 화면·조작 감각용 값만 둔다.
export const GAME_W = 960;
export const GAME_H = 540;
export const ROOM = { left: 40, top: 40, right: 920, bottom: 500 };

export const PLAYER_RADIUS = 14;
export const ENEMY_RADIUS = 12;

// 회피 (docs/BALANCE_P1.md 4장)
export const DODGE = { distance: 160, invuln: 0.25, cooldown: 1.0 };

// 아래 값은 밸런스 문서에 없는 임시값(Phase 1 체감용). 이후 문서에 편입한다.
export const COMBAT = {
  meleeRange: 70,
  meleeHalfAngleDeg: 60,
  projectileSpeed: 520,
  projectileRange: 460,
  projectileRadius: 8,
  skillProjectileRadius: 14,
  chargeDistance: 200,
  chargeDuration: 0.18,
  hitFlashSec: 0.1,
  healOnClear: 0.5, // 웨이브를 클리어하면 최대 체력의 이 비율만큼 회복 (Phase 2 봇 시뮬레이션에서 필요해 추가)
};
