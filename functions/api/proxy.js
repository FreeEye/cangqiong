// Cloudflare Pages Functions - API Proxy
// 文件路径: functions/api/proxy.js
// 处理请求: GET /api/proxy?ac=detail&pg=1

// 视频源列表（按优先级尝试）
const VIDEO_SOURCES = [
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/' },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/' },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/' },
  { name: '无尽资源', url: 'https://api.wujinapi.me/api.php/provide/vod/' },
]

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)

  // 从请求中提取查询参数（移除 internal path）
  const params = new URLSearchParams()
  for (const [key, value] of url.searchParams.entries()) {
    params.append(key, value)
  }
  const queryString = params.toString()

  // 依次尝试每个视频源
  let lastError = null
  for (const source of VIDEO_SOURCES) {
    try {
      const targetUrl = `${source.url}?${queryString}`
      const response = await fetch(targetUrl, {
        cf: {
          cacheTtl: 30, // 缓存 30 秒
          cacheEverything: true,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
      })

      if (!response.ok) {
        lastError = `HTTP ${response.status}`
        continue
      }

      const text = await response.text()

      // 验证是否为有效 JSON
      try {
        const data = JSON.parse(text)
        // 返回成功结果，带 CORS 头
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Cache-Control': 'public, max-age=30, s-maxage=60',
          },
        })
      } catch (jsonError) {
        lastError = `Invalid JSON from ${source.name}`
        continue
      }
    } catch (error) {
      lastError = error.message
      continue
    }
  }

  // 所有视频源都失败
  return new Response(JSON.stringify({
    code: 0,
    msg: '所有视频源请求失败，请稍后重试',
    list: [],
    total: 0,
    class: [],
    error: lastError,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
  })
}

// OPTIONS 请求处理（CORS 预检）
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
