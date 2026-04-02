// API 工具函数 - 用于处理静态网站环境下的API调用

// 视频源列表 - 按速度排序
const videoSources = [
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/', isAvailable: true },
  { name: '非凡影视', url: 'http://ffzy5.tv/api.php/provide/vod/', isAvailable: true },
  { name: '卧龙资源', url: 'https://wolongzyw.com/api.php/provide/vod/', isAvailable: true },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/', isAvailable: true },
  { name: '无尽资源', url: 'https://api.wujinapi.me/api.php/provide/vod/', isAvailable: true },
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/', isAvailable: true }
];

// 直接调用外部API，绕过代理
const directApiCall = async (params) => {
  // 依次尝试各个视频源
  for (const source of videoSources) {
    if (!source.isAvailable) continue;
    
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `${source.url}?${queryString}`;
      
      console.log(`尝试使用 ${source.name}:`, url);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`${source.name} 调用成功`);
      return data;
    } catch (error) {
      console.warn(`${source.name} 调用失败:`, error);
      source.isAvailable = false;
      continue;
    }
  }
  
  // 如果所有视频源都失败了，返回模拟数据
  console.warn('所有视频源调用失败，使用模拟数据');
  return getMockData(params);
};

// 模拟数据 - 当API调用失败时使用
const getMockData = (params) => {
  const { ac, ids, wd, t, pg } = params;
  
  if (ac === 'detail' && ids) {
    // 单个视频详情
    return {
      list: [{
        vod_id: ids,
        vod_name: '苍穹影视 - 测试视频',
        vod_pic: 'https://picsum.photos/300/450?random=1',
        vod_content: '这是一个测试视频的描述信息，用于演示网站功能。',
        vod_year: '2024',
        vod_area: '中国大陆',
        vod_actor: '测试演员',
        vod_hits: Math.floor(Math.random() * 1000) + 500,
        vod_play_from: '测试源',
        vod_play_url: '第1集$https://example.com/video1.m3u8'
      }]
    };
  } else if (ac === 'detail' && wd) {
    // 搜索功能
    return {
      list: Array.from({ length: 6 }, (_, i) => ({
        vod_id: `search-${i + 1}`,
        vod_name: `搜索结果 ${i + 1} - ${wd}`,
        vod_pic: `https://picsum.photos/300/450?random=${i + 10}`,
        vod_year: '2024',
        vod_area: '中国大陆'
      }))
    };
  } else if (ac === 'detail') {
    // 视频列表
    return {
      list: Array.from({ length: 12 }, (_, i) => ({
        vod_id: `video-${i + 1}`,
        vod_name: `热门视频 ${i + 1}`,
        vod_pic: `https://picsum.photos/300/450?random=${i + 20}`,
        vod_year: '2024',
        vod_area: '中国大陆',
        vod_hits: Math.floor(Math.random() * 1000) + 500
      }))
    };
  } else if (ac === 'list') {
    // 分类列表
    return {
      class: [
        { type_id: 1, type_name: '电影' },
        { type_id: 2, type_name: '电视剧' },
        { type_id: 3, type_name: '动漫' },
        { type_id: 4, type_name: '综艺' }
      ]
    };
  }
  
  return { list: [] };
};

// 统一的API调用函数
export const apiCall = async (params) => {
  // 如果是开发环境，使用代理
  if (import.meta.env.DEV) {
    const res = await fetch(`/api/proxy?${new URLSearchParams(params).toString()}`);
    return await res.json();
  }
  
  // 生产环境使用直接调用
  return await directApiCall(params);
};

export default apiCall;