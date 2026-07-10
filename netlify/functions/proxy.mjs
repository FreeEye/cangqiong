// netlify/functions/proxy.mjs — Netlify Functions 代理端点
// 访问路径：/.netlify/functions/proxy
// 在 netlify.toml 中我们会把 /api/proxy 重写到这里

export const VIDEO_SOURCES = [
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=15, s-maxage=30',
  'Content-Type': 'application/json; charset=utf-8',
}

export const handler = async (event) => {
  // OPTIONS 预检
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...CORS, 'Access-Control-Max-Age': '86400' },
      body: '',
    }
  }

  try {
    const qs = event.queryStringParameters || {}
    const sourceIdx = Math.max(0, Math.min(parseInt(qs.source || '0') || 0, VIDEO_SOURCES.length - 1))
    const source = VIDEO_SOURCES[sourceIdx]

    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(qs)) {
      if (k === 'source') continue
      params.append(k, v)
    }

    const targetUrl = source.url.endsWith('/')
      ? `${source.url}?${params.toString()}`
      : `${source.url}/?${params.toString()}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    const resp = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'application/json, text/plain, */*',
        'Referer': new URL(targetUrl).origin + '/',
      },
    })
    clearTimeout(timer)

    const text = await resp.text()
    try {
      const json = JSON.parse(text)
      if (json && typeof json === 'object') {
        json._source = source.name
        json._source_url = source.url
        return {
          statusCode: resp.ok ? 200 : 502,
          headers: CORS,
          body: JSON.stringify(json),
        }
      }
    } catch { /* 非 JSON */ }

    return {
      statusCode: resp.ok ? 200 : 502,
      headers: CORS,
      body: text,
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({
        code: 502,
        msg: 'Proxy Error: ' + (err?.message || 'Unknown'),
        list: [],
        class: [],
      }),
    }
  }
}
