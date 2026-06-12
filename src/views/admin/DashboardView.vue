<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  LayoutDashboard, Film, Users, Eye, Clock, MessageSquare,
  LogOut, Search, Edit2, Trash2, BarChart3, Shield, ShieldOff,
  ChevronLeft, ChevronRight, Database, TrendingUp, Activity,
  RefreshCw, CheckCircle, XCircle, Download, X, Save, ExternalLink,
  HardDrive, RotateCw, AlertTriangle, Server, Zap, Sliders, Filter,
  DollarSign, TrendingDown, PieChart, CreditCard
} from 'lucide-vue-next'
import { fetchFromAllSources, videoSources } from '@/utils/api'
import { getAdSettings, saveAdSettings, getRevenueData, getTodayRevenue, getMonthlyEstimate, adSlots } from '@/utils/ads'

const router = useRouter()

// ── Router & Auth ──
const adminUser = ref({})
const checkAuth = () => {
  const token = localStorage.getItem('admin_token')
  if (!token) { router.push('/admin/login'); return false }
  const user = localStorage.getItem('admin_user')
  if (user) adminUser.value = JSON.parse(user)
  return true
}
const logout = () => {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')
  router.push('/admin/login')
}

// ── Navigation ──
const currentTab = ref('overview')
const navItems = [
  { key: 'overview', label: '数据概览', icon: BarChart3 },
  { key: 'videos', label: '视频管理', icon: Film },
  { key: 'sources', label: '视频源管理', icon: Server },
  { key: 'revenue', label: '收益概览', icon: DollarSign },
  { key: 'ads', label: '广告设置', icon: Sliders },
  { key: 'visits', label: '访问统计', icon: Activity },
  { key: 'comments', label: '评论管理', icon: MessageSquare },
  { key: 'blocked', label: '广告过滤', icon: ShieldOff },
]

// ── Clock ──
const currentTime = ref('')
let clockTimer = null
const updateClock = () => { currentTime.value = new Date().toLocaleString('zh-CN') }

// ── Toast ──
const toast = ref({ show: false, type: 'success', message: '' })
let toastTimer = null
const showToast = (type, message) => {
  toast.value = { show: true, type, message }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.show = false }, 2500)
}

// ── Loading & Error ──
const isLoading = ref(false)
const loadError = ref('')

// ── Data ──
const stats = ref({ totalVideos: 0, totalViews: 0, totalComments: 0, onlineUsers: 0, todayViews: 0, weekViews: 0 })
const allVideos = ref([])
const videoList = ref([])
const sourceStats = ref([])
const categoryStats = ref({})
const visitRecords = ref([])
const commentsData = ref([])
const blockedVideos = ref(new Set())

// ── Search & Filters ──
const searchQuery = ref('')
const filterType = ref('')
const filterSource = ref('')
const filterStatus = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const selectedIds = ref(new Set())
const selectAll = ref(false)

// ── Modals ──
const editingVideo = ref(null)
const showEditModal = ref(false)
const showDeleteConfirm = ref(false)
const deletingId = ref(null)
const deletingMode = ref('single')

// ── Sync Status ──
const syncStatus = ref({})

// ═══════════════════════════════════════════
//   Ad Filtering System
// ═══════════════════════════════════════════
const adBlockEnabled = ref(localStorage.getItem('adBlockEnabled') !== 'false')

const loadBlockedVideos = () => {
  const stored = localStorage.getItem('blockedVideos')
  if (stored) blockedVideos.value = new Set(JSON.parse(stored))
}

const toggleAdBlock = () => {
  adBlockEnabled.value = !adBlockEnabled.value
  localStorage.setItem('adBlockEnabled', adBlockEnabled.value.toString())
  showToast('success', adBlockEnabled.value ? '广告过滤已开启' : '广告过滤已关闭')
}

const blockVideo = (videoId) => {
  blockedVideos.value.add(String(videoId))
  saveBlockedVideos()
  showToast('success', '已将该视频加入过滤列表')
}

const unblockVideo = (videoId) => {
  blockedVideos.value.delete(String(videoId))
  saveBlockedVideos()
  showToast('success', '已将该视频从过滤列表移除')
}

const unblockAll = () => {
  blockedVideos.value.clear()
  saveBlockedVideos()
  showToast('success', '已清空过滤列表')
}

const saveBlockedVideos = () => {
  localStorage.setItem('blockedVideos', JSON.stringify([...blockedVideos.value]))
}

// ═══════════════════════════════════════════
//   Data Loading
// ═══════════════════════════════════════════
const loadCommentsData = () => {
  const allComments = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('comments_')) {
      const videoId = key.replace('comments_', '')
      const comments = JSON.parse(localStorage.getItem(key) || '[]')
      comments.forEach((c, idx) => {
        allComments.push({ id: `${videoId}_${idx}`, user: c.user, videoId, video: `视频 ${videoId}`, content: c.content, time: c.time, likes: c.likes || 0, status: 'approved' })
      })
    }
  }
  allComments.sort((a, b) => new Date(b.time) - new Date(a.time))
  commentsData.value = allComments.slice(0, 200)
}

const loadStatsFromStorage = () => {
  const history = JSON.parse(localStorage.getItem('watchHistory') || '[]')
  let allComments = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('comments_')) {
      allComments = allComments.concat(JSON.parse(localStorage.getItem(key) || '[]'))
    }
  }
  const today = new Date().toDateString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  return {
    history,
    commentsCount: allComments.length,
    todayViews: history.filter(h => new Date(h.time).toDateString() === today).length,
    weekViews: history.filter(h => new Date(h.time) > weekAgo).length
  }
}

const processVideoData = (videos) => {
  // Merge with local edits
  const localEdits = JSON.parse(localStorage.getItem('adminVideoEdits') || '{}')
  const localDeletes = new Set(JSON.parse(localStorage.getItem('adminVideoDeletes') || '[]'))

  const processed = videos
    .filter(v => !localDeletes.has(String(v.vod_id)))
    .map((v, index) => {
      const editData = localEdits[String(v.vod_id)] || {}
      return {
        id: v.vod_id || index,
        title: editData.title || v.vod_name || '',
        type: editData.type || v.vod_type_name || v.type_name || '未知',
        source: v._source || '未知',
        sourceIndex: v._sourceIndex,
        views: editData.views !== undefined ? editData.views : (parseInt(v.vod_hits) || 0),
        duration: v.vod_duration || '未知',
        status: editData.status || 'published',
        updateTime: v.vod_time ? new Date(v.vod_time * 1000).toLocaleDateString('zh-CN') : '未知',
        pic: editData.pic || v.vod_pic || '',
        vodPlayUrl: v.vod_play_url || '',
        vodBlurb: editData.vodBlurb || v.vod_blurb || v.vod_content || '',
        vodDirector: v.vod_director || '',
        vodActor: v.vod_actor || '',
        vodYear: v.vod_year || '',
        vodArea: v.vod_area || '',
        vodRemarks: v.vod_remarks || '',
        vodLang: v.vod_lang || '',
        _blocked: false
      }
    })
  return processed
}

