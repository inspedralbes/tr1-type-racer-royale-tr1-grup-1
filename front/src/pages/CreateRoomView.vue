<template>
  <div style="max-width: 500px; margin: 2rem auto; padding: 1.5rem">
    <h2
      style="
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 1rem;
        text-align: center;
      "
    >
      Crear Nueva Sala
    </h2>

    <form @submit.prevent="onSubmit" class="create-room">
      <div>
        <label for="roomName">Nombre de la sala</label>
        <input
          id="roomName"
          v-model="roomName"
          type="text"
          required
          placeholder="Ej: Sala de Velocistas"
        />
      </div>

      <div>
        <label for="language">Idioma</label>
        <select id="language" v-model="language" required>
          <option disabled value="">Selecciona...</option>
          <option v-for="lang in languages" :key="lang" :value="lang">
            {{
              lang === "es" ? "Español" : lang === "ca" ? "Catalán" : "Inglés"
            }}
          </option>
        </select>
      </div>

      <div>
        <label for="difficulty">Dificultad</label>
        <select id="difficulty" v-model="difficulty" required>
          <option disabled value="">Selecciona...</option>
          <option v-for="d in difficulties" :key="d" :value="d">
            {{
              d === "facil"
                ? "Fácil"
                : d === "intermig"
                ? "Intermedio"
                : "Difícil"
            }}
          </option>
        </select>
      </div>

      <div>
        <label for="userName">Tu nombre</label>
        <input
          id="userName"
          v-model="userName"
          type="text"
          required
          placeholder="Introduce tu nombre"
        />
        <small
          style="
            color: #6b7280;
            font-size: 0.8rem;
            margin-top: 0.25rem;
            display: block;
          "
        >
          {{
            userStore.hasNick
              ? "Puedes cambiar tu nombre si quieres"
              : "Este será tu nombre en la sala"
          }}
        </small>
      </div>

      <div style="margin-top: 1rem">
        <button
          type="submit"
          :disabled="!isValid || sending"
          :style="{
            backgroundColor: !isValid || sending ? '#9ca3af' : '#2563eb',
            cursor: !isValid || sending ? 'not-allowed' : 'pointer',
          }"
        >
          {{ sending ? "Creando..." : "Crear Sala" }}
        </button>
      </div>

      <div style="margin-top: 1rem; text-align: center">
        <button
          type="button"
          @click="router.push('/')"
          style="
            background: none;
            border: 1px solid #d1d5db;
            color: #6b7280;
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            cursor: pointer;
          "
        >
          Volver al inicio
        </button>
      </div>

      <p v-if="error" class="error" style="margin-top: 1rem">{{ error }}</p>
      <p v-if="success" class="success" style="margin-top: 1rem">
        {{ success }}
      </p>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { socket } from "@/services/socket";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";

const router = useRouter();
const userStore = useUserStore();

const languages = ["es", "ca", "en"];
const languagesSet = new Set(languages);
const difficulties = ["facil", "intermig", "dificil"];
const difficultiesSet = new Set(difficulties);

const roomName = ref("");
const language = ref("");
const difficulty = ref("");
const userName = ref("");
const error = ref("");
const success = ref("");
const sending = ref(false);

// Inicializar el nombre del usuario con el nickname existente
onMounted(() => {
  if (userStore.hasNick) {
    userName.value = userStore.nickname;
  }
});

const isValid = computed(() => {
  return (
    roomName.value.trim() &&
    userName.value.trim() &&
    languagesSet.has(language.value) &&
    difficultiesSet.has(difficulty.value)
  );
});

function onSubmit() {
  if (!isValid.value) {
    error.value = "Rellena todos los campos correctamente.";
    return;
  }

  sending.value = true;
  error.value = "";
  success.value = "";

  // Actualizar el nickname del usuario si ha cambiado
  if (userName.value.trim() !== userStore.nickname) {
    userStore.setNickname(userName.value.trim());
  }

  let difficultyValue = difficulty.value;
  if (difficulty.value === "facil") {
    difficultyValue = 1;
  } else if (difficulty.value === "intermig") {
    difficultyValue = 2;
  } else if (difficulty.value === "dificil") {
    difficultyValue = 3;
  }

  const payload = {
    roomName: roomName.value.trim(),
    language: language.value,
    difficulty: difficultyValue,
    userName: userName.value.trim(),
  };

  console.log("🚀 Creando room con datos:", payload);

  // Emitir evento 'createRoom'
  socket.emit("createRoom", payload);

  socket.once("roomCreated", (data) => {
    console.log("✅ Room creada con éxito:", data);
    success.value = `Sala "${payload.roomName}" creada exitosamente`;

    // Navegar al lobby
    setTimeout(() => {
      router.push("/lobby");
    }, 1000);
  });

  socket.once("roomNotCreated", (data) => {
    console.log("❌ Error al crear room:", data);
    error.value =
      data.message === "Existent ROOM"
        ? "Ya existe una sala con ese nombre"
        : "Error al crear la sala";
    sending.value = false;
  });
}
</script>

<style scoped>
.create-room {
  max-width: 420px;
  display: grid;
  gap: 8px;
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
}

input,
select,
button {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
}

.error {
  color: #a00;
}

.success {
  color: #080;
}
</style>
