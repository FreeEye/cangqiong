<script setup>
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import Artplayer from 'artplayer'
import Hls from 'hls.js'

const props = defineProps({
  url: {
    type: String,
    required: true
  },
  poster: {
    type: String,
    default: ''
  }
})

const artRef = ref(null)
let instance = null

// --- 1. 新版图标：双箭头风格 (仿照你发的图片) ---
// 特点：fill="none" (空心), stroke="white" (白色描边), stroke-width="2.5" (加粗)

// 后退图标 (向左的双箭头)
const rewindIconSvg = `
  <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 36px; height: 36px; display: block;">
    <polygon points="11 19 2 12 11 5 11 19"></polygon>
    <polygon points="22 19 13 12 22 5 22 19"></polygon>
  </svg>
`

// 快进图标 (向右的双箭头 - 即你发的图片样式)
const forwardIconSvg = `
  <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 36px; height: 36px; display: block;">
    <polygon points="13 19 22 12 13 5 13 19"></polygon>
    <polygon points="2 19 11 12 2 5 2 19"></polygon>
  </svg>
`

const initArtplayer = () => {
  if (!props.url) return

  if (instance) {
    instance.destroy(false)
  }

  instance = new Artplayer({
    container: artRef.value,
    url: props.url,
    poster: props.poster,
    volume: 0.5,
    isLive: false,
    muted: false,
    autoplay: false,
    autoSize: true,
    screenshot: true, // 截图功能
    setting: true, // 设置面板
    loop: false,
    flip: true, // 画面翻转
    playbackRate: true, // 倍速播放
    aspectRatio: true, // 画面比例
    fullscreen: true, // 全屏
    fullscreenWeb: true, // 网页全屏
    subtitleOffset: true,
    mutex: true,
    backdrop: true,
    playsInline: true,
    autoPlayback: true,
    airplay: true,
    theme: '#9333ea',
    layers: [
      {
        name: 'rewind-btn',
        html: rewindIconSvg,
        style: {
          position: 'absolute',
          top: '50%',
          left: '50%',
          // 距离中心向左偏移 100px
          transform: 'translate(calc(-50% - 100px), -50%)',
          zIndex: 50
        },
        // 点击逻辑：必须用 function(layer) { this... }
        click: function (layer, event) {
          this.seek = Math.max(0, this.currentTime - 10)

          if (this.notice) {
            this.notice.show = '后退 10s'
          }
          if (event) event.stopPropagation()
        }
      },
      {
        name: 'forward-btn',
        html: forwardIconSvg,
        style: {
          position: 'absolute',
          top: '50%',
          left: '50%',
          // 距离中心向右偏移 100px
          transform: 'translate(calc(-50% + 100px), -50%)',
          zIndex: 50
        },
        click: function (layer, event) {
          this.seek = Math.min(this.duration, this.currentTime + 10)

          if (this.notice) {
            this.notice.show = '快进 10s'
          }
          if (event) event.stopPropagation()
        }
      }
    ],

    customType: {
      m3u8: function (video, url, art) {
        if (Hls.isSupported()) {
          if (art.hls) art.hls.destroy()
          const hls = new Hls()
          hls.loadSource(url)
          hls.attachMedia(video)
          art.hls = hls
          art.on('destroy', () => hls.destroy())
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url
        } else {
          if (art.notice) art.notice.show = '不支持播放格式：m3u8'
        }
      }
    }
  })
}

onMounted(() => {
  nextTick(() => {
    initArtplayer()
  })
})

watch(() => props.url, (newUrl) => {
  if (newUrl) {
    if (instance) {
      instance.switchUrl(newUrl)
      instance.play()
    } else {
      initArtplayer()
    }
  }
})

onBeforeUnmount(() => {
  if (instance && instance.destroy) {
    instance.destroy(false)
  }
})
</script>

<template>
  <div ref="artRef" class="artplayer-app" />
</template>

<style scoped>
.artplayer-app {
  width: 100%;
  height: 100%;
}

/* --- 样式部分 --- */

/* 1. 基础按钮样式：默认隐藏，圆形磨砂背景 */
:deep(.art-layer-rewind-btn),
:deep(.art-layer-forward-btn) {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 70px !important; /* 稍微加大一点尺寸以容纳双箭头 */
  height: 70px !important;
  border-radius: 50%;

  /* 半透明黑色背景 + 模糊 = 高级感 */
  background: rgb(0 0 0 / 50%);
  opacity: 0;
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: none;
  backdrop-filter: blur(4px);
  flex-direction: column;
  cursor: pointer;

  /* 初始缩小状态 */
  transform: translate(calc(-50% - 100px), -50%) scale(0.9);
}
:deep(.art-layer-forward-btn) {
  transform: translate(calc(-50% + 100px), -50%) scale(0.9);
}

/* 2. 显示状态 (art-hover) */
:deep(.art-hover .art-layer-rewind-btn),
:deep(.art-hover .art-layer-forward-btn) {
  opacity: 1;
  pointer-events: auto;
  transform: translate(calc(-50% - 100px), -50%) scale(1);
}
:deep(.art-hover .art-layer-forward-btn) {
  transform: translate(calc(-50% + 100px), -50%) scale(1);
}

/* 3. 鼠标悬停高亮 */
:deep(.art-layer-rewind-btn:hover),
:deep(.art-layer-forward-btn:hover) {
  background: rgb(0 0 0 / 70%);
  transform: translate(calc(-50% - 100px), -50%) scale(1.1) !important;
}
:deep(.art-layer-forward-btn:hover) {
  transform: translate(calc(-50% + 100px), -50%) scale(1.1) !important;
}

/* 移动端适配 */
@media (max-width: 768px) {
  :deep(.art-layer-rewind-btn),
  :deep(.art-layer-forward-btn) {
    width: 50px !important;
    height: 50px !important;
  }

  /* 图标在手机上缩小一点 */
  :deep(.art-layer-rewind-btn svg),
  :deep(.art-layer-forward-btn svg) {
    width: 24px !important;
    height: 24px !important;
  }
  :deep(.art-hover .art-layer-rewind-btn) {
    transform: translate(calc(-50% - 70px), -50%);
  }
  :deep(.art-hover .art-layer-forward-btn) {
    transform: translate(calc(-50% + 70px), -50%);
  }
}
</style>
