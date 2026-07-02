// API 工具函数 - 多视频源整合管理
// 优先级策略: Pages Function 代理 → 静态 JSON → CORS 代理 → 默认数据

const DEFAULT_CATEGORIES = [
  { type_id: 1, type_pid: 0, type_name: '电影' },
  { type_id: 2, type_pid: 0, type_name: '电视剧' },
  { type_id: 3, type_pid: 0, type_name: '综艺' },
  { type_id: 4, type_pid: 0, type_name: '动漫' },
]

export const videoSources = [
  // ─── 第一梯队：稳定高优先级（优先尝试）
  { name: '非凡资源', url: 'https://cj.ffzyapi.com/api.php/provide/vod/', isAvailable: true, priority: 1 },
  { name: '量子资源', url: 'https://cj.lziapi.com/api.php/provide/vod/', isAvailable: true, priority: 2 },
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/', isAvailable: true, priority: 3 },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/', isAvailable: true, priority: 4 },
  { name: '红牛资源', url: 'https://www.hongniuzy2.com/api.php/provide/vod/', isAvailable: true, priority: 5 },
  
  // ─── 第二梯队：备选资源（第一梯队失败时使用）
  { name: '光速资源', url: 'https://api.guangsuapi.com/api.php/provide/vod/', isAvailable: true, priority: 6 },
  { name: '暴风资源', url: 'https://bfzyapi.com/api.php/provide/vod/', isAvailable: true, priority: 7 },
  { name: '飞速资源', url: 'https://www.feisuzyapi.com/api.php/provide/vod/', isAvailable: true, priority: 8 },
  { name: '天空资源', url: 'https://m3u8.tiankongapi.com/api.php/provide/vod/', isAvailable: true, priority: 9 },
  { name: '樱花资源', url: 'https://m3u8.apiyhzy.com/api.php/provide/vod/', isAvailable: true, priority: 10 },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/', isAvailable: true, priority: 11 },
  { name: '无尽资源', url: 'https://api.wujinapi.com/api.php/provide/vod/', isAvailable: true, priority: 12 },
  
  // ─── 第三梯队：备用资源（较少使用）
  { name: '360资源', url: 'https://360zy.com/api.php/provide/vod/', isAvailable: true, priority: 13 },
  { name: '索尼资源', url: 'https://suoniapi.com/api.php/provide/vod/', isAvailable: true, priority: 14 },
  { name: '牛牛资源', url: 'https://api.niuniuzy.me/api.php/provide/vod/', isAvailable: true, priority: 15 },
]

let currentSourceIndex = 0

export const getCurrentSource = () => videoSources[currentSourceIndex]
export const setCurrentSource = (index) => {
  if (index >= 0 && index < videoSources.length) {
    currentSourceIndex = index
    try { localStorage.setItem('currentVideoSource', index.toString()) } catch { /* ignore */ }
    clearApiCache()
    try { window.dispatchEvent(new Event('videoSourceChanged')) } catch { /* ignore */ }
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
  } catch { /* ignore */ }
}

const cache = new Map()
const CACHE_TTL = 10 * 60 * 1000
const MAX_CACHE_SIZE = 50

