<template>
  <section
    class="relative min-h-screen flex flex-col items-center justify-center font-dogica text-gray-200 bg-gradient-to-b from-[#0B0C10] to-[#1F2833] overflow-hidden"
  >
    <!-- Fondo -->
    <img
      src="/src/assets/opt2_img1.png"
      alt="Zombie sky background"
      class="absolute inset-0 w-full h-full object-cover opacity-80"
    />
    <div class="absolute inset-0 bg-black/40"></div>
    <div class="bg-fog absolute inset-0 z-10 pointer-events-none"></div>

    <!-- Panel central con animación de entrada -->
    <div
      class="relative z-20 w-full max-w-md bg-black/50 border border-lime-400 rounded-xl shadow-[0_0_20px_#66FCF1] p-6 space-y-6 animate-fadeIn"
    >
      <!-- Título con efecto flicker -->
      <h2
        class="text-3xl text-center text-lime-400 tracking-widest drop-shadow-[0_0_15px_#66FCF1]"
      >
        Crear Nova Sala
      </h2>

      <!-- Formulario -->
      <form @submit.prevent="onSubmit" class="space-y-4">
        <!-- Nombre sala -->
        <div class="animate-fadeItem delay-[100ms]">
          <label class="text-lime-300 text-sm uppercase tracking-wider"
            >Nom de la sala</label
          >
          <input
            id="roomName"
            v-model="roomName"
            type="text"
            required
            placeholder="Ex: Sala de Velocistes"
            class="w-full bg-gray-900/60 border border-lime-400 rounded-md px-3 py-2 text-lime-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
        </div>

        <!-- Idioma -->
        <div class="animate-fadeItem delay-[200ms]">
          <label class="text-lime-300 text-sm uppercase tracking-wider"
            >Idioma</label
          >
          <select
            id="language"
            v-model="language"
            required
            class="w-full bg-gray-900/60 border border-lime-400 rounded-md px-3 py-2 text-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option disabled value="">Selecciona...</option>
            <option v-for="lang in languages" :key="lang" :value="lang">
              {{
                lang === "es" ? "Espanyol" : lang === "ca" ? "Català" : "Anglès"
              }}
            </option>
          </select>
        </div>

        <!-- Dificultad -->
        <div class="animate-fadeItem delay-[300ms]">
          <label class="text-lime-300 text-sm uppercase tracking-wider"
            >Dificultat</label
          >
          <select
            id="difficulty"
            v-model="difficulty"
            required
            class="w-full bg-gray-900/60 border border-lime-400 rounded-md px-3 py-2 text-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option disabled value="">Selecciona...</option>
            <option v-for="d in difficulties" :key="d" :value="d">
              {{
                d === "facil"
                  ? "Fàcil"
                  : d === "intermig"
                  ? "Intermedi"
                  : "Difícil"
              }}
            </option>
          </select>
        </div>

        <!-- Tu nombre -->
        <div class="animate-fadeItem delay-[400ms]">
          <label class="text-lime-300 text-sm uppercase tracking-wider"
            >El teu nom</label
          >
          <input
            id="userName"
            v-model="userName"
            type="text"
            required
            placeholder="Introdueix el teu nom"
            class="w-full bg-gray-900/60 border border-lime-400 rounded-md px-3 py-2 text-lime-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
          <small class="text-gray-400 text-xs block mt-1">
            {{
              userStore.hasNick
                ? "Pots canviar el teu nom si vols"
                : "Aquest serà el teu nom a la sala"
            }}
          </small>
        </div>

        <!-- Botón crear -->
        <div class="animate-fadeItem delay-[500ms]">
          <button
            type="submit"
            :disabled="!isValid || sending"
            class="w-full mt-4 py-2 rounded-md text-black font-bold uppercase tracking-widest transition disabled:opacity-40 disabled:cursor-not-allowed"
            :class="
              !isValid || sending
                ? 'bg-gray-500'
                : 'bg-lime-400 hover:bg-lime-300'
            "
          >
            {{ sending ? "Creant..." : "Crear Sala" }}
          </button>
        </div>

        <!-- Botón volver -->
        <div class="animate-fadeItem delay-[600ms] text-center">
          <button
            type="button"
            @click="router.push('/')"
            class="border border-lime-400 text-lime-400 px-4 py-2 rounded-md font-bold uppercase tracking-widest hover:bg-lime-400 hover:text-black transition"
          >
            Tornar a l'inici
          </button>
        </div>

        <!-- Mensajes -->
        <p
          v-if="error"
          class="text-red-500 text-center text-sm font-semibold animate-fadeItem delay-[700ms]"
        >
          {{ error }}
        </p>
        <p
          v-if="success"
          class="text-lime-400 text-center text-sm font-semibold animate-fadeItem delay-[700ms]"
        >
          {{ success }}
        </p>
      </form>
    </div>

    <!-- Frase inferior -->
    <footer
      class="relative z-20 text-center text-xs text-gray-500 italic mt-6 tracking-widest animate-fadeItem delay-[800ms]"
    >
      "Només els valents creen la seva pròpia batalla..."
    </footer>
  </section>
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
    error.value = "Omple tots els camps correctament.";
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

  userStore.setNickname(userName.value.trim());

  console.log("Creando room con datos:", payload);

  // Emitir evento 'createRoom'
  socket.emit("createRoom", payload);

  socket.once("roomCreated", (data) => {
    console.log("Room creada con éxito:", data);
    success.value = `Sala "${payload.roomName}" creada amb èxit`;

    // Navegar al lobby
    setTimeout(() => {
      router.push("/lobby");
    }, 1000);
  });

  socket.once("roomNotCreated", (data) => {
    console.log("Error al crear room:", data);
    error.value =
      data.message === "Existent ROOM"
        ? "Ja existeix una sala amb aquest nom"
        : "Error al crear la sala";
    sending.value = false;
  });

  // Si el servidor no usa ack, se puede escuchar un evento de respuesta global:
  // socket.once('room-created', (data) => { ... })
}
</script>
<style scoped>
@keyframes fogMove {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 1000px 0;
  }
}
.bg-fog {
  background: url("/src/assets/nice-snow.png");
  background-repeat: repeat;
  background-size: 600px 600px;
  opacity: 0.3;
  filter: brightness(1.3) contrast(0.8);
  animation: fogMove 60s linear infinite;
  z-index: 10;
  pointer-events: none;
}

/* Animaciones del panel y contenido */
@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: scale(0.95);
    filter: brightness(0.5);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1);
  }
}
@keyframes fadeItem {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fadeIn {
  animation: fadeIn 0.8s ease-out forwards;
}
.animate-fadeItem {
  animation: fadeItem 0.8s ease-out forwards;
  opacity: 0;
}
</style>
