export interface WaveEntry {
  id: string;
  count: number;
}

/** 웨이브별 적 구성. 5의 배수 웨이브는 보스 + 개 2마리. */
export function waveComposition(wave: number): WaveEntry[] {
  if (wave % 5 === 0) {
    return [
      { id: 'mechBoss', count: 1 },
      { id: 'cyberDog', count: 2 },
    ];
  }
  const w = wave;
  const table: WaveEntry[] = [
    { id: 'cyberDog', count: wave <= 2 ? 3 : Math.ceil(w / 2) + 1 },
    { id: 'scoutDrone', count: wave < 2 ? 0 : Math.floor(w / 2) + (wave >= 3 ? 1 : 0) },
    { id: 'heavyTrooper', count: wave < 3 ? 0 : Math.floor((w - 1) / 2) },
  ];
  return table.filter((e) => e.count > 0);
}
