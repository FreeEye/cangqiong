<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { 
  LayoutDashboard, Film, Users, Eye, Clock, MessageSquare, 
  LogOut, Search, Plus, Edit2, Trash2, BarChart3, 
  ChevronLeft, ChevronRight, Database, TrendingUp, Activity,
  RefreshCw, CheckCircle, XCircle
} from 'lucide-vue-next'
import { fetchFromAllSources, videoSources } from '@/utils/api'

const router = useRouter()
const currentTab = ref('overview')
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 10
const isLoading = ref(false)

// 管理员信息
const adminUser = ref({})

// 统计数据
const stats = ref({
  totalVideos: 0,
  totalViews: 0,
  totalComments: 0,
  onlineUsers: 0,
  todayViews: 0,
  weekViews: 0
})

// 视频列表
const videoList = ref([])

// 访问记录
const visitRecords = ref([])

// 评论数据
const commentsData = ref([])

// 视频源统计
const sourceStats = ref([])

// 分类统计
const categoryStats = ref({})

// 检查登录状态
const checkAuth = () => {
  const token = localStorage.getItem('admin_token')
  if (!token) {
    router.push('/admin/login')
    return false
  }
  
  const user = localStorage.getItem('admin_user')
  if (user) {
    adminUser.value = JSON.parse(user)
  }
  return true
}

// 退出登录
const logout = () => {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')
  router.push('/admin/login')
}

// 从localStorage获取真实统计数据
const loadStatsFromStorage = () => {
  // 获取观看历史
  const history = JSON.parse(localStorage.getItem('watchHistory') || '[]')
  
  // 获取所有评论
  let allComments = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('comments_')) {
      const comments = JSON.parse(localStorage.getItem(key) || '[]')
      allComments = allComments.concat(comments)
    }
  }
  
  // 获取在线人数
  const liveViewers = parseInt(localStorage.getItem('liveViewers') || '0')
  
  // 计算今日和本周访问（基于历史记录）
  const today = new Date().toDateString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  
  const todayViews = history.filter(h => new Date(h.time).toDateString() === today).length
  const weekViews = history.filter(h => new Date(h.time) > weekAgo).length
  
  return {
    historyCount: history.length,
    commentsCount: allComments.length,
    liveViewers: liveViewers,
    todayViews: todayViews,
    weekViews: weekViews
  }
}

