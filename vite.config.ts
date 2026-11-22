import { defineConfig } from 'vite';

// base './' : GitHub Pages 하위 주소(저장소 이름 경로)에서도 파일을 찾도록 상대 경로 사용
export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
});
