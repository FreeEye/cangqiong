<script setup>
import { useRoute, useRouter } from 'vue-router'
import { Search, Clapperboard, Menu, X, Clock, User } from 'lucide-vue-next' // 引入 Menu 和 X 图标
import { ref, watch, onMounted, onUnmounted } from 'vue'
import useProjectStore from '@/stores/project'

const router = useRouter()
const route = useRoute()

// 菜单配置

const project = useProjectStore()

const fetchCategories = async () => {
  try {
    if (project.menuList.length > 1) return
    const res = await fetch('/api/proxy?ac=list')
    const data = await res.json()
    const cData = data.class.filter(item => item.type_pid == 0) || []
    // 自定义过滤名称
    const diyName = ['电影解说', '体育']
    const filterData = cData.filter(item => !diyName.includes(item.type_name)) || []
    console.log('data', filterData)
    project.menuList = [{ name: '首页', path: '/home' }, ...filterData.map(item => ({
      name: item.type_name,
      path: `/category/${item.type_id}`,
      key: item.type_id
    }))]
  } catch (e) {
    console.error('获取分类失败', e)
  }
}
fetchCategories()
// 状态：移动端菜单是否打开
const isMobileMenuOpen = ref(false)
const searchKeyword = ref('')
const searchHistory = ref([]) // 搜索历史记录
const showHistory = ref(false) // 是否显示历史记录
const showMobileHistory = ref(false) // 是否显示移动端历史记录

// 为搜索框和历史记录容器添加ref
const searchContainer = ref(null)
const mobileSearchContainer = ref(null)

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
const searchFromHistory = (keyword, isMobile = false) => {
  searchKeyword.value = keyword
  handleSearch()
  if (isMobile) {
    showMobileHistory.value = false
  } else {
    showHistory.value = false
  }
}

// 切换移动端菜单
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

// 搜索逻辑
const handleSearch = () => {
  if (!searchKeyword.value.trim()) return
  router.push({ path: '/search', query: { q: searchKeyword.value } })
  isMobileMenuOpen.value = false // 搜索后关闭菜单
  showHistory.value = false // 搜索后关闭历史记录
  showMobileHistory.value = false // 搜索后关闭移动端历史记录

  // 添加到搜索历史
  addToHistory(searchKeyword.value)
}

const gobackHome = () => {
  router.push('/')
  isMobileMenuOpen.value = false
}

// 跳转个人观看历史页面
const toHistoryView = () => {
  router.push('/history')
}

const emit = defineEmits(['change'])

const changeType = (path) => {
  emit('change', path)
  isMobileMenuOpen.value = false // 点击链接后关闭菜单
}

// 判断激活状态
const isActive = (path) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

// 组件挂载时加载搜索历史
loadSearchHistory()

// 点击外部关闭搜索历史记录
onMounted(() => {
  const handleClickOutside = (event) => {
    // 关闭PC端搜索历史
    if (showHistory.value && searchContainer.value && !searchContainer.value.contains(event.target)) {
      showHistory.value = false
    }

    // 关闭移动端搜索历史
    if (showMobileHistory.value && mobileSearchContainer.value && !mobileSearchContainer.value.contains(event.target)) {
      showMobileHistory.value = false
    }
  }

  // 添加全局点击事件监听
  document.addEventListener('click', handleClickOutside)

  // 组件卸载时移除监听
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
})

// 监听路由变化，自动关闭移动端菜单（防止跳转后菜单还开着）
watch(() => route.path, () => {
  isMobileMenuOpen.value = false
})
</script>