const getCacheKey = (params, extra = 0) => JSON.stringify({ ...params, _e: extra })
const setCache = (key, data) => {
  try {
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }
    cache.set(key, { data, timestamp: Date.now() })
  } catch { /* ignore */ }
}
const getCache = (key) => {
  try {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data
    if (cached) cache.delete(key)
  } catch { /* ignore */ }
  return null
}
const getPersistentCache = (key) => {
  try {
    const item = localStorage.getItem('api_cache_' + key)
    if (!item) return null
    const { data, timestamp } = JSON.parse(item)
    if (Date.now() - timestamp < CACHE_TTL) return data
    localStorage.removeItem('api_cache_' + key)
  } catch { /* ignore */ }
  return null
}
const setPersistentCache = (key, data) => {
  try {
    localStorage.setItem('api_cache_' + key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* ignore */ }
}

// 工具函数: 判断是否为 GitHub Pages
const isGitHubPages = () => {
  try {
    return typeof window !== 'undefined' && window.location.hostname.indexOf('github.io') !== -1
  } catch { /* ignore */ }
  return false
}

// 安全 JSON 解析
const safeJsonParse = (text) => {
  try { return JSON.parse(text) } catch { return null }
}

// 归一化响应
const normalizeResponse = (data, sourceName) => {
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

// 我们的 Cloudflare Pages 代理主机（GitHub Pages 上通过它跨域获取实时数据）
const CLOUDFLARE_PAGES_HOST = 'https://cangqiong-9gv.pages.dev'

// ─── 策略 1: Pages Function 代理
// - Cloudflare Pages / 本地开发: 同域 /api/proxy
// - GitHub Pages: 跨域 https://cangqiong-9gv.pages.dev/api/proxy (proxy.js 有 CORS 头)
const fetchFromPagesProxy = async (params, timeout = 15000) => {
  initSourceSetting()
  const queryString = new URLSearchParams(params).toString()

  // 根据环境选择代理 URL
  let proxyUrl
  if (isGitHubPages()) {
    proxyUrl = `${CLOUDFLARE_PAGES_HOST}/api/proxy?${queryString}`
  } else {
    proxyUrl = `${window.location.origin}/api/proxy?${queryString}`
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const text = await response.text()
    const data = safeJsonParse(text)
    if (!data) throw new Error('Invalid JSON')
    return normalizeResponse(data, data._source || 'proxy')
  } catch (error) {
    throw error
  }
}

// ─── 策略 2: 静态 JSON 兜底（构建时预取，GitHub Pages 依赖）
const fetchFromStaticJson = async (params) => {
  const staticFile = './data/videos-detail.json'
  try {
    const response = await fetch(staticFile, { cache: 'no-cache' })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const text = await response.text()
    const data = safeJsonParse(text)
    if (!data) throw new Error('Invalid JSON')
    let result = normalizeResponse(data, 'static')
    // 根据参数过滤
    if (params.t && result.list) {
      result.list = result.list.filter(item => String(item.type_id) === String(params.t))
      result.total = result.list.length
    }
    // wd: 关键词搜索 - 做全量数据搜索，不应用分页
    const isSearch = params.wd || params.keyword || params.search
    if (isSearch && result.list) {
      const kw = String(isSearch).toLowerCase()
      result.list = result.list.filter(item => {
        const fieldsToSearch = [
          String(item.vod_name || ''),
          String(item.vod_actor || ''),
          String(item.vod_director || ''),
          String(item.vod_type_name || item.type_name || ''),
          String(item.vod_en || ''),
        ]
        return fieldsToSearch.some(f => f.toLowerCase().includes(kw))
      })
      result.total = result.list.length
      return result // 搜索不走分页
    }
    if (params.pg && result.list) {
      const page = parseInt(params.pg) || 1
      const limit = parseInt(params.limit) || 20
      const start = (page - 1) * limit
      result.list = result.list.slice(start, start + limit)
    }
    if (params.ids && result.list) {
      result.list = result.list.filter(item => String(item.vod_id) === String(params.ids))
      result.total = result.list.length
    }
    return result
  } catch (error) {
    throw error
  }
}

// ─── 策略 3: CORS 公共代理（仅作最后的兜底，大多数公共代理不稳定/已失效）
// 注意：GitHub Pages 主要策略是 Cloudflare Pages 代理 (CLOUDFLARE_PAGES_HOST)，
//       CORS 代理仅在 Cloudflare Pages 也不可用时兜底
const corsProxies = [
  {
    name: 'corsproxy-io',
    build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
  {
    name: 'allorigins-raw',
    build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
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
    },
  },
]

const fetchFromCorsProxies = async (params, specificSourceIndex = null, timeout = 8000) => {
  initSourceSetting()
  const queryString = new URLSearchParams(params).toString()
  const sourceOffsets = specificSourceIndex !== null
    ? [specificSourceIndex]
    : [0, 1, 2, 3, 4].map(offset => (currentSourceIndex + offset) % videoSources.length)
  for (const sourceIdx of sourceOffsets) {
    const source = videoSources[sourceIdx]
    if (!source || !source.isAvailable) continue
    const targetUrl = `${source.url}?${queryString}`
    for (let i = 0; i < corsProxies.length; i++) {
      const proxy = corsProxies[i]
      try {
        const requestUrl = proxy.build(targetUrl)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)
        const response = await fetch(requestUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
          cache: 'no-store',
        })
        clearTimeout(timer)
        if (!response.ok) continue
        const text = await response.text()
        const data = proxy.parseJson ? proxy.parseJson(text) : safeJsonParse(text)
        if (!data) continue
        const normalized = normalizeResponse(data, source.name)
        if (normalized && (normalized.list.length > 0 || normalized.class.length > 0)) {
          if (specificSourceIndex === null) currentSourceIndex = sourceIdx
          return normalized
        }
      } catch { continue }
    }
  }
  throw new Error('All CORS proxies failed')
}

