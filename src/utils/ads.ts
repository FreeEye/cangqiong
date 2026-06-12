/**
 * 广告盈利系统 - Ad Monetization System
 *
 * 支持的广告模式:
 * 1. Google AdSense (自动/展示广告)
 * 2. 视频前贴片广告 (Pre-roll VAST)
 * 3. 信息流原生广告 (In-feed Native)
 * 4. 侧边栏横幅广告 (Banner)
 * 5. 暂停广告 (Pause Ad)
 *
 * 盈利来源: Google AdSense 按展示/点击付费
 * 预计 RPM: $2-8 (每千次展示)
 */

// ── 广告配置 ──
export interface AdSlot {
  id: string
  type: 'banner' | 'native' | 'preroll' | 'sidebar'
  name: string
  enabled: boolean
  // AdSense 广告位 ID (部署时替换为真实ID)
  adClient: string
  adSlot: string
  width: number
  height: number
  format: 'auto' | 'rectangle' | 'horizontal' | 'vertical' | 'responsive'
}

// 广告位配置 - 部署时填入真实 AdSense 发布商 ID
const AD_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX' // 替换为真实发布商 ID

export const adSlots: AdSlot[] = [
  {
    id: 'home-banner-top',
    type: 'banner',
    name: '首页顶部横幅',
    enabled: true,
    adClient: AD_CLIENT,
    adSlot: 'home_top_banner',
    width: 728,
    height: 90,
    format: 'horizontal'
  },
  {
    id: 'home-feed-1',
    type: 'native',
    name: '首页信息流 #1',
    enabled: true,
    adClient: AD_CLIENT,
    adSlot: 'home_feed_1',
    width: 336,
    height: 280,
    format: 'rectangle'
  },
  {
    id: 'home-feed-2',
    type: 'native',
    name: '首页信息流 #2',
    enabled: true,
    adClient: AD_CLIENT,
    adSlot: 'home_feed_2',
    width: 336,
    height: 280,
    format: 'rectangle'
  },
  {
    id: 'player-preroll',
    type: 'preroll',
    name: '播放器前贴片',
    enabled: true,
    adClient: AD_CLIENT,
    adSlot: 'player_preroll',
    width: 640,
    height: 360,
    format: 'responsive'
  },
  {
    id: 'sidebar-ad',
    type: 'sidebar',
    name: '侧边栏广告',
    enabled: true,
    adClient: AD_CLIENT,
    adSlot: 'sidebar_ad',
    width: 300,
    height: 600,
    format: 'vertical'
  },
  {
    id: 'category-banner',
    type: 'banner',
    name: '分类页横幅',
    enabled: true,
    adClient: AD_CLIENT,
    adSlot: 'category_banner',
    width: 728,
    height: 90,
    format: 'horizontal'
  },
  {
    id: 'player-pause',
    type: 'banner',
    name: '播放暂停广告',
    enabled: false,
    adClient: AD_CLIENT,
    adSlot: 'player_pause',
    width: 300,
    height: 250,
    format: 'rectangle'
  }
]

// ── 广告状态管理 ──
const STORAGE_KEY = 'adSettings'

export interface AdSettings {
  enabled: boolean
  prerollEnabled: boolean
  prerollSkipTime: number  // 几秒后可跳过
  feedInterval: number      // 每N个视频插入一个广告
  disabledSlots: string[]   // 被禁用的广告位 ID
}

const defaultSettings: AdSettings = {
  enabled: true,
  prerollEnabled: true,
  prerollSkipTime: 5,
  feedInterval: 8,
  disabledSlots: []
}

export const getAdSettings = (): AdSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) }
  } catch (e) { /* ignore */ }
  return { ...defaultSettings }
}

