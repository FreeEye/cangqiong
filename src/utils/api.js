// API 工具函数 - 多视频源整合管理
// 优先级策略: ./api/proxy → 静态 JSON → CORS 代理 → 默认数据

// 默认分类（API 不可用时的兜底数据）
const DEFAULT_CATEGORIES = [
  { type_id: 1, type_pid: 0, type_name: '电影' },
  { type_id: 2, type_pid: 0, type_name: '电视剧' },
  { type_id: 3, type_pid: 0, type_name: '综艺' },
  { type_id: 4, type_pid: 0, type_name: '动漫' }
]

// 默认视频（完全无网络时的兜底）
const FALLBACK_VIDEOS = [
  { vod_id: 1001, type_id: 1, vod_name: '示例电影1', vod_pic: 'https://picsum.photos/seed/movie1/300/450', vod_year: '2024', vod_hits: '1000', vod_content: '示例内容' },
  { vod_id: 1002, type_id: 1, vod_name: '示例电影2', vod_pic: 'https://picsum.photos/seed/movie2/300/450', vod_year: '2024', vod_hits: '900', vod_content: '示例内容' },
  { vod_id: 1003, type_id: 2, vod_name: '示例剧集1', vod_pic: 'https://picsum.photos/seed/tv1/300/450', vod_year: '2024', vod_hits: '800', vod_content: '示例内容' },
  { vod_id: 1004, type_id: 2, vod_name: '示例剧集2', vod_pic: 'https://picsum.photos/seed/tv2/300/450', vod_year: '2024', vod_hits: '700', vod_content: '示例内容' },
  { vod_id: 1005, type_id: 3, vod_name: '示例综艺1', vod_pic: 'https://picsum.photos/seed/zy1/300/450', vod_year: '2024', vod_hits: '600', vod_content: '示例内容' },
  { vod_id: 1006, type_id: 4, vod_name: '示例动漫1', vod_pic: 'https://picsum.photos/seed/dm1/300/450', vod_year: '2024', vod_hits: '500', vod_content: '示例内容' }
]

// 视频源列表
export const videoSources = [
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/', isAvailable: true, priority: 1 },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/', isAvailable: true, priority: 2 },
  { name: '卧龙资源', url: 'https://wolongzyw.com/api.php/provide/vod/', isAvailable: true, priority: 3 },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/', isAvailable: true, priority: 4 },
  { name: '无尽资源', url: 'https://api.wujinapi.me/api.php/provide/vod/', isAvailable: true, priority: 5 }
]

let currentSourceIndex = 0
export const getCurrentSource = () => videoSources[currentSourceIndex]
export const setCurrentSource = (index) => {
  if (index >= 0 && index < videoSources.length) {
    currentSourceIndex = index
    try { localStorage.setItem('currentVideoSource', index.toString()) } catch {}
    return true
  }
  return false
}
export const initSourceSetting = () => {
  try {
    const saved = localStorage.getItem('currentVideoSource')
    if (saved !== null) {
      const parsed = parseInt(saved)
      if (!isNaN(parsed) && parsed >= 0 && parsed < videoSources.length) {
        currentSourceIndex = parsed
      }
    }
  } catch {}
}

// ─── 缓存系统 (LRU + TTL) ───
const cache = new Map()
const CACHE_TTL = 10 * 60 * 1000
const MAX_CACHE_SIZE = 50

const getCacheKey = (params, maxPages) => JSON.stringify({ ...params, maxPages })

const setCache = (key, data) => {
  try {
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }
    cache.set(key, { data, timestamp: Date.now() })
  } catch {}
}

const getCache = (key) => {
  try {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data
    if (cached) cache.delete(key)
  } catch {}
  return null
}

const getPersistentCache = (key) => {
  try {
    const item = localStorage.getItem(`api_cache_${key}`)
    if (!item) return null
    const { data, timestamp } = JSON.parse(item)
    if (Date.now() - timestamp < CACHE_TTL) return data
    localStorage.removeItem(`api_cache_${key}`)
  } catch {}
  return null
}

