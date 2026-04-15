// API 工具函数 - 多视频源整合管理

// CORS 代理列表 - 多个备用代理
const corsProxies = [
  'https://api.codetabs.com/v1/proxy?quest='
];

// 当前代理索引
let currentProxyIndex = 0;

// 获取当前代理
const getCurrentProxy = () => corsProxies[currentProxyIndex];

// 切换到下一个代理
const switchToNextProxy = () => {
  currentProxyIndex = (currentProxyIndex + 1) % corsProxies.length;
  console.log(`[API] 切换到代理: ${corsProxies[currentProxyIndex]}`);
};

// 视频源列表 - 所有可用源
export const videoSources = [
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/', isAvailable: true, priority: 1 },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/', isAvailable: true, priority: 2 },
  { name: '非凡影视', url: 'http://ffzy5.tv/api.php/provide/vod/', isAvailable: true, priority: 3 },
  { name: '卧龙资源', url: 'https://wolongzyw.com/api.php/provide/vod/', isAvailable: true, priority: 4 },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/', isAvailable: true, priority: 5 },
  { name: '无尽资源', url: 'https://api.wujinapi.me/api.php/provide/vod/', isAvailable: true, priority: 6 },
  { name: '天空资源', url: 'https://api.tiankongzy.com/api.php/provide/vod/', isAvailable: true, priority: 7 },
  { name: '星辰资源', url: 'https://api.xingchenzy.com/api.php/provide/vod/', isAvailable: true, priority: 8 },
  { name: '银河资源', url: 'https://api.yinhezy.com/api.php/provide/vod/', isAvailable: true, priority: 9 },
  { name: '宇宙资源', url: 'https://api.yuzhouzy.com/api.php/provide/vod/', isAvailable: true, priority: 10 }
];

// 当前选中的视频源索引
let currentSourceIndex = 0;

// 获取当前视频源
export const getCurrentSource = () => videoSources[currentSourceIndex];

// 设置当前视频源
export const setCurrentSource = (index) => {
  if (index >= 0 && index < videoSources.length) {
    currentSourceIndex = index;
    // 保存到localStorage
    localStorage.setItem('currentVideoSource', index.toString());
    return true;
  }
  return false;
};

// 初始化视频源设置
export const initSourceSetting = () => {
  const saved = localStorage.getItem('currentVideoSource');
  if (saved !== null) {
    currentSourceIndex = parseInt(saved);
  }
};

// 从指定源获取数据 - 带代理切换重试
const fetchFromSource = async (source, params, timeout = 10000, retryCount = 0) => {
  const queryString = new URLSearchParams(params).toString();
  const targetUrl = `${source.url}?${queryString}`;
  const proxyUrl = `${getCurrentProxy()}${encodeURIComponent(targetUrl)}`;
  
  console.log(`[API] 请求 ${source.name}:`, targetUrl);
  
  try {
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(timeout)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();

    // 验证数据格式 - 更详细的日志
    if (!data) {
      console.error(`[API] ${source.name} 返回空数据`);
      throw new Error('Invalid data format: empty response');
    }
    
    // 处理 list 为对象的情况（某些API返回对象而非数组）
    if (data.list && typeof data.list === 'object' && !Array.isArray(data.list)) {
      // 将对象转换为数组
      data.list = Object.values(data.list);
    }
    
    if (!Array.isArray(data.list)) {
      console.error(`[API] ${source.name} 数据格式错误:`, data);
      throw new Error(`Invalid data format: list is not an array, got ${typeof data.list}`);
    }
    
    // 为数据添加来源标记，并处理卧龙资源的封面问题
    data.list = data.list.map(item => {
      // 处理卧龙资源的封面问题
      if (source.name === '卧龙资源' && (!item.vod_pic || item.vod_pic === '')) {
        // 使用默认封面或其他替代方案
        item.vod_pic = `https://picsum.photos/300/450?random=${item.vod_id || Math.random()}`;
      }
      return {
        ...item,
        _source: source.name,
        _sourceIndex: videoSources.indexOf(source)
      };
    });
    
    return data;
  } catch (error) {
    // 如果失败且还有备用代理，尝试切换代理重试
    if (retryCount < corsProxies.length - 1) {
      console.log(`[API] 代理请求失败，尝试切换代理...`);
      switchToNextProxy();
      return fetchFromSource(source, params, timeout, retryCount + 1);
    }
    throw error;
  }
};

// 从所有可用源获取数据并整合
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 缓存1小时

