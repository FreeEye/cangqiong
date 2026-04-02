<template>
  <div class="w-100% h-100vh">
    <RouterView v-slot="{ Component, route }">
      <keep-alive>
        <component :is="Component" v-if="route.meta.keepAlive" />
      </keep-alive>
      <component :is="Component" v-if="!route.meta.keepAlive" />
    </RouterView>
  </div>
</template>
<script setup>
import { RouterView } from 'vue-router'

</script>
<style>
* {
  box-sizing: border-box;
}
html,
body,
#app {
  width: 100%;
  height: 100%;
  color: #f3f4f6;
  background-color: #0f1014;

  /* 自定义滚动条样式 */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    border-radius: 20px;
    background-color: rgb(255 255 255 / 10%);
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: rgb(255 255 255 / 20%);
  }
}
a {
  text-decoration: none;
}
input:focus-visible {
  outline: none;
}
button {
  border: none;
}
</style>
