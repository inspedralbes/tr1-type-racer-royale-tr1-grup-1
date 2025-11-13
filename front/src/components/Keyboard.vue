<template>
  <div class="keyboard-wrapper">
    <div
      class="keyboard-row"
      v-for="(fila, index) in filesDelTeclat"
      :key="index"
    >
      <button
        v-for="lletra in fila"
        :key="lletra"
        :class="getClassKeyboard(lletra)"
        :style="getStyleKeyboard(lletra)"
        @click="handleKeyClick(lletra)"
        class="keyboard-key"
      >
        {{ lletra }}
      </button>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { socket } from "../services/socket";

const filesDelTeclat = ref([
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
]);

let teclaPremuda = ref("");
const emit = defineEmits(["key-clicked"]);
const props = defineProps({
  nickname: { type: String, default: "" },
  room: { type: String, default: "" },
});

// mapa de teclas presionadas por OTROS jugadores
const pressedKeys = ref({}); // { "A": "#ff0000", ... }

onMounted(() => {
  globalThis.addEventListener("keydown", handleKeyDown);
  globalThis.addEventListener("keyup", handleKeyUp);

  // escuchar eventos del servidor
  socket.on("userKey", ({ key, color, nickname }) => {
    console.log("Received userKey event:", { key, color, nickname });
    // si el evento viene de otro usuario, no de mí mismo
    if (nickname !== props.nickname && key) {
      const K = String(key).toUpperCase();
      pressedKeys.value[K] = color || null;

      // borrar el color después de 300ms
      setTimeout(() => {
        delete pressedKeys.value[K];
      }, 300);
    }
  });
});

onUnmounted(() => {
  globalThis.removeEventListener("keydown", handleKeyDown);
  globalThis.removeEventListener("keyup", handleKeyUp);
  socket.off("userKey");
});

function handleKeyDown(event) {
  const key = String(event.key).toUpperCase();
  if (teclaPremuda.value !== key) {
    teclaPremuda.value = key;
  }
  // emite el evento al servidor
  socket.emit("userKey", {
    room: props.room,
    nickname: props.nickname,
    key: teclaPremuda.value,
  });
}

function handleKeyUp() {
  teclaPremuda.value = "";
}

function handleKeyClick(lletra) {
  teclaPremuda.value = lletra;
  emit("key-clicked", lletra);
}

function getClassKeyboard(lletra) {
  if (lletra === teclaPremuda.value) {
    return "key-pressed"; // tu tecla presionada
  } else {
    return "key-normal"; // tecla normal
  }
}

function getStyleKeyboard(lletra) {
  const color = pressedKeys.value[lletra];
  if (color) {
    return { backgroundColor: color, color: "#000" }; // color de otros jugadores
  }
  return {};
}
</script>
<style scoped>
.keyboard-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.keyboard-row {
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.keyboard-key {
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-weight: bold;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid;
  user-select: none;
}

.key-normal {
  background-color: rgba(75, 85, 99, 0.8); /* gray-600 with transparency */
  color: #d1d5db; /* gray-300 */
  border-color: #6b7280; /* gray-500 */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.key-normal:hover {
  background-color: rgba(107, 114, 128, 0.9); /* gray-500 with transparency */
  color: #e5e7eb; /* gray-200 */
  border-color: #9ca3af; /* gray-400 */
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}

.key-pressed {
  background-color: #a3e635; /* lime-400 */
  color: #0f172a; /* slate-900 */
  border-color: #84cc16; /* lime-500 */
  box-shadow: 0 0 15px rgba(163, 230, 53, 0.6), 0 4px 8px rgba(0, 0, 0, 0.4);
  transform: translateY(-2px);
  animation: keyPulse 0.3s ease-out;
}

/* Animación para teclas presionadas */
@keyframes keyPulse {
  0% {
    box-shadow: 0 0 5px rgba(163, 230, 53, 0.3);
    transform: translateY(0);
  }
  50% {
    box-shadow: 0 0 20px rgba(163, 230, 53, 0.8);
    transform: translateY(-3px);
  }
  100% {
    box-shadow: 0 0 15px rgba(163, 230, 53, 0.6);
    transform: translateY(-2px);
  }
}

/* Efectos para teclas de otros jugadores */
.keyboard-key[style*="backgroundColor"] {
  animation: otherPlayerKey 0.3s ease-out;
  border-width: 2px;
  transform: translateY(-1px);
}

@keyframes otherPlayerKey {
  0% {
    transform: scale(1) translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  50% {
    transform: scale(1.1) translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.5);
  }
  100% {
    transform: scale(1) translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  }
}

/* Responsive design */
@media (max-width: 640px) {
  .keyboard-key {
    min-width: 35px;
    height: 35px;
    font-size: 0.8rem;
  }

  .keyboard-row {
    gap: 4px;
  }

  .keyboard-wrapper {
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .keyboard-key {
    min-width: 30px;
    height: 30px;
    font-size: 0.75rem;
  }

  .keyboard-row {
    gap: 3px;
  }
}
</style>
