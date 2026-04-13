# Cloudflare Pages 部署指南

## 部署步骤

1. **登录 Cloudflare 控制台**
   - 访问 [https://dash.cloudflare.com/](https://dash.cloudflare.com/)
   - 登录你的 Cloudflare 账号

2. **创建 Pages 项目**
   - 点击左侧菜单的 "Pages"
   - 点击 "创建项目"
   - 选择 "连接到 Git"

3. **连接到 GitHub 仓库**
   - 授权 Cloudflare 访问你的 GitHub 账号
   - 选择 `FreeEye/cangqiong` 仓库
   - 配置分支为 `main`

4. **配置构建设置**
   - **构建命令**: `npm run build`
   - **发布目录**: `docs`
   - **环境变量**:
     ```
     NODE_ENV: production
     ```

5. **部署项目**
   - 点击 "保存并部署"
   - Cloudflare 会自动构建并部署你的项目

## 访问地址
部署完成后，你可以通过以下地址访问:
- 默认地址: `https://<project-name>.pages.dev`
- 自定义域名: 可以在 Cloudflare 控制台中配置

## 注意事项
- 确保 `package.json` 中的 `build` 命令正确配置为 `vite build`
- 确保 `vite.config.js` (如果存在) 中的 `base` 配置为 `/`
- Cloudflare Pages 会自动处理 HTTPS 和 CDN 加速
