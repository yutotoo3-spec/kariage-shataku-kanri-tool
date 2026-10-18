import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // 更新頻度の低い外部ライブラリを別ファイルに分け、アプリの更新後もブラウザのキャッシュを使えるようにする
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    // supabase/functions 配下のテストは Deno で実行するため、Vitest の対象は画面側（src）だけにする
    include: ['src/**/*.test.{js,jsx}'],
  },
})
