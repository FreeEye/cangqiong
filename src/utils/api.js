// API 工具函数 - 多视频源整合管理 (高性能优化版)

// ─── CORS 代理 ───
const corsProxies = [
  'https://api.codetabs.com/v1/proxy?quest='
];
let currentProxyIndex = 0;
const getCurrentProxy = () => corsProxies[currentProxyIndex];
const switchToNextProxy = () => {
  currentProxyIndex = (currentProxyIndex + 1) % corsProxies.length;
};

// ─── 视频源列表 ───
export const videoSources = [
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/', isAvailable: true, priority: 1 },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/', isAvailable: true, priority: 2 },
  { name: '非凡影视', url: 'http://ffzy5.tv/api.php/provide/vod/', isAvailable: true, priority: 3 },
  { name: '卧龙资源', url: 'https://wolongzyw.com/api.php/provide/vod/', isAvailable: true, priority: 4 },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/', isAvailable: true, priority: 5 },
  { name: '无尽资源', url: 'https://api.wujinapi.me/api.php/provide/vod/', isAvailable: true, priority: 6 }
];

// ─── 源选择 ───
let currentSourceIndex = 0;
export const getCurrentSource = () => videoSources[currentSourceIndex];
export const setCurrentSource = (index) => {
  if (index >= 0 && index < videoSources.length) {
    currentSourceIndex = index;
    localStorage.setItem('currentVideoSource', index.toString());
    return true;
  }
  return false;
};
export const initSourceSetting = () => {
  const saved = localStorage.getItem('currentVideoSource');
  if (saved !== null) currentSourceIndex = parseInt(saved);
};

// ─── 缓存系统 (LRU + TTL) ───
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30分钟
const MAX_CACHE_SIZE = 20;

const getCacheKey = (params, maxPages) => JSON.stringify({ ...params, maxPages });

const setCache = (key, data) => {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
};

const getCache = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) cache.delete(key);
  return null;
};

const getPersistentCache = (key) => {
  try {
    const item = localStorage.getItem(`api_cache_${key}`);
    if (!item) return null;
    const { data, timestamp } = JSON.parse(item);
    if (Date.now() - timestamp < CACHE_TTL) return data;
    localStorage.removeItem(`api_cache_${key}`);
  } catch { /* ignore */ }
  return null;
};

