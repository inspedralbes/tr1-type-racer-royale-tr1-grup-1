<template>
  <main class="min-h-screen grid place-items-center p-6">
    <div class="w-full max-w-sm space-y-4"> <!-- for now here are vibecoded Tailwind classes, you can change those for yours later-->
      <h1 class="text-3xl font-bold text-center">Giga Racer Royale Pro Max Deluxe</h1>

      <p
        v-if="route.query.needNick"
        class="rounded-md"
        style="background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;padding:.5rem .75rem;font-size:.9rem;"
      >
        Please enter a nickname before joining.
      </p>

      <label class="block">
        <span style="font-size:.9rem;color:#374151;">Nickname</span>
        <input
          v-model.trim="nick"
          type="text"
          placeholder="Your nickname"
          @keyup.enter="join"
          autofocus
          style="margin-top:.25rem;width:100%;border:1px solid #D1D5DB;border-radius:.5rem;padding:.5rem .75rem;"
        />
      </label>

      <button
        :disabled="!nick"
        @click="join"
        style="width:100%;border-radius:.5rem;padding:.5rem .75rem;color:white;background:#2563EB;opacity:1;"
        :style="!nick ? 'opacity:.5;cursor:not-allowed;' : ''"
      >
        Join
      </button>
    </div>
  </main>
</template>

<script setup>
import { ref, watchEffect } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const user = useUserStore()

const nick = ref(user.nickname)

// Clear the banner once the user types
watchEffect(() => {
  if (route.query.needNick && nick.value) {
    router.replace({ query: {} })
  }
})

function join() {
  if (!nick.value?.trim()) return
  user.setNickname(nick.value)

  // go back where they intended, else /play
  const redirectTo = route.query.redirectTo || '/play'
  router.push(redirectTo)
}
</script>