const loadStats = async (forceRefresh = false) => {
  isLoading.value = true
  loadError.value = ''

  try {
    const cachedVideos = forceRefresh ? null : localStorage.getItem('adminVideoList')
    let videos = []

    if (cachedVideos) {
      videos = JSON.parse(cachedVideos)
    } else {
      const allData = await fetchFromAllSources({ ac: 'detail' }, 0, 80)
      videos = allData.list || []
      if (videos.length > 0) {
        localStorage.setItem('adminVideoList', JSON.stringify(videos))
      }
    }

    allVideos.value = videos
    const processed = processVideoData(videos)
    videoList.value = processed

    // Stats
    const totalViews = videos.reduce((sum, v) => sum + (parseInt(v.vod_hits) || 0), 0)
    const storageStats = loadStatsFromStorage()

    stats.value = {
      totalVideos: processed.length,
      totalViews,
      totalComments: storageStats.commentsCount,
      onlineUsers: storageStats.history.filter(h => {
        const t = new Date(h.time)
        return (Date.now() - t.getTime()) < 15 * 60 * 1000
      }).length,
      todayViews: storageStats.todayViews,
      weekViews: storageStats.weekViews
    }

    // Source stats
    const sourceMap = {}
    videoSources.forEach(s => { sourceMap[s.name] = { count: 0, views: 0 } })
    videos.forEach(v => {
      const name = v._source
      if (name && sourceMap[name]) {
        sourceMap[name].count++
        sourceMap[name].views += parseInt(v.vod_hits) || 0
      }
    })
    sourceStats.value = videoSources.map(s => ({
      name: s.name,
      count: sourceMap[s.name].count,
      views: sourceMap[s.name].views,
      avgViews: sourceMap[s.name].count > 0 ? Math.floor(sourceMap[s.name].views / sourceMap[s.name].count) : 0,
      status: sourceMap[s.name].count > 0 ? 'active' : 'inactive',
      enabled: localStorage.getItem(`source_${s.name}_enabled`) !== 'false'
    }))

    // Category stats
    const catMap = {}
    videos.forEach(v => {
      const typeName = v.vod_type_name || v.type_name || '其他'
      if (!catMap[typeName]) catMap[typeName] = { count: 0, views: 0 }
      catMap[typeName].count++
      catMap[typeName].views += parseInt(v.vod_hits) || 0
    })
    categoryStats.value = catMap

    // Visit records
    visitRecords.value = storageStats.history.slice(0, 100).map((h, index) => ({
      id: index + 1,
      videoName: h.name,
      videoId: h.id,
      time: h.time,
      duration: h.duration || '未知',
      device: h.device || (Math.random() > 0.5 ? 'Web' : 'Mobile'),
      progress: h.progress || 0
    }))

    loadCommentsData()
    loadBlockedVideos()
    showToast('success', `数据加载完成，共 ${processed.length} 个视频`)
  } catch (error) {
    console.error('加载统计数据失败:', error)
    loadError.value = error.message || '未知错误'
    showToast('error', '数据加载失败: ' + (error.message || '未知错误'))
  } finally {
    isLoading.value = false
  }
}

const syncFromApis = async () => {
  isLoading.value = true
  loadError.value = ''
  syncStatus.value = {}
  showToast('info', '正在从6个视频源同步数据...')

  try {
    const allData = await fetchFromAllSources({ ac: 'detail' }, 0, 80)
    const videos = allData.list || []
    localStorage.setItem('adminVideoList', JSON.stringify(videos))
    localStorage.removeItem('adminVideoEdits')
    localStorage.removeItem('adminVideoDeletes')

    syncStatus.value = {
      total: videos.length,
      sources: videoSources.map(s => ({
        name: s.name,
        count: videos.filter(v => v._source === s.name).length
      })),
      errors: allData.errors || []
    }

    if (videos.length > 0) {
      allVideos.value = videos
      videoList.value = processVideoData(videos)
      showToast('success', `同步完成! 共获取 ${videos.length} 个视频`)
    } else {
      showToast('error', '同步失败，未获取到数据')
    }
  } catch (error) {
    showToast('error', '同步失败: ' + (error.message || '网络错误'))
  } finally {
    isLoading.value = false
  }
}

// ═══════════════════════════════════════════
//   Revenue & Ad Settings
// ═══════════════════════════════════════════
const revenueData = ref([])
const monthlyEstimate = ref({})
const adSettings = ref(getAdSettings())
const todayRev = ref(getTodayRevenue())

const loadRevenueData = () => {
  revenueData.value = getRevenueData().slice(-30).reverse()
  monthlyEstimate.value = getMonthlyEstimate()
  todayRev.value = getTodayRevenue()
}

const saveAdConfig = () => {
  saveAdSettings(adSettings.value)
  showToast('success', '广告设置已保存')
}

const toggleAdSlot = (slotId) => {
  const idx = adSettings.value.disabledSlots.indexOf(slotId)
  if (idx >= 0) {
    adSettings.value.disabledSlots.splice(idx, 1)
  } else {
    adSettings.value.disabledSlots.push(slotId)
  }
}

// ═══════════════════════════════════════════
//   CRUD Operations (synced to localStorage)
// ═══════════════════════════════════════════
const saveToCache = () => {
  const edits = JSON.parse(localStorage.getItem('adminVideoEdits') || '{}')
  const deletes = JSON.parse(localStorage.getItem('adminVideoDeletes') || '[]')

  videoList.value.forEach(v => {
    if (v.status !== 'published' || v._dirty) {
      edits[String(v.id)] = { title: v.title, type: v.type, views: v.views, status: v.status, pic: v.pic, vodBlurb: v.vodBlurb }
    }
  })

  localStorage.setItem('adminVideoEdits', JSON.stringify(edits))
}

const openEditModal = (video) => {
  editingVideo.value = { ...video }
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editingVideo.value = null
}

const saveVideoEdit = () => {
  if (!editingVideo.value) return
  const idx = videoList.value.findIndex(v => v.id === editingVideo.value.id)
  if (idx !== -1) {
    videoList.value[idx] = { ...editingVideo.value, _dirty: true }
    saveToCache()
    showToast('success', '视频信息已更新')
  }
  closeEditModal()
}

const confirmDelete = (id) => {
  deletingId.value = id
  deletingMode.value = 'single'
  showDeleteConfirm.value = true
}

const confirmBatchDelete = () => {
  if (selectedIds.value.size === 0) return
  deletingMode.value = 'batch'
  showDeleteConfirm.value = true
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  deletingId.value = null
  deletingMode.value = 'single'
}