const setPersistentCache = (key, data) => {
  try {
    localStorage.setItem(`api_cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {}
}

// ─── 安全 JSON 解析 ───
const safeJsonParse = (text) => {
  try { return JSON.parse(text) } catch { return null }
}

// ─── 归一化响应数据 ───
const normalizeResponse = (data, sourceName) => {
  if (!data || typeof data !== 'object') return null

  // 统一处理 list 字段
  if (data.list && typeof data.list === 'object' && !Array.isArray(data.list)) {
    data.list = Object.values(data.list)
  }
  if (!Array.isArray(data.list) && Array.isArray(data.vod_list)) {
    data.list = data.vod_list
  }
  if (!Array.isArray(data.list)) data.list = []

  // 处理分类字段
  if (!Array.isArray(data.class) && Array.isArray(data.classes)) {
    data.class = data.classes
  }
  if (!Array.isArray(data.class)) data.class = []

  // 添加来源标记
  if (sourceName) {
    data.list = data.list.map((item, idx) => ({
      ...item,
      _source: sourceName,
      _sourceIndex: videoSources.findIndex(s => s.name === sourceName)
    }))
  }

  return data
}

// ─── 策略 1: 通过 Pages Function 代理 ───
const fetchFromPagesProxy = async (params, timeout = 15000) => {
  const queryString = new URLSearchParams(params).toString()
  const baseUrl = (typeof window !== 'undefined')
    ? new URL(window.location.href).origin + new URL(window.location.href).pathname.split('/').slice(0, -1).join('/') + '/'
    : ''
  const proxyUrl = `${baseUrl}api/proxy?${queryString}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    })

    clearTimeout(timer)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const text = await response.text()
    const data = safeJsonParse(text)
    if (!data) throw new Error('Invalid JSON')

    const normalized = normalizeResponse(data, 'proxy')
    if (normalized) return normalized

    throw new Error('Empty response')
  } catch (error) {
    throw error
  }
}

