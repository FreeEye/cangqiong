<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { 
  LayoutDashboard, Film, Users, Eye, Clock, MessageSquare, 
  LogOut, Search, Plus, Edit2, Trash2, BarChart3, 
  ChevronLeft, ChevronRight, Database, TrendingUp, Activity
} from 'lucide-vue-next'

const router = useRouter()
const currentTab = ref('overview')
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 10

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
const sourceStats = ref([
  { name: '如意资源', count: 0, views: 0, status: 'active' },
  { name: '极速资源', count: 0, views: 0, status: 'active' },
  { name: '非凡影视', count: 0, views: 0, status: 'active' },
  { name: '卧龙资源', count: 0, views: 0, status: 'active' },
  { name: '最大资源', count: 0, views: 0, status: 'active' },
  { name: '无尽资源', count: 0, views: 0, status: 'active' }
])

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

// 加载统计数据
const loadStats = () => {
  // 从localStorage读取数据
  const history = JSON.parse(localStorage.getItem('watchHistory') || '[]')
  const comments = JSON.parse(localStorage.getItem('all_comments') || '[]')
  const liveViewers = parseInt(localStorage.getItem('liveViewers') || '0')
  
  // 模拟统计数据
  stats.value = {
    totalVideos: 1256,
    totalViews: history.length * 150 + 50000,
    totalComments: comments.length || 328,
    onlineUsers: liveViewers || Math.floor(Math.random() * 1000) + 500,
    todayViews: Math.floor(Math.random() * 5000) + 2000,
    weekViews: Math.floor(Math.random() * 30000) + 15000
  }
  
  // 更新视频源统计
  sourceStats.value.forEach(source => {
    source.count = Math.floor(Math.random() * 300) + 100
    source.views = Math.floor(Math.random() * 10000) + 5000
  })
}

// 加载视频列表
const loadVideoList = () => {
  const mockVideos = [
    { id: 1, title: '苍穹之下', type: '电影', source: '如意资源', views: 12580, duration: '2:15:30', status: 'published', updateTime: '2025-04-01' },
    { id: 2, title: '星辰大海', type: '电视剧', source: '极速资源', views: 8960, duration: '45:00', status: 'published', updateTime: '2025-04-01' },
    { id: 3, title: '梦想启航', type: '综艺', source: '非凡影视', views: 6540, duration: '1:30:00', status: 'published', updateTime: '2025-03-31' },
    { id: 4, title: '魔法学院', type: '动漫', source: '卧龙资源', views: 15230, duration: '24:00', status: 'published', updateTime: '2025-03-31' },
    { id: 5, title: '都市奇缘', type: '电视剧', source: '最大资源', views: 9870, duration: '42:00', status: 'published', updateTime: '2025-03-30' },
    { id: 6, title: '科幻世界', type: '电影', source: '无尽资源', views: 7890, duration: '1:58:00', status: 'published', updateTime: '2025-03-30' },
    { id: 7, title: '美食之旅', type: '纪录片', source: '如意资源', views: 4320, duration: '50:00', status: 'published', updateTime: '2025-03-29' },
    { id: 8, title: '音乐盛典', type: '综艺', source: '极速资源', views: 11250, duration: '2:00:00', status: 'published', updateTime: '2025-03-29' }
  ]
  videoList.value = mockVideos
}

// 加载访问记录
const loadVisitRecords = () => {
  const records = []
  const pages = ['/home', '/player/123', '/category/1', '/search', '/history']
  const ips = ['192.168.1.*', '10.0.0.*', '172.16.0.*']
  
  for (let i = 0; i < 20; i++) {
    records.push({
      id: i + 1,
      ip: ips[Math.floor(Math.random() * ips.length)],
      page: pages[Math.floor(Math.random() * pages.length)],
      time: new Date(Date.now() - Math.random() * 86400000).toLocaleString('zh-CN'),
      duration: Math.floor(Math.random() * 300) + 30 + '秒',
      device: Math.random() > 0.5 ? 'Mobile' : 'Desktop'
    })
  }
  visitRecords.value = records
}