const setPersistentCache = (key, data) => {
  try {
    localStorage.setItem(`api_cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* quota exceeded, ignore */ }
};

// ─── 源请求 (优化版) ───
const fetchFromSource = async (source, params, timeout = 6000, retryCount = 0) => {
  const queryString = new URLSearchParams(params).toString();
  const targetUrl = `${source.url}?${queryString}`;
  const proxyUrl = `${getCurrentProxy()}${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(timeout)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data) throw new Error('Empty response');

    // 处理 list 为对象而非数组
    if (data.list && typeof data.list === 'object' && !Array.isArray(data.list)) {
      data.list = Object.values(data.list);
    }
    if (!Array.isArray(data.list)) {
      throw new Error(`Invalid data format: list is ${typeof data.list}`);
    }

    // 添加来源标记
    data.list = data.list.map(item => {
      if (source.name === '卧龙资源' && (!item.vod_pic || item.vod_pic === '')) {
        item.vod_pic = `https://picsum.photos/300/450?random=${item.vod_id || Math.random()}`;
      }
      return { ...item, _source: source.name, _sourceIndex: videoSources.indexOf(source) };
    });

    return data;
  } catch (error) {
    if (retryCount < corsProxies.length - 1) {
      switchToNextProxy();
      return fetchFromSource(source, params, timeout, retryCount + 1);
    }
    throw error;
  }
};

// ─── 渐进式加载: 快速返回缓存, 后台刷新 ───
let bgRefreshTimer = null;

export const fetchFromAllSources = async (params, maxResults = 0, maxPages = 1) => {
  const cacheKey = getCacheKey(params, maxPages);

  // 1. 先查内存缓存
  const memCached = getCache(cacheKey);
  if (memCached) return memCached;

  // 2. 再查 localStorage 持久缓存
  const persistCached = getPersistentCache(cacheKey);
  if (persistCached) {
    // 后台静默刷新
    if (!bgRefreshTimer) {
      bgRefreshTimer = setTimeout(() => {
        fetchFreshData(params, maxResults, maxPages, cacheKey);
        bgRefreshTimer = null;
      }, 100);
    }
    return persistCached;
  }

  // 3. 无缓存, 直接拉取
  return await fetchFreshData(params, maxResults, maxPages, cacheKey);
};

const fetchFreshData = async (params, maxResults, maxPages, cacheKey) => {
  const results = [];
  const errors = [];
  const sourceData = {};
  const startTime = performance.now();

  // 并行请求所有可用源 (仅请求首页数据以加速)
  const promises = videoSources
    .filter(s => localStorage.getItem(`source_${s.name}_enabled`) !== 'false')
    .map(async (source) => {
      const sourceResults = [];
      for (let page = 1; page <= maxPages; page++) {
        try {
          const data = await fetchFromSource(source, { ...params, pg: page }, 6000);
          if (data.list && data.list.length > 0) {
            sourceResults.push(...data.list);
            if (data.list.length < 20) break;
          } else break;
        } catch (error) {
          break;
        }
      }
      return { source: source.name, data: { list: sourceResults }, success: sourceResults.length > 0 };
    });

  const responses = await Promise.allSettled(promises);

  responses.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      const { data, source } = result.value;
      if (data.list?.length > 0) {
        results.push(...data.list);
        sourceData[source] = data.list.length;
      }
    } else {
      const sourceName = videoSources.filter(s => localStorage.getItem(`source_${s.name}_enabled`) !== 'false')[index]?.name || 'unknown';
      errors.push({ source: sourceName, error: result.status === 'fulfilled' ? 'no data' : result.reason?.message });
    }
  });

  // 去重: vod_name + vod_year
  const seen = new Set();
  const uniqueResults = [];
  results.forEach(item => {
    const key = `${item.vod_name}_${item.vod_year}`;
    if (!seen.has(key)) { seen.add(key); uniqueResults.push(item); }
  });

  // 按播放量排序
  uniqueResults.sort((a, b) => (b.vod_hits || 0) - (a.vod_hits || 0));

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  const responseData = {
    list: maxResults > 0 ? uniqueResults.slice(0, maxResults) : uniqueResults,
    total: uniqueResults.length,
    errors: errors.length > 0 ? errors : undefined,
    sourceData,
    elapsed: parseFloat(elapsed)
  };

  // 缓存结果
  setCache(cacheKey, responseData);
  setPersistentCache(cacheKey, responseData);

  console.log(`[API] ${uniqueResults.length}个视频, ${elapsed}s, 源:`, sourceData);
  return responseData;
};

// ─── 清除所有缓存 ───
export const clearApiCache = () => {
  cache.clear();
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('api_cache_')) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
};