export const fetchFromAllSources = async (params, maxResults = 50, maxPages = 3) => {
  // 生成缓存键
  const cacheKey = JSON.stringify({ ...params, maxPages });
  
  // 检查缓存
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[API] 使用缓存数据: ${cacheKey}`);
    return cached.data;
  }
  
  const results = [];
  const errors = [];
  
  // 并行请求所有源的多页数据
  const promises = videoSources.map(async (source) => {
    const sourceResults = [];
    
    // 获取多页数据
    for (let page = 1; page <= maxPages; page++) {
      try {
        const pageParams = { ...params, pg: page };
        const data = await fetchFromSource(source, pageParams, 8000);
        if (data.list && data.list.length > 0) {
          sourceResults.push(...data.list);
          // 如果返回的数据少于预期，说明没有更多数据了
          if (data.list.length < 20) break;
        } else {
          break;
        }
      } catch (error) {
        // 如果某一页失败，继续尝试下一页
        console.warn(`[API] ${source.name} 第${page}页获取失败:`, error.message);
        break;
      }
    }
    
    return { source: source.name, data: { list: sourceResults }, success: sourceResults.length > 0 };
  });
  
  const responses = await Promise.allSettled(promises);
  
  responses.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      const { data, source } = result.value;
      if (data.list && data.list.length > 0) {
        results.push(...data.list);
      }
    } else {
      errors.push({
        source: videoSources[index].name,
        error: result.status === 'fulfilled' ? result.value.error : result.reason?.message
      });
    }
  });
  
  // 去重 - 根据视频名称和年份
  const uniqueResults = [];
  const seen = new Set();
  
  results.forEach(item => {
    const key = `${item.vod_name}_${item.vod_year}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(item);
    }
  });
  
  // 按点击量排序
  uniqueResults.sort((a, b) => (b.vod_hits || 0) - (a.vod_hits || 0));
  
  const responseData = {
    list: maxResults > 0 ? uniqueResults.slice(0, maxResults) : uniqueResults,
    total: uniqueResults.length,
    errors: errors.length > 0 ? errors : undefined
  };
  
  // 缓存结果
  cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
  
  console.log(`[API] 整合完成: ${uniqueResults.length} 个视频, 错误:`, errors);
  
  return responseData;
};

// 从当前选中的源获取数据
export const fetchFromCurrentSource = async (params) => {
  const source = getCurrentSource();
  return await fetchFromSource(source, params);
};

// 统一的API调用函数
export const apiCall = async (params, options = {}) => {
  const { useAllSources = false, maxResults = 50 } = options;
  
  // 初始化源设置
  initSourceSetting();
  
  try {
    if (useAllSources) {
      // 整合所有源的数据
      return await fetchFromAllSources(params, maxResults);
    } else {
      // 只从当前选中的源获取
      return await fetchFromCurrentSource(params);
    }
  } catch (error) {
    console.error('[API] 调用失败:', error);
    // 返回空数据而不是模拟数据
    return { list: [], total: 0, error: error.message };
  }
};

// 搜索视频
export const searchVideos = async (keyword, options = {}) => {
  return await apiCall({ ac: 'detail', wd: keyword }, options);
};

// 获取视频详情
export const getVideoDetail = async (id, sourceIndex = null) => {
  // 如果指定了源，使用该源
  if (sourceIndex !== null && videoSources[sourceIndex]) {
    try {
      const data = await fetchFromSource(videoSources[sourceIndex], { ac: 'detail', ids: id });
      if (data.list && data.list.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn(`[API] 源 ${sourceIndex} 获取失败，尝试其他源`);
    }
  }
  
  // 尝试所有源
  for (let i = 0; i < videoSources.length; i++) {
    try {
      const data = await fetchFromSource(videoSources[i], { ac: 'detail', ids: id });
      if (data.list && data.list.length > 0) {
        return data;
      }
    } catch (e) {
      continue;
    }
  }
  
  return { list: [] };
};

// 获取分类列表
export const getCategories = async () => {
  try {
    const data = await fetchFromCurrentSource({ ac: 'list' });
    return data.class || [];
  } catch (error) {
    console.error('[API] 获取分类失败:', error);
    return [];
  }
};

// 获取分类视频
export const getCategoryVideos = async (typeId, page = 1, options = {}) => {
  return await apiCall({ 
    ac: 'detail', 
    t: typeId,
    pg: page 
  }, options);
};

// 获取统计数据（基于真实数据）
export const getStats = async () => {
  try {
    // 从所有源获取数据计算统计
    const allData = await fetchFromAllSources({ ac: 'detail' }, 100);
    
    const videos = allData.list || [];
    const totalViews = videos.reduce((sum, v) => sum + (parseInt(v.vod_hits) || 0), 0);
    
    // 按类型统计
    const typeStats = {};
    videos.forEach(v => {
      const type = v.vod_type_name || v.type_name || '其他';
      if (!typeStats[type]) {
        typeStats[type] = { count: 0, views: 0 };
      }
      typeStats[type].count++;
      typeStats[type].views += parseInt(v.vod_hits) || 0;
    });
    
    return {
      totalVideos: videos.length,
      totalViews: totalViews,
      typeStats: typeStats,
      sourceStats: videoSources.map(s => ({
        name: s.name,
        isAvailable: s.isAvailable
      }))
    };
  } catch (error) {
    console.error('[API] 获取统计失败:', error);
    return { totalVideos: 0, totalViews: 0, typeStats: {}, sourceStats: [] };
  }
};

export default apiCall;
