import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// 第 15 课：同一份代码出两种产物。
// - 网页版（npm run build → dist/）：开启 PWA，可在 Chrome 里安装、离线打开。
// - 桌面版（vite build --mode electron → dist-desktop/）：Electron 用 file:// 打开，
//   资源路径必须是相对路径（base: './'），否则 /assets/... 全部 404 白屏；
//   file:// 下 Service Worker 不能用，所以不启用 PWA。路由在 main.jsx 里按同一个 mode 切换。
export default defineConfig(({ mode }) => {
  const desktop = mode === 'electron';
  return {
    base: desktop ? './' : '/',
    build: { outDir: desktop ? 'dist-desktop' : 'dist' },
    plugins: [
      react(),
      !desktop &&
        VitePWA({
          registerType: 'autoUpdate', // 发了新版本，Service Worker 自动更新缓存
          includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: '费曼学习平台',
            short_name: '费曼平台',
            description: '一个基于 AI 的个性化学习平台',
            lang: 'zh-CN',
            theme_color: '#2f6fed',
            background_color: '#f5f7fb',
            display: 'standalone',
            icons: [
              { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            // 缓存页面外壳：脚本、样式、图标、字体。KaTeX 的 ttf、woff 是 woff2 的旧格式备份，不缓存
            globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
            // 默认单个文件超过 2MB 不缓存；主包约 1.8MB、Mermaid 的布局包约 1.4MB，放宽到 3MB
            maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          },
        }),
    ],
  };
});
