import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// /api/* (공고문 질문 · 집 비교 질문 · 장소 검색)는 python scripts/server.py 가 답해요.
// 서버 주소를 VITE_API_TARGET 에 넣으면 개발 서버가 그쪽으로 넘겨줘요. 없으면 앱이 미리 넣어 둔 답으로 보여줘요.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_TARGET;
  return {
    plugins: [react()],
    server: { port: 5173, ...(target ? { proxy: { '/api': { target, changeOrigin: true } } } : {}) },
  };
});
