<script setup>
import { ref, onMounted } from 'vue'
import { isAdSlotEnabled, recordImpression, adSlots } from '@/utils/ads'

const props = defineProps({
  slotId: { type: String, required: true },
  type: { type: String, default: 'banner' },
  className: { type: String, default: '' }
})

const showAd = ref(false)
const slotConfig = ref(null)

onMounted(() => {
  slotConfig.value = adSlots.find(s => s.id === props.slotId)
  showAd.value = isAdSlotEnabled(props.slotId)

  if (showAd.value) {
    recordImpression(props.slotId)

    // 本地开发环境显示模拟广告
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return
    }

    // 生产环境加载 AdSense
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) { /* ignore */ }
  }
})
</script>

<template>
  <div v-if="showAd && slotConfig" :class="['ad-slot', `ad-${type}`, className]">
    <!-- 生产环境 AdSense -->
    <template v-if="window?.location?.hostname !== 'localhost'">
      <ins class="adsbygoogle"
        :data-ad-client="slotConfig.adClient"
        :data-ad-slot="slotConfig.adSlot"
        :data-ad-format="slotConfig.format"
        :style="{ width: slotConfig.width + 'px', height: slotConfig.height + 'px', display: 'block' }"
        data-ad-region="page"
        data-full-width-responsive="true" />
    </template>

    <!-- 本地开发模拟广告 -->
    <template v-else>
      <div class="ad-placeholder rounded-xl border border-dashed border-gray-600 bg-gray-800/30 flex flex-col items-center justify-center text-center p-3"
        :style="{ minWidth: slotConfig.width > 100 ? '250px' : 'auto', minHeight: Math.min(slotConfig.height, 120) + 'px' }">
        <div class="text-xs text-gray-500 mb-1">广告位</div>
        <div class="text-[10px] text-gray-600">{{ slotConfig.name }}</div>
        <div class="text-[10px] text-orange-500/60 mt-1">AdSense · {{ slotConfig.width }}×{{ slotConfig.height }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ad-placeholder {
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 8px,
    rgba(255,255,255,0.01) 8px,
    rgba(255,255,255,0.01) 16px
  );
}
</style>