// ─── 策略 2: 静态 JSON 兜底（构建时预取） ───
const fetchFromStaticJson = async (params) => {
  // 根据参数决定加载哪个静态文件
  const ac = params.ac || 'detail'
  let staticFile = ''

  if (ac === 'list' || ac === 'detail') {
    if (params.wd) staticFile = './data/videos-detail.json'
    else if (params.t) staticFile = `./data/videos-type-${params.t}.json`
    else staticFile = './data/videos-detail.json'
  } else if (params.ids) {
    staticFile = './data/videos-detail.json'
  } else {
    staticFile = './data/videos-detail.json'
  }

  try {
    const response = await fetch(staticFile, { cache: 'no-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const text = await response.text()
    const data = safeJsonParse(text)
    if (!data) throw new Error('Invalid JSON')

    // 根据参数过滤
    if (params.t && data.list) {
      data.list = data.list.filter(item => item.type_id == params.t)
      data.total = data.list.length
    }
    if (params.wd && data.list) {
      const kw = params.wd.toLowerCase()
      data.list = data.list.filter(item =>
        (item.vod_name || '').toLowerCase().includes(kw) ||
        (item.vod_actor || '').toLowerCase().includes(kw)
      )
      data.total = data.list.length
    }
    if (params.pg && data.list) {
      const page = parseInt(params.pg) || 1
      const limit = parseInt(params.limit) || 20
      const start = (page - 1) * limit
      data.list = data.list.slice(start, start + limit)
    }
    if (params.ids && data.list) {
      data.list = data.list.filter(item => item.vod_id == params.ids)
      data.total = data.list.length
    }

    return normalizeResponse(data, 'static')
  } catch (error) {
    throw error
  }
}

// ─── 策略 3: CORS 公共代理（最后手段） ───
const corsProxies = [
  {
    name: 'allorigins-get',
    build: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    parseJson: (text) => {
      try {
        const outer = JSON.parse(text)
        const contents = outer.contents
        if (typeof contents === 'string') {
          return JSON.parse(contents)
        }
        return outer
      } catch { return null }
    }
  },
  { name: 'allorigins-raw', build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` }
]

const fetchFromCorsProxies = async (params, timeout = 15000) => {
  initSourceSetting()
  const queryString = new URLSearchParams(params).toString()

  for (let sourceOffset = 0; sourceOffset < videoSources.length; sourceOffset++) {
    const sourceIdx = (currentSourceIndex + sourceOffset) % videoSources.length
    const source = videoSources[sourceIdx]
    if (!source.isAvailable) continue

    const targetUrl = `${source.url}?${queryString}`

    for (let i = 0; i < corsProxies.length; i++) {
      const proxy = corsProxies[i]
      const requestUrl = proxy.build(targetUrl)

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(requestUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
          cache: 'no-store'
        })

        clearTimeout(timer)

        if (!response.ok) continue

        const text = await response.text()
        const data = proxy.parseJson ? proxy.parseJson(text) : safeJsonParse(text)
        if (!data) continue

        const normalized = normalizeResponse(data, source.name)
        if (normalized) {
          currentSourceIndex = sourceIdx
          return normalized
        }
      } catch {
        continue
      }
    }
  }

  throw new Error('All CORS proxies failed')
}

// ─── 多策略组合调用 ───
const fetchWithStrategies = async (params) => {
  const errors = []

  // 1. 尝试 Pages Function 代理
  try {
    const result = await fetchFromPagesProxy(params)
    if (result && result.list && result.list.length > 0) {
      return result
    }
    if (result && result.class && result.class.length > 0) {
      return result
    }
  } catch (e) {
    errors.push(`proxy: ${e.message}`)
  }

  // 2. 尝试静态 JSON 兜底
  try {
    const result = await fetchFromStaticJson(params)
    if (result && (result.list || result.class)) {
      return result
    }
  } catch (e) {
    errors.push(`static: ${e.message}`)
  }

  // 3. 尝试 CORS 公共代理
  try {
    const result = await fetchFromCorsProxies(params)
    if (result && result.list && result.list.length > 0) {
      return result
    }
    if (result && result.class && result.class.length > 0) {
      return result
    }
  } catch (e) {
    errors.push(`cors: ${e.message}`)
  }

  console.warn('[API] 所有策略都未返回有效数据:', errors.join('; '))
  return null
}

// ─── 公开 API ───

// 统一 API 调用（带自动源切换 + 多策略）
export const fetchFromCurrentSource = async (params) => {
  const result = await fetchWithStrategies(params)
  if (result) return result
  return { list: [], total: 0, class: DEFAULT_CATEGORIES, error: 'all-strategies-failed' }
}

export const apiCall = async (params, options = {}) => {
  const { useAllSources = false, maxResults = 50 } = options
  try {
    if (useAllSources) {
      return await fetchFromCurrentSource(params)
    }
    return await fetchFromCurrentSource(params)
  } catch (error) {
    console.error('[API] 调用失败:', error?.message || error)
    return { list: [], total: 0, class: DEFAULT_CATEGORIES, error: error?.message || 'failed' }
  }
}

// 搜索
export const searchVideos = async (keyword, options = {}) => {
  if (!keyword || !keyword.trim()) return { list: [], total: 0 }

  const data = await fetchFromCurrentSource({ ac: 'detail', wd: keyword.trim() })

  if (data.list && data.list.length > 0) {
    const kw = keyword.toLowerCase()
    const filtered = data.list.filter(item => {
      const titleMatch = (item.vod_name || '').toLowerCase().includes(kw)
      const actorMatch = (item.vod_actor || '').toLowerCase().includes(kw)
      const directorMatch = (item.vod_director || '').toLowerCase().includes(kw)
      const contentMatch = (item.vod_content || '').toLowerCase().includes(kw)
      const blurbMatch = (item.vod_blurb || '').toLowerCase().includes(kw)
      return titleMatch || actorMatch || directorMatch || contentMatch || blurbMatch
    })
    if (filtered.length > 0) {
      data.list = filtered
      data.total = filtered.length
      return data
    }
  }
  return { list: [], total: 0 }
}

// 视频详情
export const getVideoDetail = async (id, sourceIndex = null) => {
  if (!id) return { list: [] }
  const cachedKey = `video_detail_${id}`
  const cached = getPersistentCache(cachedKey)
  if (cached) return cached

  const data = await fetchFromCurrentSource({ ac: 'detail', ids: id })
  if (data.list && data.list.length > 0) {
    setPersistentCache(cachedKey, data)
    return data
  }

  // 兜底：从静态数据中查找
  try {
    const staticData = await fetchFromStaticJson({ ac: 'detail' })
    if (staticData.list) {
      const found = staticData.list.filter(item => item.vod_id == id)
      if (found.length > 0) {
        const result = { list: found, total: 1, class: staticData.class || [] }
        setPersistentCache(cachedKey, result)
        return result
      }
    }
  } catch {}

  return { list: [] }
}

// 分类（带强兜底）
export const getCategories = async () => {
  try {
    const data = await fetchFromCurrentSource({ ac: 'list' })
    let categories = data.class || data.classes || []
    if (!Array.isArray(categories)) categories = []

    // 过滤掉 pid != 0 的子类
    categories = categories.filter(item => item && (item.type_pid === 0 || item.type_pid === '0' || item.type_pid == null))

    if (categories.length === 0) {
      // 尝试从视频数据中提取分类
      const videoData = await fetchFromCurrentSource({ ac: 'detail' })
      if (videoData.list && videoData.list.length > 0) {
        const typeSet = new Map()
        videoData.list.forEach(item => {
          if (item.type_id && item.type_name && !typeSet.has(item.type_id)) {
            typeSet.set(item.type_id, { type_id: item.type_id, type_pid: 0, type_name: item.type_name })
          }
        })
        if (typeSet.size > 0) categories = Array.from(typeSet.values())
      }
    }

    if (categories.length > 0) {
      // 合并默认分类去重
      const existingNames = new Set(categories.map(c => c.type_name))
      DEFAULT_CATEGORIES.forEach(def => {
        if (!existingNames.has(def.type_name)) categories.push(def)
      })
      return categories
    }
  } catch (e) {
    console.warn('[API] 获取分类失败，使用默认分类', e?.message)
  }
  return [...DEFAULT_CATEGORIES]
}

export const getCategoryVideos = async (typeId, page = 1, options = {}) => {
  const data = await fetchFromCurrentSource({ ac: 'detail', t: typeId, pg: page })
  return data
}

// 多源合并
export const fetchFromAllSources = async (params, maxResults = 0, maxPages = 1) => {
  const cacheKey = getCacheKey(params, maxPages)

  // 查缓存
  const memCached = getCache(cacheKey)
  if (memCached) return memCached
  const persistCached = getPersistentCache(cacheKey)
  if (persistCached) {
    return persistCached
  }

  const result = await fetchFromCurrentSource(params)
  if (result.list && result.list.length > 0) {
    // 按播放量排序
    result.list.sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))
    if (maxResults > 0) result.list = result.list.slice(0, maxResults)
    setCache(cacheKey, result)
    setPersistentCache(cacheKey, result)
  }
  return result
}

// 清除所有缓存
export const clearApiCache = () => {
  cache.clear()
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('api_cache_')) keys.push(key)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch {}
}

// 统计
export const getStats = async () => {
  try {
    const data = await fetchFromCurrentSource({ ac: 'detail' })
    const videos = data.list || []
    const totalViews = videos.reduce((sum, v) => sum + (parseInt(v.vod_hits) || 0), 0)
    const typeStats = {}
    videos.forEach(v => {
      const type = v.vod_type_name || v.type_name || '其他'
      if (!typeStats[type]) typeStats[type] = { count: 0, views: 0 }
      typeStats[type].count++
      typeStats[type].views += parseInt(v.vod_hits) || 0
    })
    return {
      totalVideos: videos.length,
      totalViews,
      typeStats,
      sourceData: {},
      sourceStats: videoSources.map(s => ({ name: s.name, isAvailable: s.isAvailable }))
    }
  } catch {
    return { totalVideos: 0, totalViews: 0, typeStats: {}, sourceData: {}, sourceStats: [] }
  }
}

export default apiCall
