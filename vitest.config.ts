import { defineConfig, type Plugin } from 'vitest/config';
import path from 'path';

// jsdom 환경에서는 vitest가 `new URL(literal, import.meta.url)`을 브라우저 자산
// 로더 패턴으로 취급해 dev-server 상대 URL(http://localhost:3000/...)로 치환한다 —
// node:url의 fileURLToPath가 기대하는 file:// URL이 아니라서 테스트가 자기 소스
// 파일을 읽는 흔한 패턴(예: "console.error 호출 0건" 검증)이 깨진다. import.meta.url을
// 아예 거치지 않도록, 변환 시점에 이미 알고 있는 파일 절대경로로 직접 리터럴 치환한다.
const ignoreImportMetaUrlAssetPlugin: Plugin = {
  name: 'resolve-import-meta-url-new-url-literally',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('__tests__') || !code.includes('import.meta.url')) return null;
    const re = /new\s+URL\s*\(\s*(['"`])((?:(?!\1).)*)\1\s*,\s*import\.meta\.url\s*\)/g;
    if (!re.test(code)) return null;
    const dir = path.dirname(id);
    return code.replace(re, (_match, _quote, relPath) => {
      const abs = path.resolve(dir, relPath);
      return `new URL(${JSON.stringify('file://' + abs)})`;
    });
  },
};

export default defineConfig({
  plugins: [ignoreImportMetaUrlAssetPlugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright 비주얼 스펙은 e2e/에 있다 — vitest 실행에서 제외(기본 제외 + e2e).
    // scripts/__tests__는 node:test(`node --test`)용이라 vitest가 수집하지 못한다 — 제외.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'scripts/**'],
    // 워커 폭발 방지(실사고 2026-07-21 global OOM/exit 137): vitest 기본은 CPU 코어 수만큼
    // 포크를 띄운다(16스레드 머신=최대 16개, 각 수백 MB) → jsdom 로드까지 겹쳐 WSL 총 메모리
    // 소진. 미니앱은 테스트 파일이 3~5개라 2포크로 충분하고 메모리를 8배 이상 줄인다.
    pool: 'forks',
    poolOptions: { forks: { minForks: 1, maxForks: 2 } },
  },
});
