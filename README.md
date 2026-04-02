# 🎬 MovieHub

<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-3.x-4FC08D?style=flat-square&logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.0-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/ArtPlayer-HLS-9333EA?style=flat-square" alt="ArtPlayer" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
</p>

<p align="center">
  <strong>一个基于 Vue 3 + Tailwind CSS 打造的现代化、沉浸式影视聚合前端项目。</strong>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-配置指南">配置指南</a> •
  <a href="#-项目截图">项目截图</a> •
  <a href="#-免责声明">免责声明</a>
</p>

---

## 📖 项目介绍

MovieHub 是一个纯前端实现的影视数据展示与播放平台。它采用了最新的 **Vue 3 (Script Setup)** 技术栈，配合 **Tailwind CSS** 实现了高度响应式的暗黑模式 UI。

本项目**不存储任何视频资源**，它通过对接符合通用 CMS 标准（如苹果CMS、Maccms）的 JSON 采集接口来获取数据，旨在提供比传统模板更优雅、更流畅的用户体验。

## ✨ 功能特性

*   **🎨 沉浸式 UI 设计**：
    *   全站暗黑模式，灵感来源于 Netflix / Apple TV。
    *   首页巨幕海报，支持移动端沉浸式底图融合效果。
    *   精美的毛玻璃（Glassmorphism）导航栏与组件。
*   **📱 完美响应式适配**：
    *   PC 端：多列网格布局，悬浮交互。
    *   移动端：独立的汉堡菜单、底部操作栏、触屏优化的横向滚动条。
*   **⚡️ 极速体验**：
    *   基于 Vite 构建，毫秒级热更新。
    *   组件懒加载，骨架屏（Skeleton）加载占位，拒绝白屏闪烁。
*   **🎥 强大的播放器**：
    *   集成 **ArtPlayer**，界面美观，功能强大。
    *   原生支持 **HLS (m3u8)** 流媒体播放。
    *   支持倍速播放、画中画（PIP）、网页全屏、截图、画面比例切换。
    *   支持多播放源（线路）自动解析与切换。
    *   支持选集列表自动定位当前集数。
*   **🔍 搜索与分类**：
    *   支持关键词联想搜索，拥有独立的搜索结果页。
    *   分类页支持横向滚动筛选，鼠标滚轮自动映射为横向滑动。
    *   完整的分页逻辑。

## 🛠️ 技术栈

*   **核心框架**: [Vue 3](https://vuejs.org/) (Composition API)
*   **构建工具**: [Vite](https://vitejs.dev/)
*   **样式库**: [Tailwind CSS](https://tailwindcss.com/)
*   **路由管理**: [Vue Router 4](https://router.vuejs.org/)
*   **图标库**: [Lucide Vue Next](https://lucide.dev/)
*   **视频播放**: [ArtPlayer](https://artplayer.org/) + [Hls.js](https://github.com/video-dev/hls.js/)

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/你的用户名/moviehub.git
cd moviehub
```

### 2. 安装依赖

推荐使用 pnpm

```bash
pnpm install
```

### 3. 配置接口代理

由于浏览器的 CORS（跨域）限制，在本地开发时需要在 `vite.config.js` 中配置代理。
请找到 `server.proxy` 部分，将 `target` 修改为你想要对接的采集站地址。

```javascript
// vite.config.js
export default defineConfig({
  // ...
  server: {
    proxy: {
      '/video': {
        target: 'https://cj.rycjapi.com', // <--- 修改这里为你找的采集源
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/video/, '')
      }
    }
  }
})
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 `http://localhost:3331` 即可看到效果。


## ⚙️ 部署上线

### 构建

```bash
pnpm build
```

构建完成后，`docs` 目录下的文件即为静态资源。

### 关于生产环境跨域

本项目是纯前端项目。如果你的采集源接口**不支持跨域 (No Access-Control-Allow-Origin)**，你需要部署一个轻量级的 Nginx 反向代理或使用 Vercel/Netlify 的 Serverless Functions 来转发请求。

**Nginx 配置示例：**

```nginx
location /video/ {
    proxy_pass https://cj.rycjapi.com/; # 你的采集源地址
    proxy_ssl_server_name on;
}
```

## 🤝 贡献指南

欢迎提交 Issue 或 Pull Request！如果你有更好的 UI 想法或功能建议，请随时告诉我。

1.  Fork 本仓库
2.  新建 Feat_xxx 分支
3.  提交代码
4.  新建 Pull Request

## ⚠️ 免责声明 (Disclaimer)

1.  **仅供学习交流**：本项目主要用于 Vue 3 和 Tailwind CSS 的技术研究与学习，**不得用于任何商业用途**。
2.  **资源来源**：本项目不生产、不存储、不传播任何视频文件。所有数据均来源于互联网公开的第三方采集接口（CMS API）。
3.  **版权风险**：开发者不对任何通过本项目获取的第三方内容的合法性、准确性或版权合规性负责。请使用者在使用前自行核实资源来源的合法性。
4.  **法律责任**：使用者利用本项目从事的任何违法违规行为（包括但不限于传播盗版侵权内容），由使用者自行承担全部法律责任，与本项目开发者无关。

## 📄 License

MIT License © 2025 MovieHub



