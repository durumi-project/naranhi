import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devApiPlugin } from './scripts/devApiPlugin.mjs'

// devApiPlugin: dev 서버에서 /api/classify 를 Vercel CLI 없이 동일하게 호출 가능하게 함.
// 프로덕션 빌드(`vite build`)에는 영향 없음 — apply:'serve' 로 한정.
export default defineConfig({
  plugins: [devApiPlugin(), react(), tailwindcss()],
})
