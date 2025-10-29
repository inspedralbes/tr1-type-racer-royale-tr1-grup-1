<template>
  <main class="p-8">
    <h1 class="text-2xl font-bold mb-4">Typing Test</h1>

    <div v-if="currentText" class="p-4 bg-gray-100 rounded-lg">
      <h2 class="font-semibold mb-2">{{ currentText.title }}</h2>
      <p class="text-gray-700 whitespace-pre-wrap">{{ currentText.text }}</p>
    </div>

    <button
      class="mt-4 bg-blue-500 text-white py-2 px-4 rounded"
      @click="nextText"
    >
      Load Random Text
    </button>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import typingTexts from '@/data/typingTexts.json'

const currentText = ref(null)

function nextText() {
  const randomIndex = Math.floor(Math.random() * typingTexts.length)
  currentText.value = typingTexts[randomIndex]
}

// Load one immediately
nextText()
</script>