// ─── 多策略组合调用（带源优先级）
// strategyOrder: 'proxy' (Pages Function), 'static' (JSON), 'cors' (CORS proxy)
const fetchWithStrategies = async (params, forceSourceIndex = null) => {
  initSourceSetting()
  // Pages Function 代理（优先级最高）
  try {
    const proxyParams = forceSourceIndex !== null
      ? { ...params, source: forceSourceIndex }
      : { ...params, source: currentSourceIndex }
    const result = await fetchFromPagesProxy(proxyParams)
    if (result && (result.list.length > 0 || result.class.length > 0)) {
      return result
    }
  } catch { /* 静默降级到下一个策略 */ }
  // 静态 JSON 兜底
  try {
    const result = await fetchFromStaticJson(params)
    if (result && (result.list.length > 0 || result.class.length > 0)) {
      return result
    }
  } catch { /* 继续降级 */ }
  // CORS 代理
  try {
    const result = await fetchFromCorsProxies(params, forceSourceIndex)
    if (result && (result.list.length > 0 || result.class.length > 0)) {
      return result
    }
  } catch { /* 继续降级 */ }
  return null
}

// ─── 公开 API
export const fetchFromCurrentSource = async (params) => {
  const result = await fetchWithStrategies(params)
  if (result) return result
  return { list: [], total: 0, class: DEFAULT_CATEGORIES, error: 'all-strategies-failed' }
}

export const apiCall = async (params) => {
  try {
    return await fetchFromCurrentSource(params)
  } catch (error) {
    return { list: [], total: 0, class: DEFAULT_CATEGORIES, error: error?.message || 'failed' }
  }
}

// 多源合并（拉取多页）
export const fetchFromAllSources = async (params, maxResults = 0, maxPages = 3) => {
  const cacheKey = getCacheKey(params, maxPages)
  const memCached = getCache(cacheKey)
  if (memCached) return memCached
  const persistCached = getPersistentCache(cacheKey)
  if (persistCached) return persistCached

  // 策略 1: Pages Function 代理（真实数据）- GitHub Pages 上通过 Cloudflare Pages 代理
  initSourceSetting()
  try {
    const allList = []
    const seen = new Set()
    let allClass = []
    for (let page = 1; page <= maxPages; page++) {
      try {
        const pageParams = { ...params, pg: page, source: currentSourceIndex }
        const pageData = await fetchFromPagesProxy(pageParams)
        if (pageData && pageData.list && pageData.list.length > 0) {
          if (pageData.class && pageData.class.length > 0 && allClass.length === 0) {
            allClass = pageData.class
          }
          for (const item of pageData.list) {
            if (!item || !item.vod_name) continue
            const key = `${item.vod_name}_${item.vod_year || ''}_${item.vod_id}`
            if (!seen.has(key)) {
              seen.add(key)
              allList.push(item)
            }
          }
          if (pageData.list.length < 20) break
        } else {
          break
        }
      } catch { break }
    }
    if (allList.length > 0) {
      allList.sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))
      const finalList = maxResults > 0 ? allList.slice(0, maxResults) : allList
      const result = { list: finalList, total: finalList.length, class: allClass.length > 0 ? allClass : DEFAULT_CATEGORIES }
      setCache(cacheKey, result)
      setPersistentCache(cacheKey, result)
      return result
    }
  } catch { /* 降级到下一个策略 */ }

  // 策略 2: 静态 JSON（构建时预取）
  try {
    const result = await fetchFromStaticJson(params)
    if (result && result.list && result.list.length > 0) {
      result.list.sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))
      if (maxResults > 0) result.list = result.list.slice(0, maxResults)
      setCache(cacheKey, result)
      setPersistentCache(cacheKey, result)
      return result
    }
  } catch { /* 继续降级 */ }

  // 策略 3: CORS 代理（最后兜底）
  try {
    const result = await fetchFromCorsProxies(params)
    if (result && result.list && result.list.length > 0) {
      result.list.sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))
      if (maxResults > 0) result.list = result.list.slice(0, maxResults)
      setCache(cacheKey, result)
      setPersistentCache(cacheKey, result)
      return result
    }
  } catch { /* 继续降级 */ }

  return { list: [], total: 0, class: DEFAULT_CATEGORIES }
}

