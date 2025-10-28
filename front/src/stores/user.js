import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    nickname: localStorage.getItem('nickname') || ''
  }),
  getters: {
    hasNick: (state) => state.nickname.trim().length > 0
  },
  actions: {
    setNickname(name) {
      this.nickname = name.trim()
      localStorage.setItem('nickname', this.nickname)
    },
    clearNickname() {
      this.nickname = ''
      localStorage.removeItem('nickname')
    }
  }
})