const executeDelete = () => {
  if (deletingMode.value === 'batch') {
    const ids = [...selectedIds.value]
    const deletes = new Set(JSON.parse(localStorage.getItem('adminVideoDeletes') || '[]'))
    ids.forEach(id => deletes.add(String(id)))
    localStorage.setItem('adminVideoDeletes', JSON.stringify([...deletes]))
    videoList.value = videoList.value.filter(v => !ids.includes(v.id))
    allVideos.value = allVideos.value.filter(v => !ids.includes(String(v.vod_id)))
    selectedIds.value.clear()
    selectAll.value = false
    showToast('success', `已删除 ${ids.length} 个视频`)
  } else {
    const deletes = new Set(JSON.parse(localStorage.getItem('adminVideoDeletes') || '[]'))
    deletes.add(String(deletingId.value))
    localStorage.setItem('adminVideoDeletes', JSON.stringify([...deletes]))
    videoList.value = videoList.value.filter(v => v.id !== deletingId.value)
    allVideos.value = allVideos.value.filter(v => String(v.vod_id) !== String(deletingId.value))
    selectedIds.value.delete(deletingId.value)
    showToast('success', '视频已删除')
  }
  stats.value.totalVideos = videoList.value.length
  cancelDelete()
}

// ═══════════════════════════════════════════
//   Batch Selection
// ═══════════════════════════════════════════
const toggleSelectAll = () => {
  selectAll.value = !selectAll.value
  selectedIds.value.clear()
  if (selectAll.value) {
    paginatedVideos.value.forEach(v => selectedIds.value.add(v.id))
  }
}

const toggleSelectVideo = (id) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
  selectAll.value = selectedIds.value.size === paginatedVideos.value.length
}

// ═══════════════════════════════════════════
//   Source Management
// ═══════════════════════════════════════════
const toggleSourceEnabled = (sourceName) => {
  const key = `source_${sourceName}_enabled`
  const current = localStorage.getItem(key) !== 'false'
  localStorage.setItem(key, String(!current))
  const idx = sourceStats.value.findIndex(s => s.name === sourceName)
  if (idx !== -1) sourceStats.value[idx].enabled = !current
  showToast('success', `${sourceName} 已${current ? '禁用' : '启用'}`)
}

// ═══════════════════════════════════════════
//   Comments
// ═══════════════════════════════════════════
const deleteComment = (id) => {
  commentsData.value = commentsData.value.filter(c => c.id !== id)
  const [videoId, idx] = id.split('_')
  const key = `comments_${videoId}`
  const comments = JSON.parse(localStorage.getItem(key) || '[]')
  comments.splice(parseInt(idx), 1)
  localStorage.setItem(key, JSON.stringify(comments))
  stats.value.totalComments = Math.max(0, stats.value.totalComments - 1)
  showToast('success', '评论已删除')
}

const deleteAllComments = () => {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && key.startsWith('comments_')) localStorage.removeItem(key)
  }
  commentsData.value = []
  stats.value.totalComments = 0
  showToast('success', '所有评论已清空')
}

// ═══════════════════════════════════════════
//   Video Actions
// ═══════════════════════════════════════════
const openVideoPage = (videoId) => {
  window.open(`${window.location.origin}/#/player/${videoId}`, '_blank')
}

const downloadVideo = (video) => {
  if (video.vodPlayUrl) {
    const urls = video.vodPlayUrl.split('#').filter(u => u.includes('http'))
    if (urls.length > 0) {
      window.open(urls[0].split('$')[1] || urls[0], '_blank')
    } else {
      showToast('error', '该视频暂无可用下载链接')
    }
  } else {
    showToast('error', '该视频暂无下载链接')
  }
}

// ═══════════════════════════════════════════
//   Computed
// ═══════════════════════════════════════════
const typeOptions = computed(() => {
  const types = new Set(videoList.value.map(v => v.type).filter(Boolean))
  return [...types].sort()
})

const sourceOptions = computed(() => {
  return videoSources.map(s => s.name)
})

const filteredVideos = computed(() => {
  let list = videoList.value

  // Ad block filter
  if (adBlockEnabled.value) {
    list = list.filter(v => !blockedVideos.value.has(String(v.id)))
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(v =>
      v.title.toLowerCase().includes(q) ||
      v.type.toLowerCase().includes(q) ||
      v.source.toLowerCase().includes(q)
    )
  }
  if (filterType.value) {
    list = list.filter(v => v.type === filterType.value)
  }
  if (filterSource.value) {
    list = list.filter(v => v.source === filterSource.value)
  }
  if (filterStatus.value) {
    list = list.filter(v => v.status === filterStatus.value)
  }

  return list
})

const paginatedVideos = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredVideos.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() => Math.ceil(filteredVideos.value.length / pageSize.value) || 1)

const blockedVideoList = computed(() => {
  return videoList.value.filter(v => blockedVideos.value.has(String(v.id)))
})

// ═══════════════════════════════════════════
//   Helpers
// ═══════════════════════════════════════════
const formatNumber = (num) => {
  if (num == null) return '0'
  if (num >= 10000) return (num / 10000).toFixed(1) + '万'
  return num.toLocaleString()
}

const getStatusBadge = (status) => {
  const map = { published: { cls: 'bg-green-500/20 text-green-400', label: '已发布' }, draft: { cls: 'bg-yellow-500/20 text-yellow-400', label: '草稿' }, hidden: { cls: 'bg-gray-500/20 text-gray-400', label: '已隐藏' } }
  return map[status] || map.published
}

const clearAllFilters = () => {
  searchQuery.value = ''
  filterType.value = ''
  filterSource.value = ''
  filterStatus.value = ''
  currentPage.value = 1
}

