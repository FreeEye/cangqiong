// Hugging Face Spaces / Docker 部署用 - Node.js Express 服务器
// 功能：1) 提供前端静态文件  2) 代理视频源 API（解决浏览器 CORS 限制）
// 运行: node server.cjs (默认端口 7860，符合 Hugging Face Spaces 规范)

const express = require('express')
const http = require('http')
const https = require('https')
const path = require('path')
const fs = require('fs')

const app = express()
const PORT = process.env.PORT || 7860
const HOST = process.env.HOST || '0.0.0.0'

// ─── 1. API 代理（/api/proxy） ───────────────────────────────────────────────
// 将 /api/proxy?ac=detail&pg=1&source=0 转发到对应的视频源
const VIDEO_SOURCES = [
  { name: '非凡资源', url: 'https://cj.ffzyapi.com/api.php/provide/vod/' },
  { name: '量子资源', url: 'https://cj.lziapi.com/api.php/provide/vod/' },
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/' },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/' },
  { name: '红牛资源', url: 'https://www.hongniuzy2.com/api.php/provide/vod/' },
  { name: '光速资源', url: 'https://api.guangsuapi.com/api.php/provide/vod/' },
  { name: '暴风资源', url: 'https://bfzyapi.com/api.php/provide/vod/' },
  { name: '飞速资源', url: 'https://www.feisuzyapi.com/api.php/provide/vod/' },
  { name: '天空资源', url: 'https://m3u8.tiankongapi.com/api.php/provide/vod/' },
  { name: '樱花资源', url: 'https://m3u8.apiyhzy.com/api.php/provide/vod/' },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/' },
  { name: '无尽资源', url: 'https://api.wujinapi.com/api.php/provide/vod/' },
  { name: '360资源', url: 'https://360zy.com/api.php/provide/vod/' },
  { name: '索尼资源', url: 'https://suoniapi.com/api.php/provide/vod/' },
  { name: '牛牛资源', url: 'https://api.niuniuzy.me/api.php/provide/vod/' },
]

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// 带超时的 HTTP/HTTPS 请求
function proxyFetch (targetUrl, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let parsed
    try { parsed = new URL(targetUrl) } catch (e) { reject(e); return }
    const client = parsed.protocol === 'https:' ? https : http

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': parsed.protocol + '//' + parsed.hostname + '/',
      },
      timeout: timeoutMs,
      rejectUnauthorized: false,
    }

    const req = client.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('timeout', () => { req.destroy(new Error('Request Timeout')) })
    req.on('error', reject)
    req.end()
  })
}

// 代理端点
app.get('/api/proxy', async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  try {
    const sourceIdx = parseInt(req.query.source || '0') || 0
    const source = VIDEO_SOURCES[Math.max(0, Math.min(sourceIdx, VIDEO_SOURCES.length - 1))]
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'source') continue
      params.append(k, v)
    }
    const targetUrl = source.url + (source.url.endsWith('/') ? '' : '/') + '?' + params.toString()
    const { status, body } = await proxyFetch(targetUrl, 20000)

    // 响应带上源标记，便于前端调试
    try {
      const json = JSON.parse(body)
      json._source = source.name
      json._source_url = source.url
      res.status(status || 200).send(JSON.stringify(json))
    } catch {
      // 非 JSON 原文返回
      res.status(status || 200).send(body)
    }
  } catch (err) {
    res.status(502).send(JSON.stringify({
      code: 502,
      msg: 'Proxy Error: ' + (err?.message || 'Unknown'),
      list: [],
      class: [],
    }))
  }
})

app.options('/api/proxy', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.status(204).end()
})

// ─── 2. 健康检查 ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), sources: VIDEO_SOURCES.length })
})

// ─── 3. 提供前端静态文件（docs/ 目录是 Vite 构建输出） ────────────────────────
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, 'docs')
if (fs.existsSync(STATIC_DIR)) {
  // 对于 SPA，所有非 API 非静态资源请求都返回 index.html
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    const ext = path.extname(req.path)
    if (ext && fs.existsSync(path.join(STATIC_DIR, req.path))) {
      return express.static(STATIC_DIR)(req, res, next)
    }
    // SPA fallback
    res.sendFile(path.join(STATIC_DIR, 'index.html'))
  })
  app.use(express.static(STATIC_DIR))
} else {
  // 构建产物不存在时给出提示
  app.get('/', (_req, res) => {
    res.type('html').send(`
      <h2>⚠️  前端构建产物不存在</h2>
      <p>请先执行 <code>npm run build</code> 生成 docs/ 目录</p>
      <p><a href="/api/health">健康检查</a></p>
    `)
  })
}

// ─── 启动服务器 ─────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log('='.repeat(60))
  console.log(`🎬 MovieHub 服务器启动成功`)
  console.log(`📍 监听地址: http://${HOST}:${PORT}`)
  console.log(`📂 静态目录: ${fs.existsSync(STATIC_DIR) ? STATIC_DIR : '(未生成)'}  `)
  console.log(`🔌 代理端点: http://${HOST}:${PORT}/api/proxy`)
  console.log(`💊 健康检查: http://${HOST}:${PORT}/api/health`)
  console.log(`📡 视频源数量: ${VIDEO_SOURCES.length}`)
  console.log('='.repeat(60))
})