// ─── 统一 API 调用 ───
export const fetchFromCurrentSource = async (params, retryCount = 2) => {
  const source = getCurrentSource();
  if (!source) throw new Error('No available video sources');
  
  // 重试当前源
  for (let i = 0; i < retryCount; i++) {
    try {
      const data = await fetchFromSource(source, params);
      return data;
    } catch (error) {
      console.error(`[API] ${source.name} 第 ${i+1} 次调用失败:`, error);
      // 如果是最后一次重试，尝试下一个可用源
      if (i === retryCount - 1) {
        // 尝试下一个可用源
        const nextSourceIndex = (currentSourceIndex + 1) % videoSources.length;
        if (nextSourceIndex !== currentSourceIndex) {
          currentSourceIndex = nextSourceIndex;
          console.log(`[API] 尝试切换到下一个源: ${videoSources[currentSourceIndex].name}`);
          return await fetchFromCurrentSource(params, retryCount);
        }
        throw error;
      }
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

export const apiCall = async (params, options = {}) => {
  const { useAllSources = false, maxResults = 50, retryCount = 3 } = options;
  initSourceSetting();
  
  // 重试机制
  for (let i = 0; i < retryCount; i++) {
    try {
      if (useAllSources) {
        return await fetchFromAllSources(params, maxResults);
      }
      return await fetchFromCurrentSource(params);
    } catch (error) {
      console.error(`[API] 第 ${i+1} 次调用失败:`, error);
      // 如果是最后一次重试，返回错误
      if (i === retryCount - 1) {
        // 尝试从所有源获取数据作为后备
        try {
          console.error('[API] 尝试从所有源获取数据作为后备');
          return await fetchFromAllSources(params, maxResults);
        } catch (fallbackError) {
          console.error('[API] 后备方案也失败:', fallbackError);
          return { list: [], total: 0, error: fallbackError.message };
        }
      }
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

// ─── 搜索 ───
export const searchVideos = async (keyword, options = {}) => {
  return await apiCall({ ac: 'detail', wd: keyword }, options);
};

// ─── 按源获取 ───
export const fetchFromSingleSource = async (sourceName) => {
  const source = videoSources.find(s => s.name === sourceName);
  if (!source) return { list: [], total: 0 };
  try {
    const data = await fetchFromSource(source, { ac: 'detail' });
    return { list: data.list || [], total: data.list?.length || 0, source: sourceName };
  } catch {
    return { list: [], total: 0, source: sourceName, error: true };
  }
};

// ─── 视频详情 ───
export const getVideoDetail = async (id, sourceIndex = null) => {
  const cachedKey = `video_detail_${id}`;
  const cached = getPersistentCache(cachedKey);
  if (cached) return cached;

  if (sourceIndex !== null && videoSources[sourceIndex]) {
    try {
      const data = await fetchFromSource(videoSources[sourceIndex], { ac: 'detail', ids: id });
      if (data.list?.length > 0) { setPersistentCache(cachedKey, data); return data; }
    } catch { /* try other sources */ }
  }

  for (let i = 0; i < videoSources.length; i++) {
    try {
      const data = await fetchFromSource(videoSources[i], { ac: 'detail', ids: id });
      if (data.list?.length > 0) { setPersistentCache(cachedKey, data); return data; }
    } catch { continue; }
  }
  return { list: [] };
};

// ─── 分类 ───
export const getCategories = async () => {
  try {
    const data = await fetchFromCurrentSource({ ac: 'list' });
    return data.class || [];
  } catch { return []; }
};

export const getCategoryVideos = async (typeId, page = 1, options = {}) => {
  return await apiCall({ ac: 'detail', t: typeId, pg: page }, options);
};

// ─── 统计 (真实数据) ───
export const getStats = async () => {
  try {
    const allData = await fetchFromAllSources({ ac: 'detail' }, 0);
    const videos = allData.list || [];
    const totalViews = videos.reduce((sum, v) => sum + (parseInt(v.vod_hits) || 0), 0);
    const typeStats = {};
    videos.forEach(v => {
      const type = v.vod_type_name || v.type_name || '其他';
      if (!typeStats[type]) typeStats[type] = { count: 0, views: 0 };
      typeStats[type].count++;
      typeStats[type].views += parseInt(v.vod_hits) || 0;
    });
    const sourceData = {};
    allData.sourceData && Object.entries(allData.sourceData).forEach(([k, v]) => { sourceData[k] = v; });
    return { totalVideos: videos.length, totalViews, typeStats, sourceData, sourceStats: videoSources.map(s => ({ name: s.name, isAvailable: s.isAvailable })) };
  } catch {
    return { totalVideos: 0, totalViews: 0, typeStats: {}, sourceData: {}, sourceStats: [] };
  }
};

export default apiCall;
