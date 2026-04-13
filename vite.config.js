import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: true,
    }),
    Components({
      dts: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'docs', // GitHub Pages 需要输出到 docs 目录
    emptyOutDir: true,
  },
  // 配置 base URL 以支持两种部署方式
  base: process.env.NODE_ENV === 'production' 
    ? (process.env.DEPLOY_TARGET === 'cloudflare' ? '/' : '/cangqiong/') 
    : '/',
})
