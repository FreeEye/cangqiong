<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { Clock, Trash2, User } from 'lucide-vue-next'

const router = useRouter()
const historyList = ref([])

// 加载历史记录
const loadHistory = () => {
  const history = localStorage.getItem('watchHistory')
  if (history) {
    historyList.value = JSON.parse(history)
  }
}

// 删除单个历史记录
const deleteHistory = (index) => {
  historyList.value.splice(index, 1)
  localStorage.setItem('watchHistory', JSON.stringify(historyList.value))
}

// 清空所有历史记录
const clearAllHistory = () => {
  if (confirm('确定要清空所有观看历史吗？')) {
    historyList.value = []
    localStorage.removeItem('watchHistory')
  }
}

// 跳转到对应的剧集
const goToPlayer = (item) => {
  router.push({
    path: `/player/${item.id}`,
    query: { episode: item.episode }
  })
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <div class="min-h-screen bg-[#0f1014] text-gray-100 font-sans pb-10">
    <NavBar />

    <div class="pt-20 mx-auto max-w-7xl px-4 lg:px-8">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center">
            <Clock class="w-6 h-6 text-purple-400" />
          </div>
          <h1 class="text-3xl font-bold text-white">
            观看历史
          </h1>
        </div>

        <!-- 清空历史按钮 -->
        <button
          v-if="historyList.length > 0"
          @click="clearAllHistory"
          class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-[#1a1b21] text-gray-400 hover:text-white hover:bg-[#25262c]"
        >
          <Trash2 class="w-4 h-4" />
          清空历史
        </button>
      </div>

      <!-- 历史记录列表 -->
      <div v-if="historyList.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div
          v-for="(item, index) in historyList"
          :key="index"
          class="group relative bg-[#1a1b21] rounded-xl overflow-hidden border border-white/5 transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-600/10 cursor-pointer"
          @click="goToPlayer(item)"
        >
          <!-- 封面图 -->
          <div class="relative aspect-[2/3] overflow-hidden">
            <img
              :src="item.pic"
              alt="item.name"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            >

            <!-- 删除按钮 -->
            <button
              @click.stop="deleteHistory(index)"
              class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-gray-400 hover:bg-purple-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 class="w-3 h-3" />
            </button>

            <!-- 播放时间 -->
            <div class="absolute bottom-2 right-2 bg-black/70 text-xs px-2 py-1 rounded">
              {{ item.episode }}
            </div>
          </div>

          <!-- 标题 -->
          <div class="p-3">
            <div class="text-sm font-medium text-white line-clamp-2">
              {{ item.name }}
            </div>

            <!-- 播放进度 -->
            <div class="mt-2 text-xs text-gray-500">
              {{ item.time }}
            </div>
          </div>
        </div>
      </div>

      <!-- 空历史记录提示 -->
      <div v-else class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-20 h-20 rounded-full bg-[#1a1b21] flex items-center justify-center mb-6">
          <User class="w-10 h-10 text-gray-600" />
        </div>
        <h2 class="text-xl font-bold text-gray-400 mb-3">
          暂无观看历史
        </h2>
        <p class="text-gray-500 max-w-md">
          您还没有观看过任何影片，快去浏览首页发现精彩内容吧！
        </p>
      </div>
    </div>
  </div>
</template>
