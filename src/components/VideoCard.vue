<script setup>
import { Play, Star, Eye, Flame } from 'lucide-vue-next'

defineProps({
  video: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="group relative flex flex-col gap-3 cursor-pointer">
    <div class="relative aspect-[2/3] overflow-hidden rounded-3xl bg-slate-900 shadow-2xl transition-all duration-700 group-hover:shadow-[0_25px_50px_rgba(0,0,0,0.5)] group-hover:-translate-y-4 border border-white/5">
      <img
        :src="video.vod_pic"
        :alt="video.vod_name"
        class="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-125"
        loading="lazy"
      >

      <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-95" />

      <div class="absolute top-3.5 right-3.5 rounded-2xl bg-gradient-to-r from-orange-500/95 to-red-500/95 px-3.5 py-2 text-xs font-black text-white backdrop-blur-xl shadow-lg shadow-orange-500/40 flex items-center gap-1.5">
        <Flame class="w-3.5 h-3.5 fill-yellow-300" />
        {{ video.vod_remarks || '更新中' }}
      </div>

      <div v-if="video.vod_hits" class="absolute top-3.5 left-3.5 rounded-2xl bg-black/70 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-xl flex items-center gap-1.5 border border-white/10">
        <Eye class="w-3.5 h-3.5 text-cyan-400" />
        {{ (video.vod_hits / 1000).toFixed(1) }}k
      </div>

      <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
        <div v-if="video.vod_actor" class="text-xs text-gray-300 line-clamp-2 mb-2">
          {{ video.vod_actor }}
        </div>
      </div>

      <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-100 scale-75">
        <div class="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white shadow-[0_0_40px_rgba(249,115,22,0.7)] group-hover:scale-125 transition-all duration-500 border-4 border-white/30">
          <Play class="h-10 w-10 fill-current ml-1.5" />
        </div>
      </div>
    </div>

    <div class="space-y-2 px-1">
      <div class="flex items-start gap-2">
        <h3 class="line-clamp-2 text-sm font-black text-white group-hover:text-orange-400 transition-colors leading-tight flex-1">
          {{ video.vod_name }}
        </h3>
        <span v-if="video._source" class="text-xs font-semibold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
          {{ video._source }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-gray-500">
            {{ video.vod_year }}
          </span>
          <span class="text-gray-700">·</span>
          <span class="text-xs font-semibold text-gray-500">
            {{ video.vod_area }}
          </span>
        </div>
        <div v-if="video.vod_hits" class="flex items-center gap-1">
          <Star class="w-3 h-3 text-yellow-400 fill-yellow-400" />
        </div>
      </div>
    </div>
  </div>
</template>
