<script setup>
import { ref, onMounted, watch, nextTick, onActivated, onDeactivated } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import VideoCard from '@/components/VideoCard.vue'
import { LayoutGrid, ChevronLeft, ChevronRight, Filter } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

// 在 script setup 中添加
const scrollContainer = ref(null) // 1. 定义 ref 变量

// 2. 定义滚动处理函数
const handleWheel = (e) => {
  // e.deltaY > 0 表示向下滚动（对应向右）
  // e.deltaY < 0 表示向上滚动（对应向左）
  if (scrollContainer.value) {
    scrollContainer.value.scrollLeft += e.deltaY
  }
}

// --- 状态定义 ---
const loading = ref(true)
const typePid = ref('1')
const curTypeId = ref('')
const categoryList = ref([]) // 所有分类菜单
const videoList = ref([]) // 当前页视频列表
const currentCategory = ref({}) // 当前选中的分类信息
const pagination = ref({
  page: 1, // 当前页
  pagecount: 1, // 总页数
  total: 0 // 总条数
})

// --- 滚动位置缓存 ---
const scrollPosition = ref(0) // 保存滚动位置

// --- 核心：获取所有分类 (用于顶部导航) ---
const fetchCategories = async (id = '') => {
  try {
    typePid.value = id || route.params.id
    console.log('typePid.value', typePid.value)

    const res = await fetch('/api/proxy?ac=list')
    const data = await res.json()
    categoryList.value = data.class.filter(item => item.type_pid == typePid.value) || []
    updateCurrentCategoryInfo()
  } catch (e) {
    console.error('获取分类失败', e)
  }
}

// --- 核心：获取视频列表 (带分页) ---
const fetchVideos = async (page = 1) => {
  loading.value = true
  try {
    // 构造请求：t=分类ID, pg=页码
    const res = await fetch(`/api/proxy?ac=detail&t=${curTypeId.value}&pg=${page}`)
    const data = await res.json()

    videoList.value = data.list || []

    // 更新分页信息
    pagination.value = {
      page: parseInt(data.page),
      pagecount: parseInt(data.pagecount),
      total: parseInt(data.total)
    }
  } catch (e) {
    console.error('获取视频列表失败', e)
  } finally {
    loading.value = false
  }
}

// --- 辅助：根据ID找到当前分类的名字 ---
const updateCurrentCategoryInfo = () => {
  if (categoryList.value.length > 0) {
    currentCategory.value = categoryList.value.find(c => c.type_pid == typePid.value) || { type_name: '全部' }
    console.log('currentCategory.value', currentCategory.value)

    curTypeId.value = currentCategory.value.type_id || ''
  }
}

// --- 交互：翻页 ---
const changePage = (newPage) => {
  if (newPage < 1 || newPage > pagination.value.pagecount) return
  fetchVideos(newPage)
  // 翻页后滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
  // 重置滚动位置缓存
  scrollPosition.value = 0
}

// --- 交互：切换分类 ---
const changeType = (id) => {
  curTypeId.value = id
  fetchVideos(1) // 切换分类后重置回第一页
  // 重置滚动位置缓存
  scrollPosition.value = 0
}

// --- 交互：跳转详情 ---
const goToDetail = (id) => {
  // 保存当前滚动位置
  scrollPosition.value = window.scrollY
  console.log('Going to detail, saved scroll position:', scrollPosition.value)
  router.push(`/player/${id}`)
}

// --- 保存滚动位置 ---
const saveScrollPosition = () => {
  scrollPosition.value = window.scrollY
}

// --- 生命周期 ---
onMounted(async () => {
  await fetchCategories() // 先获取分类菜单
  fetchVideos(1) // 再获取第一页数据
})

onActivated(() => {
  console.log('CategoryView activated, current scroll position:', scrollPosition.value)
  // 如果已经有数据，直接恢复滚动位置
  if (videoList.value.length > 0) {
    nextTick(() => {
      if (scrollPosition.value > 0) {
        window.scrollTo(0, scrollPosition.value)
        console.log('Restored scroll position:', scrollPosition.value)
      }
    })
  }
})