const goToPage = (page) => {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

const pageNumbers = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value
  let start = Math.max(1, current - 2)
  let end = Math.min(total, current + 2)
  if (end - start < 4) {
    if (start === 1) end = Math.min(total, start + 4)
    else start = Math.max(1, end - 4)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

// ═══════════════════════════════════════════
//   Lifecycle
// ═══════════════════════════════════════════
onMounted(() => {
  if (checkAuth()) {
    updateClock()
    clockTimer = setInterval(updateClock, 1000)
    loadStats()
    loadRevenueData()
  }
})

onUnmounted(() => {
  clearInterval(clockTimer)
  clearTimeout(toastTimer)
})
</script>

<template>
  <div class="min-h-screen bg-[#0f1014] text-gray-100">
    <!-- ═══ Sidebar ═══ -->
    <aside class="fixed left-0 top-0 h-full w-60 bg-[#1a1b23] border-r border-white/10 z-40 overflow-y-auto">
      <div class="p-5 border-b border-white/10">
        <router-link to="/home" class="flex items-center gap-3 group">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
            <LayoutDashboard class="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 class="font-bold text-white text-base">苍穹管理</h1>
            <p class="text-xs text-gray-500">视频数据控制台</p>
          </div>
        </router-link>
      </div>

      <nav class="p-3 space-y-0.5">
        <button v-for="item in navItems" :key="item.key"
          @click="currentTab = item.key; currentPage = 1"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
          :class="currentTab === item.key
            ? 'bg-gradient-to-r from-orange-500/15 to-red-500/15 text-orange-400 border border-orange-500/20'
            : 'text-gray-400 hover:bg-white/5 hover:text-white'">
          <component :is="item.icon" class="w-4 h-4" />
          <span class="font-medium">{{ item.label }}</span>
          <span v-if="item.key === 'videos'" class="ml-auto text-xs bg-white/10 rounded-full px-2 py-0.5">{{ videoList.length }}</span>
          <span v-if="item.key === 'blocked' && blockedVideos.size" class="ml-auto text-xs bg-red-500/20 text-red-400 rounded-full px-2 py-0.5">{{ blockedVideos.size }}</span>
        </button>
      </nav>

      <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-[#1a1b23]">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <Users class="w-4 h-4 text-white" />
          </div>
          <div>
            <p class="text-sm font-medium text-white">{{ adminUser.username || '管理员' }}</p>
            <p class="text-xs text-green-400 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> 在线</p>
          </div>
        </div>
        <div class="flex gap-2">
          <router-link to="/home" class="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 text-xs transition-colors">
            <ExternalLink class="w-3 h-3" /> 前台
          </router-link>
          <button @click="logout" class="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs transition-colors">
            <LogOut class="w-3 h-3" /> 退出
          </button>
        </div>
      </div>
    </aside>

    <!-- ═══ Main Content ═══ -->
    <main class="ml-60 p-6 lg:p-8">
      <!-- Header -->
      <header class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 class="text-xl font-bold text-white">{{ navItems.find(i => i.key === currentTab)?.label || '' }}</h2>
          <p class="text-gray-500 text-xs mt-0.5">{{ currentTime }}</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button v-if="currentTab !== 'overview' && currentTab !== 'blocked'" @click="syncFromApis" :disabled="isLoading"
            class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 text-sm transition-colors disabled:opacity-50">
            <RotateCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
            同步数据
          </button>
          <button @click="loadStats(true)" :disabled="isLoading"
            class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 text-sm transition-colors disabled:opacity-50">
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
            刷新
          </button>
          <div class="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs"
            :class="loadError ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'">
            <div class="w-1.5 h-1.5 rounded-full animate-pulse" :class="loadError ? 'bg-red-400' : 'bg-green-400'" />
            {{ loadError ? '数据异常' : '系统正常' }}
          </div>
        </div>
      </header>

      <!-- Loading -->
      <div v-if="isLoading" class="space-y-4">
        <div v-for="i in 6" :key="i" class="bg-[#1a1b23] rounded-2xl p-6 border border-white/5 animate-pulse">
          <div class="h-4 bg-white/5 rounded w-1/4 mb-4" />
          <div class="h-8 bg-white/5 rounded w-1/2" />
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="loadError && videoList.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle class="w-16 h-16 text-red-400 mb-4" />
        <h3 class="text-xl font-bold text-white mb-2">数据加载失败</h3>
        <p class="text-gray-400 mb-6">{{ loadError }}</p>
        <button @click="loadStats(true)" class="px-6 py-3 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors">重新加载</button>
      </div>

      <!-- Content -->
      <template v-else>

        <!-- ═══ OVERVIEW ═══ -->
        <div v-if="currentTab === 'overview'" class="space-y-6">
          <!-- Stat Cards -->
          <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div v-for="card in [
              { icon: Film, color: 'blue', label: '总视频数', value: stats.totalVideos, sub: videoSources.length + ' 个源' },
              { icon: Eye, color: 'orange', label: '总播放量', value: stats.totalViews, sub: '实时', subClass: 'text-green-400' },
              { icon: MessageSquare, color: 'purple', label: '总评论数', value: stats.totalComments, sub: '互动数据' },
              { icon: Users, color: 'green', label: '15分钟在线', value: stats.onlineUsers, sub: '活跃用户' },
              { icon: Activity, color: 'pink', label: '今日播放', value: stats.todayViews, sub: '24小时内' },
              { icon: Clock, color: 'cyan', label: '本周播放', value: stats.weekViews, sub: '7天内' }
            ]" :key="card.label" class="bg-[#1a1b23] rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors">
              <div class="flex items-center justify-between mb-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center" :class="`bg-${card.color}-500/20 text-${card.color}-400`">
                  <component :is="card.icon" class="w-5 h-5" />
                </div>
                <span class="text-xs text-gray-500">{{ card.label }}</span>
              </div>
              <p class="text-2xl font-black text-white">{{ formatNumber(card.value) }}</p>
              <p class="text-xs mt-1" :class="card.subClass || 'text-gray-500'">{{ card.sub }}</p>
            </div>
          </div>

          <!-- Source Stats Table -->
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/5">
            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Server class="w-5 h-5 text-orange-400" /> 视频源统计
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="text-left text-gray-400 text-xs border-b border-white/10">
                    <th class="pb-3 font-medium">视频源</th>
                    <th class="pb-3 font-medium">视频数</th>
                    <th class="pb-3 font-medium">总播放</th>
                    <th class="pb-3 font-medium">平均播放</th>
                    <th class="pb-3 font-medium">占比</th>
                    <th class="pb-3 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  <tr v-for="s in sourceStats" :key="s.name" class="border-b border-white/5 last:border-0">
                    <td class="py-3 text-white font-medium">{{ s.name }}</td>
                    <td class="py-3 text-gray-300">{{ s.count }}</td>
                    <td class="py-3 text-gray-300">{{ formatNumber(s.views) }}</td>
                    <td class="py-3 text-gray-300">{{ formatNumber(s.avgViews) }}</td>
                    <td class="py-3">
                      <div class="flex items-center gap-2">
                        <div class="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div class="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" :style="{ width: stats.totalVideos > 0 ? (s.count / stats.totalVideos * 100) + '%' : '0%' }" />
                        </div>
                        <span class="text-xs text-gray-400">{{ stats.totalVideos > 0 ? (s.count / stats.totalVideos * 100).toFixed(1) : 0 }}%</span>
                      </div>
                    </td>
                    <td class="py-3">
                      <span class="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit" :class="s.count > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'">
                        <CheckCircle v-if="s.count > 0" class="w-3 h-3" />
                        <XCircle v-else class="w-3 h-3" />
                        {{ s.count > 0 ? '正常' : '无数据' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Category Stats -->
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/5">
            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sliders class="w-5 h-5 text-purple-400" /> 分类统计
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              <div v-for="(data, name) in categoryStats" :key="name" class="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-colors">
                <p class="text-gray-400 text-xs mb-1">{{ name }}</p>
                <p class="text-xl font-bold text-white">{{ data.count }}</p>
                <p class="text-xs text-gray-500 mt-1">{{ formatNumber(data.views) }} 播放</p>
              </div>
            </div>
            <div v-if="Object.keys(categoryStats).length === 0" class="text-center py-8 text-gray-500">暂无分类数据</div>
          </div>
        </div>

        <!-- ═══ VIDEOS ═══ -->
        <div v-if="currentTab === 'videos'" class="space-y-4">
          <!-- Toolbar -->
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-2 flex-wrap flex-1">
              <div class="relative flex-1 max-w-xs">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input v-model="searchQuery" @input="currentPage = 1" type="text" placeholder="搜索标题、类型、来源..."
                  class="w-full bg-[#1a1b23] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50" />
              </div>
              <select v-model="filterType" @change="currentPage = 1" class="bg-[#1a1b23] border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-orange-500/50">
                <option value="">全部类型</option>
                <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
              </select>
              <select v-model="filterSource" @change="currentPage = 1" class="bg-[#1a1b23] border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-orange-500/50">
                <option value="">全部来源</option>
                <option v-for="s in sourceOptions" :key="s" :value="s">{{ s }}</option>
              </select>
              <select v-model="filterStatus" @change="currentPage = 1" class="bg-[#1a1b23] border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-orange-500/50">
                <option value="">全部状态</option>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
                <option value="hidden">已隐藏</option>
              </select>
              <button v-if="searchQuery || filterType || filterSource || filterStatus" @click="clearAllFilters" class="text-xs text-orange-400 hover:text-orange-300 px-2">
                <X class="w-4 h-4 inline" /> 清除筛选
              </button>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-400 text-xs">{{ filteredVideos.length }} / {{ videoList.length }} 个视频</span>
              <button v-if="selectedIds.size > 0" @click="confirmBatchDelete" class="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs transition-colors">
                <Trash2 class="w-3 h-3" /> 删除({{ selectedIds.size }})
              </button>
            </div>
          </div>

          <!-- Table -->
          <div class="bg-[#1a1b23] rounded-2xl border border-white/5 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-white/5">
                  <tr class="text-left text-gray-400 text-xs">
                    <th class="p-3 w-10">
                      <input type="checkbox" :checked="selectAll" @change="toggleSelectAll" class="rounded accent-orange-500" />
                    </th>
                    <th class="p-3 font-medium">视频信息</th>
                    <th class="p-3 font-medium hidden md:table-cell">类型</th>
                    <th class="p-3 font-medium hidden lg:table-cell">来源</th>
                    <th class="p-3 font-medium hidden sm:table-cell">播放量</th>
                    <th class="p-3 font-medium hidden xl:table-cell">状态</th>
                    <th class="p-3 font-medium hidden xl:table-cell">更新时间</th>
                    <th class="p-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  <tr v-if="paginatedVideos.length === 0">
                    <td colspan="8" class="p-12 text-center text-gray-500">
                      <Film class="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>暂无视频数据</p>
                      <button @click="syncFromApis" class="mt-3 text-orange-400 hover:text-orange-300 text-sm">从视频源同步数据</button>
                    </td>
                  </tr>
                  <tr v-for="video in paginatedVideos" :key="video.id" class="border-t border-white/5 hover:bg-white/5 transition-colors group">
                    <td class="p-3">
                      <input type="checkbox" :checked="selectedIds.has(video.id)" @change="toggleSelectVideo(video.id)" class="rounded accent-orange-500" />
                    </td>
                    <td class="p-3">
                      <div class="flex items-center gap-3">
                        <img v-if="video.pic" :src="video.pic" class="w-12 h-16 object-cover rounded-lg bg-gray-800 flex-shrink-0" @error="$event.target.src=''" loading="lazy">
                        <div v-else class="w-12 h-16 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0"><Film class="w-5 h-5 text-gray-600" /></div>
                        <div class="min-w-0">
                          <p class="text-white font-medium truncate max-w-[200px] lg:max-w-xs">{{ video.title }}</p>
                          <p class="text-gray-500 text-xs mt-0.5 font-mono">#{{ video.id }}</p>
                          <div class="flex gap-1 mt-1 lg:hidden">
                            <span class="text-xs text-gray-500">{{ video.type }}</span>
                            <span class="text-gray-600">·</span>
                            <span class="text-xs text-gray-500">{{ video.source }}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="p-3 text-gray-300 hidden md:table-cell">{{ video.type }}</td>
                    <td class="p-3 text-gray-300 hidden lg:table-cell">{{ video.source }}</td>
                    <td class="p-3 text-gray-300 hidden sm:table-cell font-mono text-xs">{{ formatNumber(video.views) }}</td>
                    <td class="p-3 hidden xl:table-cell">
                      <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="getStatusBadge(video.status).cls">{{ getStatusBadge(video.status).label }}</span>
                    </td>
                    <td class="p-3 text-gray-400 text-xs hidden xl:table-cell">{{ video.updateTime }}</td>
                    <td class="p-3">
                      <div class="flex items-center justify-end gap-1">
                        <button @click="openEditModal(video)" class="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors" title="编辑"><Edit2 class="w-3.5 h-3.5" /></button>
                        <button @click="openVideoPage(video.id)" class="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors" title="查看"><ExternalLink class="w-3.5 h-3.5" /></button>
                        <button @click="blockVideo(video.id)" v-if="!blockedVideos.has(String(video.id))" class="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors" title="过滤"><ShieldOff class="w-3.5 h-3.5" /></button>
                        <button @click="unblockVideo(video.id)" v-else class="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors" title="取消过滤"><Shield class="w-3.5 h-3.5" /></button>
                        <button @click="confirmDelete(video.id)" class="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors" title="删除"><Trash2 class="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="filteredVideos.length > 0" class="flex items-center justify-between px-4 py-3 border-t border-white/5 flex-wrap gap-3">
              <div class="flex items-center gap-2 text-xs text-gray-400">
                <span>每页</span>
                <select v-model="pageSize" @change="currentPage = 1" class="bg-[#0f1014] border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none">
                  <option :value="10">10</option>
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                </select>
                <span>条，{{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, filteredVideos.length) }} / {{ filteredVideos.length }}</span>
              </div>
              <div class="flex items-center gap-1">
                <button @click="goToPage(1)" :disabled="currentPage === 1" class="px-2 py-1 rounded text-xs bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30 transition-colors">首页</button>
                <button @click="goToPage(currentPage - 1)" :disabled="currentPage === 1" class="p-1.5 rounded bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30 transition-colors"><ChevronLeft class="w-4 h-4" /></button>
                <button v-for="p in pageNumbers" :key="p" @click="goToPage(p)"
                  class="w-8 h-8 rounded text-xs font-medium transition-colors"
                  :class="p === currentPage ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'">{{ p }}</button>
                <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages" class="p-1.5 rounded bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30 transition-colors"><ChevronRight class="w-4 h-4" /></button>
                <button @click="goToPage(totalPages)" :disabled="currentPage >= totalPages" class="px-2 py-1 rounded text-xs bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30 transition-colors">末页</button>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ SOURCES ═══ -->
        <div v-if="currentTab === 'sources'" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="source in sourceStats" :key="source.name" class="bg-[#1a1b23] rounded-2xl p-6 border transition-all" :class="source.enabled ? 'border-white/5' : 'border-red-500/20 opacity-60'">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-white">{{ source.name }}</h3>
                <button @click="toggleSourceEnabled(source.name)" class="relative w-10 h-5 rounded-full transition-colors" :class="source.enabled ? 'bg-green-500' : 'bg-gray-600'">
                  <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" :class="source.enabled ? 'left-5' : 'left-0.5'" />
                </button>
              </div>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-400">视频数量</span><span class="text-white font-medium">{{ source.count }}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">总播放量</span><span class="text-white font-medium">{{ formatNumber(source.views) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">平均播放</span><span class="text-white font-medium">{{ formatNumber(source.avgViews) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">数据占比</span><span class="text-white font-medium">{{ stats.totalVideos > 0 ? (source.count / stats.totalVideos * 100).toFixed(1) : 0 }}%</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ VISITS ═══ -->
        <div v-if="currentTab === 'visits'" class="space-y-4">
          <div class="bg-[#1a1b23] rounded-2xl border border-white/5 overflow-hidden">
            <div class="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 class="text-lg font-bold text-white">观看记录 ({{ visitRecords.length }} 条)</h3>
              <button @click="loadStats(true)" class="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"><RefreshCw class="w-3 h-3" /> 刷新</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-white/5">
                  <tr class="text-left text-gray-400 text-xs">
                    <th class="p-3 font-medium">视频名称</th>
                    <th class="p-3 font-medium hidden lg:table-cell">视频ID</th>
                    <th class="p-3 font-medium hidden md:table-cell">设备</th>
                    <th class="p-3 font-medium hidden md:table-cell">观看进度</th>
                    <th class="p-3 font-medium">访问时间</th>
                    <th class="p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  <tr v-if="visitRecords.length === 0">
                    <td colspan="6" class="p-12 text-center text-gray-500">
                      <Activity class="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>暂无访问记录</p>
                    </td>
                  </tr>
                  <tr v-for="record in visitRecords" :key="record.id" class="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td class="p-3 text-white font-medium max-w-[200px] truncate">{{ record.videoName }}</td>
                    <td class="p-3 text-gray-400 font-mono text-xs hidden lg:table-cell">#{{ record.videoId }}</td>
                    <td class="p-3 hidden md:table-cell">
                      <span class="px-2 py-0.5 rounded-full text-xs" :class="record.device === 'Mobile' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'">{{ record.device === 'Mobile' ? '手机' : '电脑' }}</span>
                    </td>
                    <td class="p-3 text-gray-300 hidden md:table-cell">{{ record.progress ? record.progress + '%' : '-' }}</td>
                    <td class="p-3 text-gray-400 text-xs">{{ record.time }}</td>
                    <td class="p-3">
                      <button @click="openVideoPage(record.videoId)" class="text-orange-400 hover:text-orange-300 text-xs flex items-center gap-1"><ExternalLink class="w-3 h-3" /> 查看</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ═══ COMMENTS ═══ -->
        <div v-if="currentTab === 'comments'" class="space-y-4">
          <div class="bg-[#1a1b23] rounded-2xl border border-white/5 overflow-hidden">
            <div class="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 class="text-lg font-bold text-white">评论列表 ({{ commentsData.length }} 条)</h3>
              <button v-if="commentsData.length > 0" @click="deleteAllComments" class="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 class="w-3 h-3" /> 清空全部</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-white/5">
                  <tr class="text-left text-gray-400 text-xs">
                    <th class="p-3 font-medium">用户</th>
                    <th class="p-3 font-medium">视频</th>
                    <th class="p-3 font-medium">评论内容</th>
                    <th class="p-3 font-medium hidden sm:table-cell">时间</th>
                    <th class="p-3 font-medium hidden sm:table-cell">点赞</th>
                    <th class="p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  <tr v-if="commentsData.length === 0">
                    <td colspan="6" class="p-12 text-center text-gray-500">
                      <MessageSquare class="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>暂无评论数据</p>
                    </td>
                  </tr>
                  <tr v-for="comment in commentsData" :key="comment.id" class="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td class="p-3 text-white font-medium">{{ comment.user }}</td>
                    <td class="p-3 text-gray-400 text-xs">#{{ comment.videoId }}</td>
                    <td class="p-3 text-gray-300 max-w-[300px] truncate">{{ comment.content }}</td>
                    <td class="p-3 text-gray-400 text-xs hidden sm:table-cell">{{ comment.time }}</td>
                    <td class="p-3 text-gray-300 hidden sm:table-cell">{{ comment.likes }}</td>
                    <td class="p-3">
                      <button @click="deleteComment(comment.id)" class="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ═══ REVENUE ═══ -->
        <div v-if="currentTab === 'revenue'" class="space-y-6">
          <!-- Revenue Stats -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="bg-[#1a1b23] rounded-2xl p-5 border border-white/5">
              <div class="flex items-center gap-2 mb-2">
                <DollarSign class="w-4 h-4 text-green-400" />
                <span class="text-xs text-gray-400">今日预估收入</span>
              </div>
              <p class="text-2xl font-black text-white">${{ todayRev.estimatedRevenue?.toFixed(2) || '0.00' }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ todayRev.impressions || 0 }} 次展示</p>
            </div>
            <div class="bg-[#1a1b23] rounded-2xl p-5 border border-white/5">
              <div class="flex items-center gap-2 mb-2">
                <TrendingUp class="w-4 h-4 text-blue-400" />
                <span class="text-xs text-gray-400">本月预估收入</span>
              </div>
              <p class="text-2xl font-black text-white">${{ monthlyEstimate.monthlyRevenue?.toFixed(2) || '0.00' }}</p>
              <p class="text-xs text-gray-500 mt-1">近30天</p>
            </div>
            <div class="bg-[#1a1b23] rounded-2xl p-5 border border-white/5">
              <div class="flex items-center gap-2 mb-2">
                <Activity class="w-4 h-4 text-purple-400" />
                <span class="text-xs text-gray-400">平均 RPM</span>
              </div>
              <p class="text-2xl font-black text-white">${{ (monthlyEstimate.avgRPM || 0).toFixed(2) }}</p>
              <p class="text-xs text-gray-500 mt-1">每千次展示</p>
            </div>
            <div class="bg-[#1a1b23] rounded-2xl p-5 border border-white/5">
              <div class="flex items-center gap-2 mb-2">
                <CreditCard class="w-4 h-4 text-orange-400" />
                <span class="text-xs text-gray-400">预计年收入</span>
              </div>
              <p class="text-2xl font-black text-white">${{ monthlyEstimate.projectedAnnual?.toFixed(2) || '0.00' }}</p>
              <p class="text-xs text-gray-500 mt-1">基于30天数据推算</p>
            </div>
          </div>

          <!-- Revenue Chart (Simple) -->
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/5">
            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp class="w-5 h-5 text-green-400" /> 近期收益趋势
            </h3>
            <div class="flex items-end gap-1 h-48">
              <div v-for="(day, idx) in revenueData.slice(-30)" :key="idx"
                class="flex-1 bg-gradient-to-t from-green-500/80 to-green-400/40 rounded-t transition-all hover:from-green-400 hover:to-green-300"
                :style="{ height: Math.max(day.estimatedRevenue / Math.max(...revenueData.map(d => d.estimatedRevenue), 0.01) * 100, 2) + '%' }"
                :title="`${day.date}: $${day.estimatedRevenue.toFixed(2)}`">
              </div>
            </div>
            <div class="flex justify-between mt-2 text-xs text-gray-500">
              <span>{{ revenueData[0]?.date || '-' }}</span>
              <span>{{ revenueData[revenueData.length - 1]?.date || '-' }}</span>
            </div>
          </div>

          <!-- Revenue Sources Breakdown -->
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/5">
            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <PieChart class="w-5 h-5 text-blue-400" /> 广告位收益分布
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="text-left text-gray-400 text-xs border-b border-white/10">
                    <th class="pb-3 font-medium">广告位</th>
                    <th class="pb-3 font-medium">展示次数</th>
                    <th class="pb-3 font-medium">点击次数</th>
                    <th class="pb-3 font-medium">CTR</th>
                    <th class="pb-3 font-medium">占比</th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  <tr v-for="slot in adSlots.filter(s => s.enabled)" :key="slot.id" class="border-b border-white/5">
                    <td class="py-3 text-white font-medium">{{ slot.name }}</td>
                    <td class="py-3 text-gray-300">{{ (todayRev.slotBreakdown?.[slot.id]?.impressions || 0).toLocaleString() }}</td>
                    <td class="py-3 text-gray-300">{{ todayRev.slotBreakdown?.[slot.id]?.clicks || 0 }}</td>
                    <td class="py-3 text-gray-300">{{ ((todayRev.slotBreakdown?.[slot.id]?.clicks || 0) / Math.max(todayRev.slotBreakdown?.[slot.id]?.impressions || 1, 1) * 100).toFixed(1) }}%</td>
                    <td class="py-3 text-gray-300">{{ todayRev.impressions > 0 ? ((todayRev.slotBreakdown?.[slot.id]?.impressions || 0) / todayRev.impressions * 100).toFixed(1) : 0 }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Revenue Potential -->
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/5">
            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap class="w-5 h-5 text-yellow-400" /> 收入提升建议
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div class="bg-white/5 rounded-xl p-4">
                <p class="text-white font-medium mb-1">开启前贴片广告</p>
                <p class="text-gray-400 text-xs">视频前贴片广告平均 RPM $8-15，是展示广告的 3-5 倍</p>
              </div>
              <div class="bg-white/5 rounded-xl p-4">
                <p class="text-white font-medium mb-1">提高内容质量</p>
                <p class="text-gray-400 text-xs">当前 {{ monthlyEstimate.totalVideos || 0 }} 个视频，{{ formatNumber(monthlyEstimate.totalViews || 0) }} 播放量。增加优质内容可提升流量</p>
              </div>
              <div class="bg-white/5 rounded-xl p-4">
                <p class="text-white font-medium mb-1">优化广告位布局</p>
                <p class="text-gray-400 text-xs">信息流广告每 {{ adSettings.feedInterval }} 个视频展示一次，适当降低间隔可提升展示量</p>
              </div>
              <div class="bg-white/5 rounded-xl p-4">
                <p class="text-white font-medium mb-1">Google AdSense 变现</p>
                <p class="text-gray-400 text-xs">部署到生产域名后，替换 ca-pub ID 即可自动接入 AdSense 广告网络</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ AD SETTINGS ═══ -->
        <div v-if="currentTab === 'ads'" class="space-y-6">
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/5">
            <h3 class="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Sliders class="w-5 h-5 text-orange-400" /> 广告设置
            </h3>

            <div class="space-y-4">
              <!-- Master Switch -->
              <div class="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p class="text-white font-medium">广告总开关</p>
                  <p class="text-gray-400 text-xs">控制全站广告展示</p>
                </div>
                <button @click="adSettings.enabled = !adSettings.enabled"
                  class="relative w-12 h-6 rounded-full transition-colors"
                  :class="adSettings.enabled ? 'bg-green-500' : 'bg-gray-600'">
                  <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform" :class="adSettings.enabled ? 'left-6' : 'left-0.5'" />
                </button>
              </div>

              <!-- Pre-roll -->
              <div class="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p class="text-white font-medium">视频前贴片广告</p>
                  <p class="text-gray-400 text-xs">播放视频前展示广告 (VAST)</p>
                </div>
                <button @click="adSettings.prerollEnabled = !adSettings.prerollEnabled"
                  class="relative w-12 h-6 rounded-full transition-colors"
                  :class="adSettings.prerollEnabled ? 'bg-green-500' : 'bg-gray-600'">
                  <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform" :class="adSettings.prerollEnabled ? 'left-6' : 'left-0.5'" />
                </button>
              </div>

              <!-- Skip Time -->
              <div class="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p class="text-white font-medium">前贴片跳过时间</p>
                  <p class="text-gray-400 text-xs">用户可在几秒后跳过广告</p>
                </div>
                <select v-model.number="adSettings.prerollSkipTime"
                  class="bg-[#0f1014] border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none">
                  <option :value="3">3 秒</option>
                  <option :value="5">5 秒</option>
                  <option :value="10">10 秒</option>
                  <option :value="15">15 秒</option>
                  <option :value="30">不可跳过</option>
                </select>
              </div>

              <!-- Feed Interval -->
              <div class="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p class="text-white font-medium">信息流广告间隔</p>
                  <p class="text-gray-400 text-xs">每N个视频卡片插入一条广告</p>
                </div>
                <select v-model.number="adSettings.feedInterval"
                  class="bg-[#0f1014] border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none">
                  <option :value="4">4 个</option>
                  <option :value="6">6 个</option>
                  <option :value="8">8 个</option>
                  <option :value="10">10 个</option>
                  <option :value="15">15 个</option>
                </select>
              </div>

              <!-- Individual Slots -->
              <div class="py-3">
                <p class="text-white font-medium mb-3">广告位管理</p>
                <div v-for="slot in adSlots" :key="slot.id" class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p class="text-white text-sm">{{ slot.name }}</p>
                    <p class="text-gray-500 text-xs">{{ slot.type }} · {{ slot.width }}×{{ slot.height }}</p>
                  </div>
                  <button @click="toggleAdSlot(slot.id)"
                    class="relative w-12 h-6 rounded-full transition-colors"
                    :class="!adSettings.disabledSlots.includes(slot.id) ? 'bg-green-500' : 'bg-gray-600'">
                    <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                      :class="!adSettings.disabledSlots.includes(slot.id) ? 'left-6' : 'left-0.5'" />
                  </button>
                </div>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-white/10">
              <button @click="saveAdConfig"
                class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium text-sm hover:opacity-90 transition-opacity">
                保存广告设置
              </button>
            </div>
          </div>

          <!-- AdSense Info -->
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/5">
            <h3 class="text-lg font-bold text-white mb-4">Google AdSense 接入指南</h3>
            <div class="space-y-3 text-sm text-gray-300">
              <div class="flex gap-3">
                <span class="text-orange-400 font-bold flex-shrink-0">1.</span>
                <span>前往 <a href="https://www.google.com/adsense" target="_blank" class="text-blue-400 hover:underline">Google AdSense</a> 注册账号并通过审核</span>
              </div>
              <div class="flex gap-3">
                <span class="text-orange-400 font-bold flex-shrink-0">2.</span>
                <span>获取发布商 ID (ca-pub-xxxxxxxxxxxxxxxx) 并替换 <code class="bg-white/10 px-1 rounded text-xs">src/utils/ads.ts</code> 中的 AD_CLIENT</span>
              </div>
              <div class="flex gap-3">
                <span class="text-orange-400 font-bold flex-shrink-0">3.</span>
                <span>在 AdSense 后台创建对应尺寸的广告单元，更新 adSlots 配置</span>
              </div>
              <div class="flex gap-3">
                <span class="text-orange-400 font-bold flex-shrink-0">4.</span>
                <span>部署到生产域名，AdSense 自动开始投放广告并产生收益</span>
              </div>
              <div class="flex gap-3">
                <span class="text-orange-400 font-bold flex-shrink-0">5.</span>
                <span>收益达到 $100 阈值后，Google 每月自动结算到您的银行账户</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ BLOCKED VIDEOS ═══ -->
        <div v-if="currentTab === 'blocked'" class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-bold text-white">广告过滤列表</h3>
              <span class="text-xs text-gray-400">{{ blockedVideos.size }} 个视频被过滤</span>
            </div>
            <div class="flex items-center gap-2">
              <button @click="toggleAdBlock" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors" :class="adBlockEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'">
                <component :is="adBlockEnabled ? Shield : ShieldOff" class="w-4 h-4" />
                {{ adBlockEnabled ? '过滤已开启' : '过滤已关闭' }}
              </button>
              <button v-if="blockedVideos.size > 0" @click="unblockAll" class="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors">清空列表</button>
            </div>
          </div>

          <div v-if="blockedVideoList.length === 0 && blockedVideos.size === 0" class="bg-[#1a1b23] rounded-2xl p-12 text-center border border-white/5">
            <Shield class="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 class="text-lg font-bold text-white mb-2">过滤列表为空</h3>
            <p class="text-gray-400 text-sm">在视频管理中点击 <ShieldOff class="w-4 h-4 inline text-yellow-400" /> 图标可将视频加入过滤列表</p>
            <p class="text-gray-500 text-xs mt-2">被过滤的视频将不会在前端首页展示</p>
          </div>

          <div v-else class="bg-[#1a1b23] rounded-2xl border border-white/5 overflow-hidden">
            <table class="w-full">
              <thead class="bg-white/5">
                <tr class="text-left text-gray-400 text-xs">
                  <th class="p-3 font-medium">视频信息</th>
                  <th class="p-3 font-medium hidden md:table-cell">类型</th>
                  <th class="p-3 font-medium hidden lg:table-cell">来源</th>
                  <th class="p-3 font-medium">播放量</th>
                  <th class="p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                <tr v-for="video in blockedVideoList" :key="video.id" class="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td class="p-3">
                    <div class="flex items-center gap-3">
                      <img v-if="video.pic" :src="video.pic" class="w-10 h-14 object-cover rounded bg-gray-800 flex-shrink-0" @error="$event.target.src=''" loading="lazy">
                      <div class="min-w-0">
                        <p class="text-white font-medium truncate max-w-[200px]">{{ video.title }}</p>
                        <p class="text-gray-500 text-xs mt-0.5 font-mono">#{{ video.id }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="p-3 text-gray-300 hidden md:table-cell">{{ video.type }}</td>
                  <td class="p-3 text-gray-300 hidden lg:table-cell">{{ video.source }}</td>
                  <td class="p-3 text-gray-300">{{ formatNumber(video.views) }}</td>
                  <td class="p-3">
                    <button @click="unblockVideo(video.id)" class="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 transition-colors flex items-center gap-1">
                      <Shield class="w-3 h-3" /> 取消过滤
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="blockedVideoList.length === 0 && blockedVideos.size > 0" class="p-8 text-center text-gray-500">
              <p>这些视频已被删除，从列表中移除</p>
            </div>
          </div>
        </div>

      </template>
    </main>

    <!-- ═══ Edit Modal ═══ -->
    <Teleport to="body">
      <div v-if="showEditModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" @click.self="closeEditModal">
        <div class="bg-[#1a1b23] rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">编辑视频信息</h3>
            <button @click="closeEditModal" class="p-2 rounded-lg hover:bg-white/10 transition-colors"><X class="w-5 h-5 text-gray-400" /></button>
          </div>

          <div v-if="editingVideo" class="space-y-4">
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">视频标题</label>
              <input v-model="editingVideo.title" type="text" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50" />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">类型</label>
                <input v-model="editingVideo.type" type="text" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">来源</label>
                <input v-model="editingVideo.source" type="text" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">播放量</label>
                <input v-model.number="editingVideo.views" type="number" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">年份</label>
                <input v-model="editingVideo.vodYear" type="text" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">状态</label>
                <select v-model="editingVideo.status" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50">
                  <option value="published">已发布</option>
                  <option value="draft">草稿</option>
                  <option value="hidden">已隐藏</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">导演</label>
                <input v-model="editingVideo.vodDirector" type="text" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">演员</label>
                <input v-model="editingVideo.vodActor" type="text" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>
            </div>

            <div>
              <label class="block text-xs text-gray-400 mb-1.5">视频简介</label>
              <textarea v-model="editingVideo.vodBlurb" rows="3" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 resize-none" />
            </div>

            <div>
              <label class="block text-xs text-gray-400 mb-1.5">封面图片 URL</label>
              <input v-model="editingVideo.pic" type="text" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50" placeholder="输入图片URL" />
              <img v-if="editingVideo.pic" :src="editingVideo.pic" class="w-24 h-32 object-cover rounded-lg mt-2 bg-gray-800" @error="$event.target.style.display='none'">
            </div>

            <div>
              <label class="block text-xs text-gray-400 mb-1.5">备注</label>
              <input v-model="editingVideo.vodRemarks" type="text" class="w-full bg-[#0f1014] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50" placeholder="集数/更新状态" />
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
            <button @click="closeEditModal" class="px-5 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 text-sm transition-colors">取消</button>
            <button @click="saveVideoEdit" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2">
              <Save class="w-4 h-4" /> 保存修改
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══ Delete Confirm Modal ═══ -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" @click.self="cancelDelete">
        <div class="bg-[#1a1b23] rounded-2xl p-6 w-full max-w-md border border-white/10">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Trash2 class="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 class="text-lg font-bold text-white">确认删除</h3>
              <p class="text-sm text-gray-400">此操作不可撤销</p>
            </div>
          </div>
          <p class="text-gray-300 mb-6 text-sm">
            {{ deletingMode === 'batch' ? `确定要删除选中的 ${selectedIds.size} 个视频吗？` : '确定要删除此视频吗？' }}
          </p>
          <div class="flex items-center justify-end gap-3">
            <button @click="cancelDelete" class="px-5 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 text-sm transition-colors">取消</button>
            <button @click="executeDelete" class="px-5 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors">确认删除</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══ Toast ═══ -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toast.show" class="fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 max-w-sm"
          :class="toast.type === 'success' ? 'bg-green-500 text-white' : toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'">
          <CheckCircle v-if="toast.type === 'success'" class="w-4 h-4 flex-shrink-0" />
          <AlertTriangle v-else-if="toast.type === 'error'" class="w-4 h-4 flex-shrink-0" />
          <Zap v-else class="w-4 h-4 flex-shrink-0" />
          {{ toast.message }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.toast-enter-active { transition: all 0.3s ease-out; }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from { opacity: 0; transform: translateX(30px); }
.toast-leave-to { opacity: 0; transform: translateX(30px); }
</style>
