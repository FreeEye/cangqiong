<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import VideoCard from '@/components/VideoCard.vue'
import { Search, Frown, Sparkles, ChevronRight, Clock, X } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const list = ref([])
const total = ref(0)
const localKeyword = ref('') // 页面中间大搜索框的值
const searchHistory = ref([]) // 搜索历史记录
const showHistory = ref(false) // 是否显示历史记录
const searchContainer = ref(null) // 搜索框容器ref

// 从本地存储加载搜索历史
const loadSearchHistory = () => {
  const history = localStorage.getItem('searchHistory')
  if (history) {
    searchHistory.value = JSON.parse(history)
  }
}

// 保存搜索历史到本地存储
const saveSearchHistory = () => {
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
}

// 添加搜索关键词到历史记录
const addToHistory = (keyword) => {
  if (!keyword.trim()) return

  // 移除重复的关键词
  const index = searchHistory.value.indexOf(keyword)
  if (index > -1) {
    searchHistory.value.splice(index, 1)
  }

  // 添加到历史记录开头
  searchHistory.value.unshift(keyword)

  // 限制历史记录数量
  if (searchHistory.value.length > 10) {
    searchHistory.value = searchHistory.value.slice(0, 10)
  }

  saveSearchHistory()
}

// 清空搜索历史
const clearHistory = () => {
  searchHistory.value = []
  saveSearchHistory()
}

// 删除单个历史记录
const removeFromHistory = (keyword) => {
  const index = searchHistory.value.indexOf(keyword)
  if (index > -1) {
    searchHistory.value.splice(index, 1)
    saveSearchHistory()
  }
}

// 点击历史记录执行搜索
const searchFromHistory = (keyword) => {
  localKeyword.value = keyword
  handleLocalSearch()
  showHistory.value = false
}

// 核心搜索逻辑
const doSearch = async (keyword) => {
  if (!keyword) return

  loading.value = true
  localKeyword.value = keyword // 同步输入框文字

  try {
    // 接口参数：ac=detail & wd=关键词
    const res = await fetch(`/api/proxy?ac=detail&wd=${encodeURIComponent(keyword)}`)
    const data = await res.json()

    list.value = data.list || []
    total.value = data.total || 0

    // 添加到搜索历史
    addToHistory(keyword)
  } catch (e) {
    console.error('搜索失败', e)
    list.value = []
  } finally {
    loading.value = false
  }
}

// 页面内部的大搜索框提交
const handleLocalSearch = () => {
  if (!localKeyword.value.trim()) return
  // 修改路由，会触发下方的 watch
  router.push({ path: '/search', query: { q: localKeyword.value } })
}

// 监听路由参数变化 (比如从NavBar再次搜索)
watch(
  () => route.query.q,
  (newVal) => {
    if (newVal) doSearch(newVal)
  },
  { immediate: true } // 初始化时立即执行一次
)

// 组件挂载时加载搜索历史
onMounted(() => {
  loadSearchHistory()

  // 点击外部关闭搜索历史记录
  const handleClickOutside = (event) => {
    if (showHistory.value && searchContainer.value && !searchContainer.value.contains(event.target)) {
      showHistory.value = false
    }
  }

  // 添加全局点击事件监听
  document.addEventListener('click', handleClickOutside)

  // 组件卸载时移除监听
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
})
</script>

