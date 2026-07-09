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

// 工具函数: 环境检测
const isGitHubPages = () => {
  try {
    return typeof window !== 'undefined' && window.location.hostname.indexOf('github.io') !== -1
  } catch { /* ignore */ }
  return false
}

const isHuggingFaceSpace = () => {
  try {
    return typeof window !== 'undefined' &&
      (window.location.hostname.indexOf('hf.space') !== -1 ||
       window.location.hostname.indexOf('huggingface.co') !== -1)
  } catch { /* ignore */ }
  return false
}

// 安全 JSON 解析
const safeJsonParse = (text) => {
  try { return JSON.parse(text) } catch { return null }
}

// ─── 数据去重工具（解决多源数据完全一致/高度重复问题） ───

// 归一化字符串：去除空格、特殊符号、大小写，用于去重比较
const normalizeText = (text) => {
  if (!text) return ''
  return String(text)
    .replace(/[\s\-_·•·—–(),，。.!！?？【】\[\]《》<>\"''`~@#$%^&*+=\\|\/]/g, '')
    .toLowerCase()
    .trim()
}

// 生成去重键：优先用 (标题归一化 + 年份)，vod_id 只作为辅助
const getDedupKey = (item) => {
  if (!item) return ''
  const nameNorm = normalizeText(item.vod_name || item.name || '')
  const year = String(item.vod_year || item.year || '0').replace(/\D/g, '')
  // 额外辅助字段：导演归一化（进一步降低误判）
  const directorNorm = normalizeText(item.vod_director || item.director || '').slice(0, 6)
  // 组合键：标题归一化 + 年份 + 导演前缀
  if (nameNorm) {
    return `n_${nameNorm}_${year}_${directorNorm}`
  }
  // 退回到 vod_id（每个源自己的 id，前面加源名避免冲突）
  const src = item._source || 's'
  return `id_${src}_${item.vod_id || item.id || Math.random()}`
}

// 合并重复条目：保留 vod_hits 更大的那个，并聚合所有播放源
const mergeVideoItem = (existingItem, newItem) => {
  // 选择 vod_hits 更大的作为基础
  const base = (parseInt(existingItem.vod_hits) || 0) >= (parseInt(newItem.vod_hits) || 0)
    ? existingItem : newItem
  const other = base === existingItem ? newItem : existingItem
  const merged = { ...base }

  // 合并播放源信息 (vod_play_from + vod_play_url)
  const playFromBase = String(base.vod_play_from || '').split('$$$').filter(Boolean)
  const playFromOther = String(other.vod_play_from || '').split('$$$').filter(Boolean)
  const playUrlBase = String(base.vod_play_url || '').split('$$$').filter(Boolean)
  const playUrlOther = String(other.vod_play_url || '').split('$$$').filter(Boolean)

  // 用 Map 去重，键：源名
  const playMap = new Map()
  playFromBase.forEach((name, i) => {
    if (name && playUrlBase[i]) playMap.set(name, playUrlBase[i])
  })
  playFromOther.forEach((name, i) => {
    if (name && playUrlOther[i] && !playMap.has(name)) {
      playMap.set(name, playUrlOther[i])
    }
  })
  const fromArr = Array.from(playMap.keys())
  const urlArr = Array.from(playMap.values())
  if (fromArr.length > 0) {
    merged.vod_play_from = fromArr.join('$$$')
    merged.vod_play_url = urlArr.join('$$$')
  }

  // 记录所有提供过数据的源
  const sources = new Set([
    ...String(base._source || '').split(',').filter(Boolean),
    ...String(other._source || '').split(',').filter(Boolean)
  ])
  merged._source = Array.from(sources).join(',')
  merged._sourceCount = sources.size

  return merged
}

// 列表去重 + 合并函数
const deduplicateList = (list) => {
  const map = new Map()
  for (const item of list) {
    if (!item || !item.vod_name) continue
    const key = getDedupKey(item)
    if (map.has(key)) {
      map.set(key, mergeVideoItem(map.get(key), item))
    } else {
      map.set(key, { ...item })
    }
  }
  return Array.from(map.values())
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

// 多源合并（拉取多源×多页数据，智能去重）
export const fetchFromAllSources = async (params, maxResults = 0, maxPages = 2, maxSources = 5) => {
  const cacheKey = getCacheKey(params, `${maxPages}_${maxSources}`)
  const memCached = getCache(cacheKey)
  if (memCached) return memCached
  const persistCached = getPersistentCache(cacheKey)
  if (persistCached) return persistCached

  initSourceSetting()
  let allClass = []

  // ─── 策略 1: Pages Function 代理 - 多源×多页真实数据
  try {
    const rawList = []
    // 从当前源开始轮询，尝试多个源
    for (let srcOffset = 0; srcOffset < maxSources && srcOffset < videoSources.length; srcOffset++) {
      const srcIdx = (currentSourceIndex + srcOffset) % videoSources.length
      for (let page = 1; page <= maxPages; page++) {
        try {
          const pageParams = { ...params, pg: page, source: srcIdx }
          const pageData = await fetchFromPagesProxy(pageParams)
          if (pageData && pageData.list && pageData.list.length > 0) {
            // 只拿一次分类（从第一个有效源）
            if (pageData.class && pageData.class.length > 0 && allClass.length === 0) {
              allClass = pageData.class
            }
            rawList.push(...pageData.list)
            if (pageData.list.length < 20) break
          } else {
            break
          }
        } catch { break }
      }
    }
    // 去重合并
    if (rawList.length > 0) {
      const deduped = deduplicateList(rawList)
      deduped.sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))
      const finalList = maxResults > 0 ? deduped.slice(0, maxResults) : deduped
      const result = { list: finalList, total: finalList.length, class: allClass.length > 0 ? allClass : DEFAULT_CATEGORIES }
      setCache(cacheKey, result)
      setPersistentCache(cacheKey, result)
      return result
    }
  } catch { /* 降级 */ }

  // ─── 策略 2: 静态 JSON
  try {
    const result = await fetchFromStaticJson(params)
    if (result && result.list && result.list.length > 0) {
      const deduped = deduplicateList(result.list)
      deduped.sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))
      if (maxResults > 0) result.list = deduped.slice(0, maxResults)
      else result.list = deduped
      result.total = result.list.length
      setCache(cacheKey, result)
      setPersistentCache(cacheKey, result)
      return result
    }
  } catch { /* 降级 */ }

  // ─── 策略 3: CORS 代理
  try {
    const rawList = []
    for (let srcOffset = 0; srcOffset < Math.min(3, videoSources.length); srcOffset++) {
      const srcIdx = (currentSourceIndex + srcOffset) % videoSources.length
      for (let page = 1; page <= maxPages; page++) {
        try {
          const pageData = await fetchFromCorsProxies({ ...params, pg: page }, srcIdx)
          if (pageData && pageData.list && pageData.list.length > 0) {
            if (pageData.class && pageData.class.length > 0 && allClass.length === 0) {
              allClass = pageData.class
            }
            rawList.push(...pageData.list)
            if (pageData.list.length < 20) break
          } else break
        } catch { break }
      }
    }
    if (rawList.length > 0) {
      const deduped = deduplicateList(rawList)
      deduped.sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))
      const finalList = maxResults > 0 ? deduped.slice(0, maxResults) : deduped
      const result = { list: finalList, total: finalList.length, class: allClass.length > 0 ? allClass : DEFAULT_CATEGORIES }
      setCache(cacheKey, result)
      setPersistentCache(cacheKey, result)
      return result
    }
  } catch { /* 降级 */ }

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

  // 策略 1: 静态 JSON 搜索
  try {
    const staticData = await fetchFromStaticJson({ wd: keyword })
    if (staticData && staticData.list && staticData.list.length > 0) {
      const deduped = deduplicateList(staticData.list)
      const filtered = deduped.filter(matchFields)
      if (filtered.length > 0) {
        return { list: filtered, total: filtered.length, class: staticData.class || DEFAULT_CATEGORIES }
      }
    }
  } catch { /* 继续 */ }

  // 策略 2: Pages 代理多源搜索
  try {
    const rawList = []
    for (let srcIdx = 0; srcIdx < Math.min(6, videoSources.length); srcIdx++) {
      for (let page = 1; page <= 2; page++) {
        try {
          const sourceData = await fetchFromPagesProxy({ ac: 'detail', pg: page, source: srcIdx })
          if (sourceData && sourceData.list && sourceData.list.length > 0) {
            rawList.push(...sourceData.list)
            if (sourceData.list.length < 20) break
          } else break
        } catch { break }
      }
    }
    if (rawList.length > 0) {
      const deduped = deduplicateList(rawList)
      const filtered = deduped.filter(matchFields)
      if (filtered.length > 0) {
        return { list: filtered, total: filtered.length, class: DEFAULT_CATEGORIES }
      }
    }
  } catch { /* 继续 */ }

  // 策略 3: CORS 代理搜索
  try {
    const rawList = []
    for (let srcIdx = 0; srcIdx < Math.min(3, videoSources.length); srcIdx++) {
      for (let page = 1; page <= 2; page++) {
        try {
          const sourceData = await fetchFromCorsProxies({ ac: 'detail', pg: page }, srcIdx)
          if (sourceData && sourceData.list && sourceData.list.length > 0) {
            rawList.push(...sourceData.list)
          } else break
        } catch { break }
      }
    }
    if (rawList.length > 0) {
      const deduped = deduplicateList(rawList)
      const filtered = deduped.filter(matchFields)
      if (filtered.length > 0) {
        return { list: filtered, total: filtered.length, class: DEFAULT_CATEGORIES }
      }
    }
  } catch { /* 忽略 */ }

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