// 加载评论数据
const loadComments = () => {
  const comments = []
  const users = ['小明同学', '影视爱好者', '追剧达人', '电影迷', '剧情控']
  
  for (let i = 0; i < 15; i++) {
    comments.push({
      id: i + 1,
      user: users[Math.floor(Math.random() * users.length)] + Math.floor(Math.random() * 100),
      video: '视频标题 ' + (Math.floor(Math.random() * 100) + 1),
      content: '这是一条测试评论内容，用户表达了对视频的看法...',
      time: new Date(Date.now() - Math.random() * 86400000 * 7).toLocaleString('zh-CN'),
      status: Math.random() > 0.8 ? 'pending' : 'approved'
    })
  }
  commentsData.value = comments
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

// 删除视频
const deleteVideo = (id) => {
  if (confirm('确定要删除这个视频吗？')) {
    videoList.value = videoList.value.filter(v => v.id !== id)
  }
}

// 删除评论
const deleteComment = (id) => {
  if (confirm('确定要删除这条评论吗？')) {
    commentsData.value = commentsData.value.filter(c => c.id !== id)
  }
}

onMounted(() => {
  if (checkAuth()) {
    loadStats()
    loadVideoList()
    loadVisitRecords()
    loadComments()
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
        <button
          @click="currentTab = 'overview'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
          :class="currentTab === 'overview' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
        >
          <BarChart3 class="w-5 h-5" />
          <span class="font-medium">数据概览</span>
        </button>
        
        <button
          @click="currentTab = 'videos'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
          :class="currentTab === 'videos' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
        >
          <Film class="w-5 h-5" />
          <span class="font-medium">视频管理</span>
        </button>
        
        <button
          @click="currentTab = 'sources'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
          :class="currentTab === 'sources' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
        >
          <Database class="w-5 h-5" />
          <span class="font-medium">视频源管理</span>
        </button>
        
        <button
          @click="currentTab = 'visits'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
          :class="currentTab === 'visits' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
        >
          <Activity class="w-5 h-5" />
          <span class="font-medium">访问统计</span>
        </button>
        
        <button
          @click="currentTab = 'comments'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
          :class="currentTab === 'comments' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
        >
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
        <button
          @click="logout"
          class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
        >
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
          <div class="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm">
            <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            系统正常运行
          </div>
        </div>
      </header>
      
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
            <p class="text-3xl font-black text-white">{{ stats.totalVideos.toLocaleString() }}</p>
            <p class="text-sm text-green-400 mt-2 flex items-center gap-1">
              <TrendingUp class="w-4 h-4" /> +12 今日
            </p>
          </div>
          
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Eye class="w-6 h-6 text-orange-400" />
              </div>
              <span class="text-xs text-gray-400">总播放量</span>
            </div>
            <p class="text-3xl font-black text-white">{{ (stats.totalViews / 10000).toFixed(1) }}万</p>
            <p class="text-sm text-green-400 mt-2 flex items-center gap-1">
              <TrendingUp class="w-4 h-4" /> +5.2% 本周
            </p>
          </div>
          
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <MessageSquare class="w-6 h-6 text-purple-400" />
              </div>
              <span class="text-xs text-gray-400">总评论数</span>
            </div>
            <p class="text-3xl font-black text-white">{{ stats.totalComments.toLocaleString() }}</p>
            <p class="text-sm text-green-400 mt-2 flex items-center gap-1">
              <TrendingUp class="w-4 h-4" /> +28 今日
            </p>
          </div>
          
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Users class="w-6 h-6 text-green-400" />
              </div>
              <span class="text-xs text-gray-400">在线用户</span>
            </div>
            <p class="text-3xl font-black text-white">{{ stats.onlineUsers.toLocaleString() }}</p>
            <p class="text-sm text-gray-400 mt-2">实时</p>
          </div>
          
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                <Activity class="w-6 h-6 text-pink-400" />
              </div>
              <span class="text-xs text-gray-400">今日访问</span>
            </div>
            <p class="text-3xl font-black text-white">{{ stats.todayViews.toLocaleString() }}</p>
            <p class="text-sm text-green-400 mt-2 flex items-center gap-1">
              <TrendingUp class="w-4 h-4" /> +15% 较昨日
            </p>
          </div>
          
          <div class="bg-[#1a1b23] rounded-2xl p-6 border border-white/10">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Clock class="w-6 h-6 text-cyan-400" />
              </div>
              <span class="text-xs text-gray-400">本周访问</span>
            </div>
            <p class="text-3xl font-black text-white">{{ (stats.weekViews / 10000).toFixed(1) }}万</p>
            <p class="text-sm text-green-400 mt-2 flex items-center gap-1">
              <TrendingUp class="w-4 h-4" /> +8.5% 较上周
            </p>
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
                  <th class="pb-3 font-medium">状态</th>
                  <th class="pb-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                <tr v-for="source in sourceStats" :key="source.name" class="border-b border-white/5 last:border-0">
                  <td class="py-4 text-white font-medium">{{ source.name }}</td>
                  <td class="py-4 text-gray-300">{{ source.count }}</td>
                  <td class="py-4 text-gray-300">{{ source.views.toLocaleString() }}</td>
                  <td class="py-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium" 
                          :class="source.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'">
                      {{ source.status === 'active' ? '正常' : '异常' }}
                    </span>
                  </td>
                  <td class="py-4">
                    <button class="text-orange-400 hover:text-orange-300 text-sm">查看详情</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- 视频管理 -->
      <div v-if="currentTab === 'videos'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div class="relative">
            <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索视频标题..."
              class="bg-[#1a1b23] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 w-80"
            />
          </div>
          <button class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:shadow-lg hover:shadow-orange-500/30 transition-all">
            <Plus class="w-5 h-5" />
            添加视频
          </button>
        </div>
        
        <div class="bg-[#1a1b23] rounded-2xl border border-white/10 overflow-hidden">
          <table class="w-full">
            <thead class="bg-white/5">
              <tr class="text-left text-gray-400 text-sm">
                <th class="p-4 font-medium">ID</th>
                <th class="p-4 font-medium">视频标题</th>
                <th class="p-4 font-medium">类型</th>
                <th class="p-4 font-medium">视频源</th>
                <th class="p-4 font-medium">播放量</th>
                <th class="p-4 font-medium">时长</th>
                <th class="p-4 font-medium">状态</th>
                <th class="p-4 font-medium">更新时间</th>
                <th class="p-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="text-sm">
              <tr v-for="video in paginatedVideos" :key="video.id" class="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td class="p-4 text-gray-400">{{ video.id }}</td>
                <td class="p-4 text-white font-medium">{{ video.title }}</td>
                <td class="p-4 text-gray-300">{{ video.type }}</td>
                <td class="p-4 text-gray-300">{{ video.source }}</td>
                <td class="p-4 text-gray-300">{{ video.views.toLocaleString() }}</td>
                <td class="p-4 text-gray-300">{{ video.duration }}</td>
                <td class="p-4">
                  <span class="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    已发布
                  </span>
                </td>
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
            <p class="text-gray-400 text-sm">共 {{ filteredVideos.length }} 条记录</p>
            <div class="flex items-center gap-2">
              <button 
                @click="currentPage--" 
                :disabled="currentPage === 1"
                class="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft class="w-5 h-5" />
              </button>
              <span class="text-gray-400 text-sm">第 {{ currentPage }} / {{ totalPages }} 页</span>
              <button 
                @click="currentPage++" 
                :disabled="currentPage === totalPages"
                class="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
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
              <span class="px-2 py-1 rounded-full text-xs font-medium" 
                    :class="source.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'">
                {{ source.status === 'active' ? '正常' : '异常' }}
              </span>
            </div>
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-gray-400 text-sm">视频数量</span>
                <span class="text-white font-medium">{{ source.count }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-400 text-sm">总播放量</span>
                <span class="text-white font-medium">{{ source.views.toLocaleString() }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-400 text-sm">今日新增</span>
                <span class="text-green-400 font-medium">+{{ Math.floor(Math.random() * 20) + 5 }}</span>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-white/10 flex gap-2">
              <button class="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors">
                测试连接
              </button>
              <button class="flex-1 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/30 transition-colors">
                同步数据
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 访问统计 -->
      <div v-if="currentTab === 'visits'" class="space-y-6">
        <div class="bg-[#1a1b23] rounded-2xl border border-white/10 overflow-hidden">
          <div class="p-4 border-b border-white/10">
            <h3 class="text-lg font-bold text-white">实时访问记录</h3>
          </div>
          <table class="w-full">
            <thead class="bg-white/5">
              <tr class="text-left text-gray-400 text-sm">
                <th class="p-4 font-medium">ID</th>
                <th class="p-4 font-medium">IP地址</th>
                <th class="p-4 font-medium">访问页面</th>
                <th class="p-4 font-medium">访问时间</th>
                <th class="p-4 font-medium">停留时长</th>
                <th class="p-4 font-medium">设备类型</th>
              </tr>
            </thead>
            <tbody class="text-sm">
              <tr v-for="record in visitRecords" :key="record.id" class="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td class="p-4 text-gray-400">{{ record.id }}</td>
                <td class="p-4 text-gray-300">{{ record.ip }}</td>
                <td class="p-4 text-orange-400">{{ record.page }}</td>
                <td class="p-4 text-gray-300">{{ record.time }}</td>
                <td class="p-4 text-gray-300">{{ record.duration }}</td>
                <td class="p-4">
                  <span class="px-2 py-1 rounded-full text-xs font-medium" 
                        :class="record.device === 'Mobile' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'">
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
            <h3 class="text-lg font-bold text-white">评论列表</h3>
            <div class="flex gap-2">
              <button class="px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors">
                全部
              </button>
              <button class="px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/30 transition-colors">
                待审核
              </button>
            </div>
          </div>
          <table class="w-full">
            <thead class="bg-white/5">
              <tr class="text-left text-gray-400 text-sm">
                <th class="p-4 font-medium">ID</th>
                <th class="p-4 font-medium">用户</th>
                <th class="p-4 font-medium">视频</th>
                <th class="p-4 font-medium">评论内容</th>
                <th class="p-4 font-medium">时间</th>
                <th class="p-4 font-medium">状态</th>
                <th class="p-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="text-sm">
              <tr v-for="comment in commentsData" :key="comment.id" class="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td class="p-4 text-gray-400">{{ comment.id }}</td>
                <td class="p-4 text-white font-medium">{{ comment.user }}</td>
                <td class="p-4 text-gray-300">{{ comment.video }}</td>
                <td class="p-4 text-gray-300 max-w-xs truncate">{{ comment.content }}</td>
                <td class="p-4 text-gray-400">{{ comment.time }}</td>
                <td class="p-4">
                  <span class="px-2 py-1 rounded-full text-xs font-medium" 
                        :class="comment.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'">
                    {{ comment.status === 'approved' ? '已通过' : '待审核' }}
                  </span>
                </td>
                <td class="p-4">
                  <div class="flex items-center gap-2">
                    <button class="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 transition-colors">
                      通过
                    </button>
                    <button @click="deleteComment(comment.id)" class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors">
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>