// 搜索
export const searchVideos = async (keyword) => {
  if (!keyword || !keyword.trim()) return { list: [], total: 0 }
  const kw = keyword.trim().toLowerCase()
  const matchFields = (item) => {
    if (!item) return false
    const fields = [
      String(item.vod_name || ''),
      String(item.vod_actor || ''),
      String(item.vod_director || ''),
      String(item.vod_type_name || item.type_name || ''),
      String(item.vod_en || ''),
      String(item.vod_blurb || ''),
      String(item.vod_content || ''),
    ]
    return fields.some(f => f.toLowerCase().includes(kw))
  }

  // 策略 1: 先从静态 JSON 搜索（最稳定、最快）
  try {
    const staticData = await fetchFromStaticJson({ wd: keyword })
    if (staticData && staticData.list && staticData.list.length > 0) {
      const filtered = staticData.list.filter(matchFields)
      if (filtered.length > 0) {
        return { list: filtered, total: filtered.length, class: staticData.class || DEFAULT_CATEGORIES }
      }
    }
  } catch { /* 继续降级 */ }

  // 策略 2: 通过 Cloudflare Pages 代理从多源拉取数据再做客户端搜索
  // 注意：GitHub Pages 上也会走这个路径（通过 Cloudflare Pages 的公开代理 URL）
  try {
    const allResults = []
    const seen = new Set()
    // 遍历所有源，拉取 pg=1~3 的数据，然后做客户端搜索
    for (let srcIdx = 0; srcIdx < videoSources.length; srcIdx++) {
      for (let page = 1; page <= 3; page++) {
        try {
          const sourceData = await fetchFromPagesProxy({ ac: 'detail', pg: page, source: srcIdx })
          if (sourceData && sourceData.list && sourceData.list.length > 0) {
            for (const item of sourceData.list) {
              if (!item || !item.vod_name) continue
              const key = `${item.vod_name}_${item.vod_id || ''}`
              if (!seen.has(key)) {
                seen.add(key)
                allResults.push(item)
              }
            }
            if (sourceData.list.length < 20) break
          } else {
            break
          }
        } catch { break }
      }
    }
    const filtered = allResults.filter(matchFields)
    if (filtered.length > 0) {
      return { list: filtered, total: filtered.length, class: DEFAULT_CATEGORIES }
    }
  } catch { /* 继续降级 */ }

  // 策略 3: CORS 代理 - 拉取数据做客户端搜索
  try {
    const allResults = []
    const seen = new Set()
    for (let srcIdx = 0; srcIdx < videoSources.length; srcIdx++) {
      for (let page = 1; page <= 2; page++) {
        try {
          const sourceData = await fetchFromCorsProxies({ ac: 'detail', pg: page }, srcIdx)
          if (sourceData && sourceData.list && sourceData.list.length > 0) {
            for (const item of sourceData.list) {
              if (!item || !item.vod_name) continue
              const key = `${item.vod_name}_${item.vod_id || ''}`
              if (!seen.has(key)) {
                seen.add(key)
                allResults.push(item)
              }
            }
          } else {
            break
          }
        } catch { break }
      }
    }
    const filtered = allResults.filter(matchFields)
    if (filtered.length > 0) {
      return { list: filtered, total: filtered.length, class: DEFAULT_CATEGORIES }
    }
  } catch { /* 忽略，继续返回空 */ }

  // 兜底：返回空
  return { list: [], total: 0, class: DEFAULT_CATEGORIES }
}

// 视频详情
export const getVideoDetail = async (id) => {
  if (!id) return { list: [] }
  const cachedKey = 'detail_' + id
  const cached = getPersistentCache(cachedKey)
  if (cached) return cached
  // 尝试实时拉取
  const data = await fetchFromCurrentSource({ ac: 'detail', ids: id })
  if (data.list && data.list.length > 0) {
    setPersistentCache(cachedKey, data)
    return data
  }
  // 兜底：从静态数据中查找
  try {
    const staticData = await fetchFromStaticJson({ ac: 'detail' })
    if (staticData.list) {
      const found = staticData.list.filter(item => String(item.vod_id) === String(id))
      if (found.length > 0) {
        const result = { list: found, total: 1, class: staticData.class || DEFAULT_CATEGORIES }
        setPersistentCache(cachedKey, result)
        return result
      }
    }
  } catch { /* ignore */ }
  return { list: [] }
}

// 分类
export const getCategories = async () => {
  try {
    const data = await fetchFromCurrentSource({ ac: 'list' })
    let categories = data.class || []
    if (!Array.isArray(categories)) categories = []
    categories = categories.filter(item => item && (item.type_pid === 0 || item.type_pid === '0' || item.type_pid == null))
    if (categories.length === 0) {
      // 从视频数据中推断分类
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
      const existingNames = new Set(categories.map(c => c.type_name))
      DEFAULT_CATEGORIES.forEach(def => {
        if (!existingNames.has(def.type_name)) categories.push(def)
      })
      return categories
    }
  } catch { /* ignore */ }
  return [...DEFAULT_CATEGORIES]
}

export const getCategoryVideos = async (typeId, page = 1) => {
  return await fetchFromCurrentSource({ ac: 'detail', t: typeId, pg: page })
}

// 清除所有缓存
export const clearApiCache = () => {
  cache.clear()
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('api_cache_')) keys.push(key)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
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
