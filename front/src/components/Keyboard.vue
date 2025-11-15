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
  min-width: 35px;
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-weight: bold;
  font-size: 0.75rem;
  cursor: default;
  transition: all 0.2s ease;
  border: 1px solid;
  user-select: none;
  pointer-events: none;
}

.key-normal {
  background: linear-gradient(
    145deg,
    rgba(31, 40, 51, 0.7) 0%,
    rgba(11, 12, 16, 0.8) 100%
  );
  color: rgba(197, 198, 199, 0.9);
  border-color: rgba(69, 162, 158, 0.6);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 3px rgba(69, 162, 158, 0.08);
  text-shadow: 0 0 2px rgba(197, 198, 199, 0.2);
}

.key-pressed {
  background: radial-gradient(
    circle,
    rgba(102, 252, 241, 0.8) 0%,
    rgba(69, 162, 158, 0.7) 50%,
    rgba(31, 40, 51, 0.6) 100%
  );
  color: #000000;
  border-color: rgba(102, 252, 241, 0.8);
  box-shadow: 0 0 10px rgba(102, 252, 241, 0.3),
    inset 0 1px 2px rgba(0, 0, 0, 0.2), 0 3px 8px rgba(69, 162, 158, 0.15);
  text-shadow: 0 0 4px rgba(11, 12, 16, 0.5);
  transform: translateY(-1px) scale(1.02);
  animation: zombieGlow 0.4s ease-in-out;
}

/* Animación para teclas presionadas */
@keyframes zombieGlow {
  0% {
    box-shadow: 0 0 3px rgba(102, 252, 241, 0.15),
      0 0 5px rgba(69, 162, 158, 0.08);
    transform: translateY(0) scale(1);
  }
  50% {
    box-shadow: 0 0 12px rgba(102, 252, 241, 0.4),
      0 0 15px rgba(69, 162, 158, 0.25), inset 0 0 8px rgba(11, 12, 16, 0.3);
    transform: translateY(-1.5px) scale(1.03);
  }
  100% {
    box-shadow: 0 0 10px rgba(102, 252, 241, 0.3),
      inset 0 1px 2px rgba(0, 0, 0, 0.2), 0 3px 8px rgba(69, 162, 158, 0.15);
    transform: translateY(-1px) scale(1.02);
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