<template>
  <nav class="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0f1014]/80 backdrop-blur-xl transition-all duration-300">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <!-- 1. Logo -->
      <div @click="gobackHome" class="flex items-center gap-2 cursor-pointer group z-50">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-500/20 transition-transform group-hover:scale-110">
          <Clapperboard class="h-5 w-5 text-white" />
        </div>
        <span class="text-xl font-bold tracking-tight text-white group-hover:text-purple-100 transition-colors">
          Movie<span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Hub</span>
        </span>
      </div>

      <!-- 2. PC端 菜单 (大屏显示) -->
      <div class="hidden md:flex items-center gap-2">
        <router-link
          v-for="item in project.menuList"
          :key="item.path"
          :to="item.path"
          @click="changeType(item.key || '')"
          class="relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-full group"
          :class="isActive(item.path) ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'"
        >
          {{ item.name }}
          <!-- 选中/Hover 效果 -->
          <span v-if="isActive(item.path)" class="absolute bottom-0 left-20% border-rd-8px h-1 right-20%  bg-purple-500 shadow-[0_0_8px_2px_rgba(168,85,247,0.8)]" />
          <span v-else class="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gray-500 opacity-0 transition-opacity group-hover:opacity-100" />
        </router-link>
      </div>
      <div class="flex items-center gap-4">
        <!-- 3. PC端 右侧工具 (搜索框) -->
        <div class="hidden md:flex items-center gap-4">
          <div ref="searchContainer" class="relative group">
            <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-purple-400" />
            <input
              v-model="searchKeyword"
              @keyup.enter="handleSearch"
              @focus="showHistory = true"
              type="text"
              placeholder="搜索影片..."
              class="h-9 w-64 rounded-full border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-gray-200 transition-all duration-300 focus:w-72 focus:border-purple-500/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/20 placeholder-gray-600"
            >

            <!-- PC端搜索历史记录 -->
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
        </div>

        <!-- 4. 移动端 汉堡菜单按钮 (小屏显示) -->
        <div class="flex md:hidden items-center">
          <button
            @click="toggleMobileMenu"
            class="group relative flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-gray-300 transition-all duration-200 hover:bg-white/10 hover:text-white hover:border-purple-500/30 active:scale-95"
            :class="isMobileMenuOpen ? 'bg-purple-600/20 text-purple-400 border-purple-500/50' : ''"
          >
            <!-- 图标容器，为了加动画 -->
            <div class="relative w-6 h-6">
              <!-- 关闭图标 (当菜单打开时显示) -->
              <X
                class="absolute inset-0 w-6 h-6 transition-all duration-300 transform"
                :class="isMobileMenuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'"
              />

              <!-- 菜单图标 (当菜单关闭时显示) -->
              <Menu
                class="absolute inset-0 w-6 h-6 transition-all duration-300 transform"
                :class="isMobileMenuOpen ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'"
              />
            </div>
          </button>
        </div>
        <!-- 个人观看历史 -->
        <div @click="toHistoryView" class="cursor-pointer flex items-center justify-center w-9 h-9 rounded-full bg-[#1a1b21] text-gray-400 hover:text-white hover:bg-[#25262c] transition-all duration-300">
          <User class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- 5. 移动端 下拉菜单面板 -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-show="isMobileMenuOpen"
        class="md:hidden absolute top-16 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-xl border-b border-white/5 px-4 py-6 shadow-2xl flex flex-col gap-6"
      >
        <!-- 移动端搜索框 -->
        <div ref="mobileSearchContainer" class="relative">
          <Search class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input
            v-model="searchKeyword"
            @keyup.enter="handleSearch"
            @focus="showMobileHistory = true"
            type="text"
            placeholder="搜索影片..."
            class="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-base text-white focus:border-purple-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >

          <!-- 移动端搜索历史记录 -->
          <div v-if="showMobileHistory && searchHistory.length > 0" class="absolute left-0 right-0 mt-2 bg-[#15161c] rounded-xl shadow-2xl overflow-hidden z-10">
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
                @click="searchFromHistory(item, true)"
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

        <!-- 移动端导航链接 -->
        <div class="flex flex-col space-y-2">
          <router-link
            v-for="item in project.menuList"
            :key="item.path"
            :to="item.path"
            @click="changeType(item.key || '')"
            class="flex items-center px-4 py-3 rounded-xl text-base font-medium transition-all"
            :class="isActive(item.path)
              ? 'bg-purple-600/10 text-purple-400 border border-purple-600/20'
              : 'text-gray-400 hover:bg-white/5 hover:text-white'"
          >
            {{ item.name }}
          </router-link>
        </div>
      </div>
    </transition>
  </nav>
</template>
