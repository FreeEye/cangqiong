<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Shield, User, Lock, ArrowRight } from 'lucide-vue-next'

const router = useRouter()
const username = ref('')
const password = ref('')
const errorMsg = ref('')
const isLoading = ref(false)

// 滑块验证码相关
const sliderVerified = ref(false)
const sliderValue = ref(0)
const isDragging = ref(false)
const sliderRef = ref(null)
const startX = ref(0)
const currentX = ref(0)

const handleLogin = async () => {
  if (!username.value || !password.value) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  
  if (!sliderVerified.value) {
    errorMsg.value = '请完成滑块验证'
    return
  }
  
  isLoading.value = true
  errorMsg.value = ''
  
  // 模拟登录验证
  setTimeout(() => {
    if (username.value === 'cangqiong' && password.value === 'cangqiong@2026') {
      // 登录成功，保存token
      localStorage.setItem('admin_token', 'cangqiong_admin_' + Date.now())
      localStorage.setItem('admin_user', JSON.stringify({
        username: username.value,
        loginTime: new Date().toLocaleString('zh-CN')
      }))
      router.push('/admin/dashboard')
    } else {
      errorMsg.value = '用户名或密码错误'
      sliderVerified.value = false
      sliderValue.value = 0
    }
    isLoading.value = false
  }, 1000)
}

// 滑块验证逻辑
const startDrag = (e) => {
  if (sliderVerified.value) return
  isDragging.value = true
  startX.value = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
}

const onDrag = (e) => {
  if (!isDragging.value || sliderVerified.value) return
  
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
  const deltaX = clientX - startX.value
  const sliderWidth = sliderRef.value?.offsetWidth - 50 || 250
  
  currentX.value = Math.max(0, Math.min(deltaX, sliderWidth))
  sliderValue.value = (currentX.value / sliderWidth) * 100
}

const endDrag = () => {
  if (!isDragging.value) return
  isDragging.value = false
  
  const sliderWidth = sliderRef.value?.offsetWidth - 50 || 250
  const threshold = 85 // 验证阈值
  
  if (sliderValue.value >= threshold) {
    sliderVerified.value = true
    sliderValue.value = 100
    errorMsg.value = ''
  } else {
    sliderValue.value = 0
    currentX.value = 0
  }
}

onMounted(() => {
  // 检查是否已登录
  const token = localStorage.getItem('admin_token')
  if (token) {
    router.push('/admin/dashboard')
  }
  
  // 添加全局事件监听
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('touchmove', onDrag)
  document.addEventListener('touchend', endDrag)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
    <!-- 背景装饰 -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-pulse" />
      <div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;" />
    </div>
    
    <!-- 登录卡片 -->
    <div class="relative w-full max-w-md">
      <div class="absolute -inset-1 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl blur opacity-30"></div>
      
      <div class="relative bg-[#1a1b23] rounded-2xl p-8 border border-white/10 shadow-2xl">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 mb-4 shadow-lg shadow-orange-500/30">
            <Shield class="w-8 h-8 text-white" />
          </div>
          <h1 class="text-2xl font-black text-white">苍穹管理后台</h1>
          <p class="text-gray-400 text-sm mt-2">视频数据统计与管理系统</p>
        </div>
        
        <!-- 错误提示 -->
        <div v-if="errorMsg" class="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm text-center">
          {{ errorMsg }}
        </div>
        
        <!-- 用户名输入 -->
        <div class="mb-4">
          <label class="block text-gray-300 text-sm font-medium mb-2">用户名</label>
          <div class="relative">
            <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              v-model="username"
              type="text"
              placeholder="请输入用户名"
              class="w-full bg-[#0f1014] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
              @keyup.enter="handleLogin"
            />
          </div>
        </div>
        
        <!-- 密码输入 -->
        <div class="mb-6">
          <label class="block text-gray-300 text-sm font-medium mb-2">密码</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              v-model="password"
              type="password"
              placeholder="请输入密码"
              class="w-full bg-[#0f1014] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
              @keyup.enter="handleLogin"
            />
          </div>
        </div>
        
        <!-- 滑块验证码 -->
        <div class="mb-6">
          <label class="block text-gray-300 text-sm font-medium mb-2">滑块验证</label>
          <div
            ref="sliderRef"
            class="relative h-12 bg-[#0f1014] rounded-xl border border-white/10 overflow-hidden select-none"
          >
            <!-- 背景文字 -->
            <div class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
              <span v-if="!sliderVerified">请拖动滑块完成验证</span>
              <span v-else class="text-green-400 font-medium">验证通过</span>
            </div>
            
            <!-- 进度条 -->
            <div
              class="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-500/30 to-red-500/30 transition-all duration-100"
              :style="{ width: sliderValue + '%' }"
            />
            
            <!-- 滑块 -->
            <div
              class="absolute top-1 h-10 w-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg cursor-pointer flex items-center justify-center shadow-lg transition-all duration-100"
              :class="{ 'cursor-default': sliderVerified }"
              :style="{ left: `calc(${sliderValue}% - ${sliderValue * 0.12}px)` }"
              @mousedown="startDrag"
              @touchstart="startDrag"
            >
              <ArrowRight v-if="!sliderVerified" class="w-5 h-5 text-white" />
              <svg v-else class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
        
        <!-- 登录按钮 -->
        <button
          @click="handleLogin"
          :disabled="isLoading"
          class="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white font-bold text-lg transition-all hover:shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg v-if="isLoading" class="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{{ isLoading ? '登录中...' : '登录' }}</span>
        </button>
        
        <!-- 返回首页 -->
        <div class="mt-6 text-center">
          <router-link to="/home" class="text-gray-400 hover:text-orange-400 text-sm transition-colors">
            ← 返回首页
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
