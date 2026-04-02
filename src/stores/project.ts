import { defineStore } from 'pinia'

const useProjectStore = defineStore({
  id: 'project',
  state: () => ({
    projectId: '',
    menuList: []
  }),
  actions: {

  },
  persist: {
    enabled: true,
    strategies: [{
      storage: window.sessionStorage
    }]
  }
})

export default useProjectStore
