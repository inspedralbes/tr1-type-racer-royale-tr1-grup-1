<template>
  <main class="min-h-screen grid place-items-center p-6">
    <div class="w-full max-w-sm space-y-4">
      <!-- for now here are vibecoded Tailwind classes, you can change those for yours later-->
      <h1 class="text-3xl font-bold text-center">
        Giga Racer Royale Pro Max Deluxe
      </h1>

      <p
        v-if="route.query.needNick"
        class="rounded-md"
        style="
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.5rem 0.75rem;
          font-size: 0.9rem;
        "
      >
        Please enter a nickname before joining.
      </p>

      <label class="block">
        <span style="font-size: 0.9rem; color: #374151">Nickname</span>
        <input
          v-model.trim="nick"
          type="text"
          placeholder="Your nickname"
          @keyup.enter="join"
          autofocus
          style="
            margin-top: 0.25rem;
            width: 100%;
            border: 1px solid #d1d5db;
            border-radius: 0.5rem;
            padding: 0.5rem 0.75rem;
          "
        />
      </label>

      <button
        :disabled="!nick"
        @click="join"
        style="
          width: 100%;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: white;
          background: #2563eb;
          opacity: 1;
        "
        :style="!nick ? 'opacity:.5;cursor:not-allowed;' : ''"
      >
        Join
      </button>
    </div>
  </main>
</template>

<script setup>
import { ref, watchEffect } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useUserStore } from "@/stores/user";

const router = useRouter();
const route = useRoute();
const user = useUserStore();

const nick = ref(user.nickname);

// Clear the banner once the user types
watchEffect(() => {
  if (route.query.needNick && nick.value) {
    router.replace({ query: {} });
  }
});

function join() {
  if (!nick.value?.trim()) return;
  user.setNickname(nick.value);

  // go back where they intended, else /lobby
  const redirectTo = route.query.redirectTo || '/lobby';
  router.push(redirectTo)
}
</script>