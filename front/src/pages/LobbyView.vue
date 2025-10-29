<template>
  <section style="padding:1.5rem;">
    <h2 style="font-size:1.5rem;font-weight:600;">Lobby / Play</h2>
    <p style="margin-top:.5rem;">Welcome, <strong>{{ user.nickname }}</strong>!</p>

    <!-- Attention dear compañeros, you all can add socket.io lobby join here later -->
    <div style="margin-top:1rem;">
      <button @click="logout" style="border:1px solid #D1D5DB;padding:.5rem .75rem;border-radius:.5rem;">
        Change nickname
      </button>
    </div>
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const user = useUserStore()

function logout() {
  user.clearNickname()
  router.push({ name: 'home' })
}
</script>