<template>
  <div class="min-h-screen bg-[#0f1014] pb-20">
    <NavBar />

    <div class="pt-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <!-- 1. 搜索头部区域 -->
      <div class="flex flex-col items-center justify-center mb-12 space-y-6">
        <!-- 大搜索框 -->
        <div ref="searchContainer" class="relative w-full max-w-3xl group mx-auto">
          <!-- 1. 动态光晕背景 (重点优化：聚焦时扩散并变亮) -->
          <div
            class="absolute -inset-0.5 rounded-full bg-gradient-to-r from-purple-600 via-blue-500 to-purple-600 opacity-30 blur-md transition-all duration-500 group-hover:opacity-60 group-focus-within:opacity-100 group-focus-within:blur-lg"
          />

          <!-- 2. 输入框容器 (主体) -->
          <div class="relative flex items-center bg-[#15161c] rounded-full p-1.5 shadow-2xl transition-transform duration-300 group-focus-within:scale-[1.01]">
            <!-- 左侧图标 -->
            <div class="pl-4 pr-3 text-gray-500 transition-colors group-focus-within:text-purple-400">
              <Search class="w-6 h-6" />
            </div>

            <!-- 输入框本体 (去除默认边框和Ring) -->
            <input
              v-model="localKeyword"
              @keyup.enter="handleLocalSearch"
              @focus="showHistory = true"
              type="text"
              class="flex-1 bg-transparent border-none text-white text-lg h-12 px-2 focus:ring-0 placeholder-gray-600"
              placeholder="输入关键词，如：复仇者"
            >

            <!-- 右侧分割线 (装饰) -->
            <div class="h-6 w-[1px] bg-white/10 mx-2 hidden sm:block" />

            <!-- 右侧按钮 (胶囊型，融合在内部) -->
            <button
              @click="handleLocalSearch"
              class="hidden sm:flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-3 rounded-full font-bold transition-all shadow-lg shadow-purple-900/20 active:scale-95"
            >
              <span>搜索</span>
              <!-- 添加一个小箭头图标增加动感 -->
              <ChevronRight class="w-4 h-4" />
            </button>

            <!-- 移动端显示的简单按钮 -->
            <div
              @click="handleLocalSearch"
              class="sm:hidden w-12 h-12 flex justify-center items-center absolute right-10px top-1/2 -translate-y-1/2 p-3 bg-purple-600 rounded-full text-white ml-2"
            >
              <Search class="w-5 h-5" />
            </div>
          </div>

          <!-- 搜索历史记录 -->
          <div v-if="showHistory && searchHistory.length > 0" class="absolute left-0 right-0 mt-2 bg-[#15161c] rounded-xl shadow-2xl overflow-hidden z-10">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div class="flex items-center gap-2 text-gray-400">
                <Clock class="w-4 h-4" />
                <span class="text-sm font-medium">搜索历史</span>
              </div>
              <button @click="clearHistory" class="text-xs font-medium text-gray-400 hover:text-purple-400 transition-all duration-300 px-2 py-1 rounded-full bg-[#1a1b23] hover:bg-gray-700">
                清空
              </button>
            </div>
            <div class="max-h-60 overflow-y-auto">
              <div
                v-for="(item, index) in searchHistory"
                :key="index"
                class="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors cursor-pointer group"
                @click="searchFromHistory(item)"
              >
                <div class="flex items-center gap-3">
                  <div class="text-gray-500 group-hover:text-purple-400 transition-colors">
                    <Clock class="w-4 h-4" />
                  </div>
                  <span class="text-white text-sm">{{ item }}</span>
                </div>
                <button
                  @click.stop="removeFromHistory(item)"
                  class="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800/50 text-gray-500 hover:bg-purple-400/20 hover:text-purple-400 transition-all duration-300 opacity-0 group-hover:opacity-100"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 搜索反馈文案 -->
        <div v-if="route.query.q && !loading" class="text-gray-400 flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-purple-400" />
          <span>
            搜索 "<span class="text-white font-bold">{{ route.query.q }}</span>"
            共找到 <span class="text-purple-400 font-bold">{{ total }}</span> 部相关影片
          </span>
        </div>
      </div>

      <!-- 2. 结果列表 -->

      <!-- Loading 骨架屏 -->
      <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
        <div v-for="i in 12" :key="i" class="animate-pulse">
          <div class="aspect-[2/3] bg-white/5 rounded-xl mb-3" />
          <div class="h-4 w-3/4 bg-white/5 rounded mb-2" />
          <div class="h-3 w-1/2 bg-white/5 rounded" />
        </div>
      </div>

      <!-- 真实数据 -->
      <div v-else-if="list.length > 0" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
        <VideoCard
          v-for="video in list"
          :key="video.vod_id"
          :video="video"
          @click="router.push(`/player/${video.vod_id}`)"
        />
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading && route.query.q" class="flex flex-col items-center justify-center py-20 text-center opacity-0 animate-fade-in-up" style="animation-fill-mode: forwards;">
        <div class="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <Frown class="w-10 h-10 text-gray-500" />
        </div>
        <h3 class="text-xl font-bold text-white mb-2">
          没有找到相关影片
        </h3>
        <p class="text-gray-500 max-w-md mx-auto">
          尝试一下缩短关键词，或者换一个名字？<br>
          例如将 "复仇者联盟4" 改为 "复仇者"
        </p>
      </div>

      <!-- 初始状态 (还没搜的时候) -->
      <div v-else class="text-center py-20">
        <p class="text-gray-600">
          请输入关键词开始探索影视库...
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 简单的淡入动画 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out;
}
</style>