// 加载统计数据（从API获取真实数据）
const loadStats = async () => {
  isLoading.value = true
  try {
    // 从所有视频源获取真实数据
    const allData = await fetchFromAllSources({ ac: 'detail' }, 200)
    const videos = allData.list || []
    
    // 计算总播放量
    const totalViews = videos.reduce((sum, v) => sum + (parseInt(v.vod_hits) || 0), 0)
    
    // 获取localStorage统计
    const storageStats = loadStatsFromStorage()
    
    // 更新统计数据 - 使用真实数据
    stats.value = {
      totalVideos: videos.length,
      totalViews: totalViews,
      totalComments: storageStats.commentsCount,
      onlineUsers: storageStats.liveViewers || 0,
      todayViews: storageStats.todayViews,
      weekViews: storageStats.weekViews
    }
    
    // 更新视频列表（真实数据）
    videoList.value = videos.slice(0, 50).map((v, index) => ({
      id: v.vod_id || index,
      title: v.vod_name,
      type: v.vod_type_name || v.type_name || '未知',
      source: v._source || '未知',
      views: parseInt(v.vod_hits) || 0,
      duration: v.vod_duration || '未知',
      status: 'published',
      updateTime: v.vod_time ? new Date(v.vod_time).toLocaleDateString('zh-CN') : '未知',
      pic: v.vod_pic
    }))
    
    // 按视频源统计
    const sourceMap = {}
    videoSources.forEach(s => {
      sourceMap[s.name] = { count: 0, views: 0, status: 'active' }
    })
    
    videos.forEach(v => {
      const sourceName = v._source
      if (sourceName && sourceMap[sourceName]) {
        sourceMap[sourceName].count++
        sourceMap[sourceName].views += parseInt(v.vod_hits) || 0
      }
    })
    
    sourceStats.value = videoSources.map(s => ({
      name: s.name,
      count: sourceMap[s.name]?.count || 0,
      views: sourceMap[s.name]?.views || 0,
      status: sourceMap[s.name]?.count > 0 ? 'active' : 'inactive'
    }))
    
    // 按分类统计
    const catMap = {}
    videos.forEach(v => {
      const typeName = v.vod_type_name || v.type_name || '其他'
      if (!catMap[typeName]) {
        catMap[typeName] = { count: 0, views: 0 }
      }
      catMap[typeName].count++
      catMap[typeName].views += parseInt(v.vod_hits) || 0
    })
    categoryStats.value = catMap
    
    // 生成访问记录（基于真实观看历史）
    const history = JSON.parse(localStorage.getItem('watchHistory') || '[]')
    visitRecords.value = history.slice(0, 20).map((h, index) => ({
      id: index + 1,
      ip: '用户访问',
      page: `/player/${h.id}`,
      videoName: h.name,
      time: h.time,
      duration: '-',
      device: 'Web'
    }))
    
    // 获取评论数据
    loadCommentsData()
    
  } catch (error) {
    console.error('加载统计数据失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 加载评论数据
const loadCommentsData = () => {
  let allComments = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('comments_')) {
      const videoId = key.replace('comments_', '')
      const comments = JSON.parse(localStorage.getItem(key) || '[]')
      comments.forEach((c, idx) => {
        allComments.push({
          id: `${videoId}_${idx}`,
          user: c.user,
          videoId: videoId,
          video: `视频 ${videoId}`,
          content: c.content,
          time: c.time,
          likes: c.likes || 0,
          status: 'approved'
        })
      })
    }
  }
  
  // 按时间排序
  allComments.sort((a, b) => new Date(b.time) - new Date(a.time))
  commentsData.value = allComments.slice(0, 50)
}

// 过滤后的视频列表
const filteredVideos = computed(() => {
  if (!searchQuery.value) return videoList.value
  return videoList.value.filter(v => 
    v.title.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// 分页后的视频列表
const paginatedVideos = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredVideos.value.slice(start, start + pageSize)
})

// 总页数
const totalPages = computed(() => Math.ceil(filteredVideos.value.length / pageSize))

// 刷新数据
const refreshData = () => {
  loadStats()
}

// 删除视频（从列表中移除）
const deleteVideo = (id) => {
  if (confirm('确定要从列表中移除这个视频吗？')) {
    videoList.value = videoList.value.filter(v => v.id !== id)
  }
}

// 删除评论
const deleteComment = (id) => {
  if (confirm('确定要删除这条评论吗？')) {
    commentsData.value = commentsData.value.filter(c => c.id !== id)
    // 从localStorage中也删除
    const [videoId, idx] = id.split('_')
    const key = `comments_${videoId}`
    const comments = JSON.parse(localStorage.getItem(key) || '[]')
    comments.splice(parseInt(idx), 1)
    localStorage.setItem(key, JSON.stringify(comments))
  }
}

// 格式化数字
const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  return num.toLocaleString()
}

onMounted(() => {
  if (checkAuth()) {
    loadStats()
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#0f1014] text-gray-100">
    <!-- 侧边栏 -->
    <aside class="fixed left-0 top-0 h-full w-64 bg-[#1a1b23] border-r border-white/10 z-50">
      <div class="p-6 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <LayoutDashboard class="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 class="font-bold text-white">苍穹管理</h1>
            <p class="text-xs text-gray-400">数据统计后台</p>
          </div>
        </div>
      </div>
      
      <nav class="p-4 space-y-1">
        <button @click="currentTab = 'overview'" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all" :class="currentTab === 'overview' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'">
          <BarChart3 class="w-5 h-5" />
          <span class="font-medium">数据概览</span>
        </button>
        
        <button @click="currentTab = 'videos'" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all" :class="currentTab === 'videos' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'">
          <Film class="w-5 h-5" />
          <span class="font-medium">视频管理</span>
        </button>
        
        <button @click="currentTab = 'sources'" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all" :class="currentTab === 'sources' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'">
          <Database class="w-5 h-5" />
          <span class="font-medium">视频源管理</span>
        </button>
        
        <button @click="currentTab = 'visits'" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all" :class="currentTab === 'visits' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'">
          <Activity class="w-5 h-5" />
          <span class="font-medium">访问统计</span>
        </button>
        
        <button @click="currentTab = 'comments'" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all" :class="currentTab === 'comments' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'">
          <MessageSquare class="w-5 h-5" />
          <span class="font-medium">评论管理</span>
        </button>
      </nav>
      
      <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Users class="w-5 h-5 text-white" />
          </div>
          <div>
            <p class="text-sm font-medium text-white">{{ adminUser.username || '管理员' }}</p>
            <p class="text-xs text-gray-400">在线</p>
          </div>
        </div>
        <button @click="logout" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all">
          <LogOut class="w-4 h-4" />
          <span class="text-sm font-medium">退出登录</span>
        </button>
      </div>
    </aside>
    
    <!-- 主内容区 -->
    <main class="ml-64 p-8">
      <!-- 顶部栏 -->
      <header class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-2xl font-black text-white">
            {{ currentTab === 'overview' ? '数据概览' : 
               currentTab === 'videos' ? '视频管理' :
               currentTab === 'sources' ? '视频源管理' :
               currentTab === 'visits' ? '访问统计' : '评论管理' }}
          </h2>
          <p class="text-gray-400 text-sm mt-1">{{ new Date().toLocaleString('zh-CN') }}</p>
        </div>
        <div class="flex items-center gap-4">
          <button @click="refreshData" :disabled="isLoading" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50">
            <RefreshCw class="w-4 h-4" :class="isLoading ? 'animate-spin' : ''" />
            刷新数据
          </button>
          <div class="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm">
            <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            系统正常
          </div>
        </div>
      </header>
      
      <!-- 加载状态 -->
      <div v-if="isLoading" class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
      
      <template v-else>
        <!-- 数据概览 -->
        <div v-if="currentTab === 'overview'" class="space-y-6">
          <!-- 统计卡片 -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Film class="w-6 h-6 text-blue-400" />
                </div>
                <span class="text-xs text-gray-400">总视频数</span>
              </div>
              <p class="text-3xl font-black text-white">{{ formatNumber(stats.totalVideos) }}</p>
              <p class="text-sm text-gray-500 mt-2">来自 {{ videoSources.length }} 个视频源</p>
            </div>
            
            <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Eye class="w-6 h-6 text-orange-400" />
                </div>
                <span class="text-xs text-gray-400">总播放量</span>
              </div>
              <p class="text-3xl font-black text-white">{{ formatNumber(stats.totalViews) }}</p>
              <p class="text-sm text-green-400 mt-2 flex items-center gap-1">
                <TrendingUp class="w-4 h-4" /> 实时统计
              </p>
            </div>
            
            <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <MessageSquare class="w-6 h-6 text-purple-400" />
                </div>
                <span class="text-xs text-gray-400">总评论数</span>
              </div>
              <p class="text-3xl font-black text-white">{{ formatNumber(stats.totalComments) }}</p>
              <p class="text-sm text-gray-500 mt-2">用户互动数据</p>
            </div>
            
            <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Users class="w-6 h-6 text-green-400" />
                </div>
                <span class="text-xs text-gray-400">在线用户</span>
              </div>
              <p class="text-3xl font-black text-white">{{ formatNumber(stats.onlineUsers) }}</p>
              <p class="text-sm text-gray-500 mt-2">实时</p>
            </div>
            
            <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <Activity class="w-6 h-6 text-pink-400" />
                </div>
                <span class="text-xs text-gray-400">今日访问</span>
              </div>
              <p class="text-3xl font-black text-white">{{ formatNumber(stats.todayViews) }}</p>
              <p class="text-sm text-gray-500 mt-2">24小时内</p>
            </div>
            
            <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Clock class="w-6 h-6 text-cyan-400" />
                </div>
                <span class="text-xs text-gray-400">本周访问</span>
              </div>
              <p class="text-3xl font-black text-white">{{ formatNumber(stats.weekViews) }}</p>
              <p class="text-sm text-gray-500 mt-2">7天内</p>
            </div>
          </div>
          
          <!-- 视频源统计 -->
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
            <h3 class="text-lg font-bold text-white mb-4">视频源统计</h3>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="text-left text-gray-400 text-sm border-b border-white/10">
                    <th class="pb-3 font-medium">视频源名称</th>
                    <th class="pb-3 font-medium">视频数量</th>
                    <th class="pb-3 font-medium">总播放量</th>
                    <th class="pb-3 font-medium">占比</th>
                    <th class="pb-3 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  <tr v-for="source in sourceStats" :key="source.name" class="border-b border-white/5 last:border-0">
                    <td class="py-4 text-white font-medium">{{ source.name }}</td>
                    <td class="py-4 text-gray-300">{{ source.count }}</td>
                    <td class="py-4 text-gray-300">{{ formatNumber(source.views) }}</td>
                    <td class="py-4 text-gray-300">
                      <div class="flex items-center gap-2">
                        <div class="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div class="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" :style="{ width: stats.totalVideos > 0 ? (source.count / stats.totalVideos * 100) + '%' : '0%' }" />
                        </div>
                        <span class="text-xs">{{ stats.totalVideos > 0 ? (source.count / stats.totalVideos * 100).toFixed(1) : 0 }}%</span>
                      </div>
                    </td>
                    <td class="py-4">
                      <span class="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit" :class="source.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'">
                        <CheckCircle v-if="source.status === 'active'" class="w-3 h-3" />
                        <XCircle v-else class="w-3 h-3" />
                        {{ source.status === 'active' ? '正常' : '未使用' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- 分类统计 -->
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
            <h3 class="text-lg font-bold text-white mb-4">分类统计</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div v-for="(data, name) in categoryStats" :key="name" class="bg-white/5 rounded-xl p-4">
                <p class="text-gray-400 text-sm mb-1">{{ name }}</p>
                <p class="text-2xl font-bold text-white">{{ data.count }}</p>
                <p class="text-xs text-gray-500 mt-1">{{ formatNumber(data.views) }} 播放</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 视频管理 -->
        <div v-if="currentTab === 'videos'" class="space-y-6">
          <div class="flex items-center justify-between">
            <div class="relative">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input v-model="searchQuery" type="text" placeholder="搜索视频标题..." class="bg-[#1a1b23] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 w-80" />
            </div>
            <div class="flex items-center gap-2 text-gray-400 text-sm">
              共 {{ filteredVideos.length }} 个视频
            </div>
          </div>
          
          <div class="bg-[#1a1b23] rounded-2xl border border-white/10 overflow-hidden">
            <table class="w-full">
              <thead class="bg-white/5">
                <tr class="text-left text-gray-400 text-sm">
                  <th class="p-4 font-medium">视频信息</th>
                  <th class="p-4 font-medium">类型</th>
                  <th class="p-4 font-medium">视频源</th>
                  <th class="p-4 font-medium">播放量</th>
                  <th class="p-4 font-medium">更新时间</th>
                  <th class="p-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                <tr v-for="video in paginatedVideos" :key="video.id" class="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td class="p-4">
                    <div class="flex items-center gap-3">
                      <img v-if="video.pic" :src="video.pic" class="w-12 h-16 object-cover rounded-lg bg-gray-800">
                      <div>
                        <p class="text-white font-medium">{{ video.title }}</p>
                        <p class="text-gray-500 text-xs">ID: {{ video.id }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="p-4 text-gray-300">{{ video.type }}</td>
                  <td class="p-4 text-gray-300">{{ video.source }}</td>
                  <td class="p-4 text-gray-300">{{ formatNumber(video.views) }}</td>
                  <td class="p-4 text-gray-400">{{ video.updateTime }}</td>
                  <td class="p-4">
                    <div class="flex items-center gap-2">
                      <button class="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
                        <Edit2 class="w-4 h-4" />
                      </button>
                      <button @click="deleteVideo(video.id)" class="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <!-- 分页 -->
            <div class="flex items-center justify-between p-4 border-t border-white/10">
              <p class="text-gray-400 text-sm">显示 {{ paginatedVideos.length }} / {{ filteredVideos.length }} 条</p>
              <div class="flex items-center gap-2">
                <button @click="currentPage--" :disabled="currentPage === 1" class="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft class="w-5 h-5" />
                </button>
                <span class="text-gray-400 text-sm">第 {{ currentPage }} / {{ totalPages }} 页</span>
                <button @click="currentPage++" :disabled="currentPage === totalPages" class="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 视频源管理 -->
        <div v-if="currentTab === 'sources'" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="source in sourceStats" :key="source.name" class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-white">{{ source.name }}</h3>
                <span class="px-2 py-1 rounded-full text-xs font-medium" :class="source.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'">
                  {{ source.status === 'active' ? '正常' : '未使用' }}
                </span>
              </div>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-gray-400 text-sm">视频数量</span>
                  <span class="text-white font-medium">{{ source.count }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400 text-sm">总播放量</span>
                  <span class="text-white font-medium">{{ formatNumber(source.views) }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400 text-sm">平均播放量</span>
                  <span class="text-white font-medium">{{ source.count > 0 ? formatNumber(Math.floor(source.views / source.count)) : 0 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 访问统计 -->
        <div v-if="currentTab === 'visits'" class="space-y-6">
          <div class="bg-[#1a1b23] rounded-2xl border border-white/10 overflow-hidden">
            <div class="p-4 border-b border-white/10">
              <h3 class="text-lg font-bold text-white">观看历史记录</h3>
            </div>
            <table class="w-full">
              <thead class="bg-white/5">
                <tr class="text-left text-gray-400 text-sm">
                  <th class="p-4 font-medium">视频名称</th>
                  <th class="p-4 font-medium">访问页面</th>
                  <th class="p-4 font-medium">访问时间</th>
                  <th class="p-4 font-medium">设备类型</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                <tr v-for="record in visitRecords" :key="record.id" class="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td class="p-4 text-white">{{ record.videoName }}</td>
                  <td class="p-4 text-orange-400">{{ record.page }}</td>
                  <td class="p-4 text-gray-300">{{ record.time }}</td>
                  <td class="p-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium" :class="record.device === 'Mobile' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'">
                      {{ record.device === 'Mobile' ? '手机' : '电脑' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- 评论管理 -->
        <div v-if="currentTab === 'comments'" class="space-y-6">
          <div class="bg-[#1a1b23] rounded-2xl border border-white/10 overflow-hidden">
            <div class="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 class="text-lg font-bold text-white">评论列表 ({{ commentsData.length }} 条)</h3>
            </div>
            <table class="w-full">
              <thead class="bg-white/5">
                <tr class="text-left text-gray-400 text-sm">
                  <th class="p-4 font-medium">用户</th>
                  <th class="p-4 font-medium">评论内容</th>
                  <th class="p-4 font-medium">时间</th>
                  <th class="p-4 font-medium">点赞</th>
                  <th class="p-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                <tr v-for="comment in commentsData" :key="comment.id" class="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td class="p-4 text-white font-medium">{{ comment.user }}</td>
                  <td class="p-4 text-gray-300 max-w-md truncate">{{ comment.content }}</td>
                  <td class="p-4 text-gray-400">{{ comment.time }}</td>
                  <td class="p-4 text-gray-300">{{ comment.likes }}</td>
                  <td class="p-4">
                    <button @click="deleteComment(comment.id)" class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors">
                      删除
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