export const saveAdSettings = (settings: Partial<AdSettings>) => {
  const current = getAdSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export const isAdSlotEnabled = (slotId: string): boolean => {
  const settings = getAdSettings()
  if (!settings.enabled) return false
  if (settings.disabledSlots.includes(slotId)) return false
  const slot = adSlots.find(s => s.id === slotId)
  return slot ? slot.enabled : false
}

// ── 收益追踪 ──
const REVENUE_KEY = 'adRevenue'

export interface RevenueRecord {
  date: string
  impressions: number
  clicks: number
  ctr: number
  rpm: number
  estimatedRevenue: number
  slotBreakdown: Record<string, { impressions: number; clicks: number }>
}

export const getRevenueData = (): RevenueRecord[] => {
  try {
    const stored = localStorage.getItem(REVENUE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

export const getTodayRevenue = (): RevenueRecord => {
  const records = getRevenueData()
  const today = new Date().toISOString().split('T')[0]
  const existing = records.find(r => r.date === today)
  if (existing) return existing

  // 基于真实流量估算
  const history = JSON.parse(localStorage.getItem('watchHistory') || '[]')
  const todayViews = history.filter((h: any) => {
    return new Date(h.time).toDateString() === new Date().toDateString()
  }).length

  // 使用行业平均 RPM $3-5, CTR 0.5-2%
  const estimatedRPM = 3 + Math.random() * 2
  const impressions = Math.max(todayViews * 3, 10) // 每页约3个广告位
  const estimatedCTR = 0.005 + Math.random() * 0.015
  const clicks = Math.floor(impressions * estimatedCTR)

  return {
    date: today,
    impressions,
    clicks,
    ctr: clicks / impressions,
    rpm: estimatedRPM,
    estimatedRevenue: (impressions / 1000) * estimatedRPM,
    slotBreakdown: {
      'home-banner-top': { impressions: Math.floor(impressions * 0.3), clicks: 0 },
      'home-feed-1': { impressions: Math.floor(impressions * 0.25), clicks: 0 },
      'home-feed-2': { impressions: Math.floor(impressions * 0.2), clicks: 0 },
      'player-preroll': { impressions: Math.floor(impressions * 0.15), clicks: 0 },
      'sidebar-ad': { impressions: Math.floor(impressions * 0.1), clicks: 0 }
    }
  }
}

export const recordImpression = (slotId: string) => {
  const today = getTodayRevenue()
  if (!today.slotBreakdown[slotId]) {
    today.slotBreakdown[slotId] = { impressions: 0, clicks: 0 }
  }
  today.slotBreakdown[slotId].impressions++
  today.impressions++
  today.estimatedRevenue = (today.impressions / 1000) * today.rpm

  const records = getRevenueData()
  const idx = records.findIndex(r => r.date === today.date)
  if (idx >= 0) {
    records[idx] = today
  } else {
    records.push(today)
  }
  if (records.length > 90) records.shift() // 保留90天
  localStorage.setItem(REVENUE_KEY, JSON.stringify(records))
}

export const recordClick = (slotId: string) => {
  const today = getTodayRevenue()
  if (!today.slotBreakdown[slotId]) {
    today.slotBreakdown[slotId] = { impressions: 0, clicks: 0 }
  }
  today.slotBreakdown[slotId].clicks++
  today.clicks++
  today.ctr = today.clicks / Math.max(today.impressions, 1)

  const records = getRevenueData()
  const idx = records.findIndex(r => r.date === today.date)
  if (idx >= 0) records[idx] = today
  else records.push(today)
  localStorage.setItem(REVENUE_KEY, JSON.stringify(records))
}

// ── 月度预估 ──
export const getMonthlyEstimate = () => {
  const records = getRevenueData()
  const last30Days = records.slice(-30)
  const totalRevenue = last30Days.reduce((sum, r) => sum + r.estimatedRevenue, 0)
  const totalImpressions = last30Days.reduce((sum, r) => sum + r.impressions, 0)

  // 总视频量和播放量 (真实数据)
  const cachedVideos = localStorage.getItem('adminVideoList')
  const totalVideos = cachedVideos ? JSON.parse(cachedVideos).length : 0
  const totalViews = cachedVideos
    ? JSON.parse(cachedVideos).reduce((sum: number, v: any) => sum + (parseInt(v.vod_hits) || 0), 0)
    : 0

  return {
    monthlyRevenue: totalRevenue,
    monthlyImpressions: totalImpressions,
    avgRPM: totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0,
    projectedAnnual: totalRevenue * 12,
    totalVideos,
    totalViews,
    avgRevenuePerVideo: totalVideos > 0 ? (totalRevenue / totalVideos) : 0
  }
}

// ── AdSense 脚本注入 ──
let adsenseLoaded = false
export const loadAdSense = () => {
  if (adsenseLoaded) return
  const settings = getAdSettings()
  if (!settings.enabled) return

  // 仅在部署到真实域名时加载 AdSense
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[Ads] 本地开发环境，使用模拟广告')
    return
  }

  try {
    const script = document.createElement('script')
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`
    script.async = true
    script.crossOrigin = 'anonymous'
    document.head.appendChild(script)
    adsenseLoaded = true
    console.log('[Ads] AdSense 已加载')
  } catch (e) {
    console.warn('[Ads] AdSense 加载失败:', e)
  }
}

// ── VAST 前贴片广告 ──
// 部署时填入 VAST 广告标签 URL
const VAST_TAG_URL = 'https://pubads.g.doubleclick.net/gampad/ads?iu=/xxxx&description_url=__URL__&tfcd=0&npa=0&sz=640x360&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=__TIMESTAMP__'

export const getPrerollVastUrl = (): string => {
  const settings = getAdSettings()
  if (!settings.prerollEnabled) return ''
  return VAST_TAG_URL
    .replace('__URL__', encodeURIComponent(window.location.href))
    .replace('__TIMESTAMP__', Date.now().toString())
}

export const getPrerollSkipTime = (): number => {
  return getAdSettings().prerollSkipTime
}
