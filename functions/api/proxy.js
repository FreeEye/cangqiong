// Cloudflare Pages Functions - API Proxy
// 文件路径: functions/api/proxy.js
// 处理请求: GET /api/proxy?ac=detail&pg=1&source=0

const VIDEO_SOURCES = [
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/' },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/' },
  { name: '卧龙资源', url: 'https://wolongzyw.com/api.php/provide/vod/' },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/' },
  { name: '无尽资源', url: 'https://api.wujinapi.me/api.php/provide/vod/' },
]

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=30, s-maxage=60',
}

async function fetchFromSource (source, queryString) {
  const targetUrl = `${source.url}?${queryString}`
  try {
    const response = await fetch(targetUrl, {
      cf: { cacheTtl: 30, cacheEverything: true },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    })
    if (!response.ok) return null
    const text = await response.text()
    try { return JSON.parse(text) } catch { return null }
  } catch {
    return null
  }
}

function normalizeData (data, sourceName) {
  if (!data || typeof data !== 'object') return { list: [], class: [] }
  let list = []
  let cls = []

  if (Array.isArray(data.list)) list = data.list
  else if (data.list && typeof data.list === 'object') list = Object.values(data.list)
  else if (Array.isArray(data.vod_list)) list = data.vod_list

  if (Array.isArray(data.class)) cls = data.class
  else if (Array.isArray(data.classes)) cls = data.classes

  if (sourceName) {
    list = list.map(item => ({ ...item, _source: sourceName }))
  }
  return { list, class: cls }
}

export async function onRequestGet (context) {
  const { request } = context
  const url = new URL(request.url)

  // 提取 source 参数（指定要尝试的源索引，0~4）
  const sourceIdx = url.searchParams.get('source')
  url.searchParams.delete('source')

  // 构建传递给视频源的查询字符串
  const queryString = url.searchParams.toString()

  let selectedSources = []
  if (sourceIdx !== null && sourceIdx !== '') {
    const idx = parseInt(sourceIdx)
    if (!isNaN(idx) && idx >= 0 && idx < VIDEO_SOURCES.length) {
      selectedSources = [VIDEO_SOURCES[idx]]
    } else {
      selectedSources = VIDEO_SOURCES
    }
  } else {
    selectedSources = VIDEO_SOURCES
  }

  // 依次尝试每个源，返回第一个成功结果
  let lastError = null
  for (const source of selectedSources) {
    try {
      const rawData = await fetchFromSource(source, queryString)
      if (rawData) {
        const normalized = normalizeData(rawData, source.name)
        if (normalized.list.length > 0 || normalized.class.length > 0) {
          const result = {
            code: 1,
            msg: 'ok',
            list: normalized.list,
            total: normalized.list.length,
            class: normalized.class,
            _source: source.name,
          }
          return new Response(JSON.stringify(result), { status: 200, headers: DEFAULT_HEADERS })
        }
      }
    } catch (error) {
      lastError = error.message
      continue
    }
  }

  // 所有源失败
  return new Response(JSON.stringify({
    code: 0,
    msg: '所有视频源请求失败，请稍后重试',
    list: [],
    total: 0,
    class: [],
    error: lastError,
  }), { status: 200, headers: { ...DEFAULT_HEADERS, 'Cache-Control': 'no-store' } })
}

// OPTIONS 请求处理
export async function onRequestOptions () {
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