onDeactivated(() => {
  console.log('CategoryView deactivated, saving scroll position:', window.scrollY)
  saveScrollPosition()
})

watch(curTypeId,
  () => {
    fetchVideos(1) // 重置回第一页
  }
)
</script>

<template>
  <div class="min-h-screen bg-[#0f1014] pb-20">
    <NavBar @change="fetchCategories" />

    <div class="pt-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <!-- 1. 头部区域：标题 + 分类筛选 -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white flex items-center gap-3 mb-6">
          <LayoutGrid class="w-8 h-8 text-purple-500" />
          {{ currentCategory.type_name || '频道' }}
          <span class="text-sm font-normal text-gray-500 mt-2">
            共 {{ pagination.total }} 部影片
          </span>
        </h1>

        <!-- 横向滚动分类条 -->
        <div class="relative group">
          <div
            ref="scrollContainer"
            @wheel.prevent="handleWheel"
            class="flex items-center gap-3 overflow-x-auto pb-4 thin-scrollbar "
          >
            <span class="flex items-center gap-1 text-sm font-bold text-gray-400 mr-2 flex-shrink-0">
              <Filter class="w-4 h-4" /> 筛选:
            </span>

            <div
              v-for="cat in categoryList"
              :key="cat.type_id"
              @click="changeType(cat.type_id)"
              class="px-4 cursor-pointer py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border"
              :class="curTypeId == cat.type_id
                ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-white'"
            >
              {{ cat.type_name }}
            </div>
          </div>
          <!-- 渐变遮罩提示可滚动 -->
          <div class="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-[#0f1014] to-transparent pointer-events-none md:hidden" />
        </div>
      </div>

      <!-- 2. 视频列表区域 -->

      <!-- Loading 骨架屏 -->
      <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
        <div v-for="i in 12" :key="i" class="animate-pulse">
          <div class="aspect-[2/3] bg-white/5 rounded-xl mb-3" />
          <div class="h-4 w-3/4 bg-white/5 rounded mb-2" />
          <div class="h-3 w-1/2 bg-white/5 rounded" />
        </div>
      </div>

      <!-- 真实数据列表 -->
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
        <VideoCard
          v-for="video in videoList"
          :key="video.vod_id"
          :video="video"
          @click="goToDetail(video.vod_id)"
        />
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && videoList.length === 0" class="py-20 text-center">
        <div class="text-6xl mb-4">
          🦖
        </div>
        <p class="text-gray-500">
          该分类下暂时没有影片
        </p>
      </div>

      <!-- 3. 分页控件 -->
      <div v-if="!loading && videoList.length > 0" class="mt-12 flex justify-center items-center gap-4">
        <!-- 上一页 -->
        <button
          @click="changePage(pagination.page - 1)"
          :disabled="pagination.page === 1"
          class="flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>

        <!-- 页码显示 -->
        <div class="flex items-center gap-2 text-sm font-medium text-gray-400">
          <span class="text-white">{{ pagination.page }}</span>
          <span class="text-gray-600">/</span>
          <span>{{ pagination.pagecount }}</span>
        </div>

        <!-- 下一页 -->
        <button
          @click="changePage(pagination.page + 1)"
          :disabled="pagination.page === pagination.pagecount"
          class="flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 1. Chrome, Edge, Safari 的自定义样式 */
.thin-scrollbar::-webkit-scrollbar {
  height: 6px; /* 这里控制粗细，6px 比较优雅 */
}
.thin-scrollbar::-webkit-scrollbar-track {
  background: transparent; /* 轨道背景透明 */
}
.thin-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 10px; /* 圆角，像胶囊一样 */
  background-color: rgb(255 255 255 / 15%); /* 滚动条颜色：半透明白 */
  transition: background-color 0.3s;
}

/* 鼠标悬停在滚动条上时变亮 */
.thin-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgb(255 255 255 / 30%);
}

/* 2. Firefox 的自定义样式 */
.thin-scrollbar {
  scrollbar-width: thin; /* 设为细 */
  scrollbar-color: rgb(255 255 255 / 15%) transparent; /* 滑块颜色 轨道颜色 */
}
</style>
