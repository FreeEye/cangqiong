# ─── MovieHub - Docker 部署配置 ───
# 适用于: Hugging Face Spaces / Docker 本地运行 / 其他支持 Docker 的平台

# ---- 阶段 1: 构建前端 ----
FROM node:20-alpine AS build-stage

WORKDIR /app

# 先复制依赖配置（利用 Docker 缓存）
COPY package.json ./
COPY pnpm-lock.yaml* ./

# 安装 pnpm 并安装依赖
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    else npm install; fi

# 复制源码
COPY . .

# 构建前端（会先运行 fetch-data 预取静态 JSON，然后 vite build）
RUN if [ -f pnpm-lock.yaml ]; then pnpm run build; \
    else npm run build; fi

# 构建后：验证 docs 目录存在
RUN ls -la /app/docs/

# ---- 阶段 2: 运行时（轻量，仅包含构建产物和运行时依赖） ----
FROM node:20-alpine AS runtime-stage

WORKDIR /app

# 安装 express
RUN npm install express@^4.19.2 --no-audit --no-fund

# 从构建阶段复制构建产物和服务器脚本
COPY --from=build-stage /app/docs ./docs
COPY --from=build-stage /app/server.cjs ./server.cjs

# 暴露端口（Hugging Face Spaces 用 7860，也兼容其他端口）
ENV PORT=7860
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 7860

# 健康检查
HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:7860/api/health || exit 1

# 启动
CMD ["node", "server.cjs"]
