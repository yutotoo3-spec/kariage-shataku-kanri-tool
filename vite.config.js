import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // supabase/functions 配下のテストは Deno で実行するため、Vitest の対象は画面側（src）だけにする
    include: ['src/**/*.test.{js,jsx}'],
  },
})
