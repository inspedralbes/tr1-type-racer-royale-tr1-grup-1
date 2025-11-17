<template>
  <section
    class="relative min-h-screen flex flex-col items-center justify-start px-6 py-8 font-dogica text-gray-200 bg-gradient-to-b from-[#0B0C10] to-[#1F2833] overflow-hidden">
    <!-- Fondo e iluminación -->
    <img src="/src/assets/opt2_img1.png" alt="Zombie sky background"
      class="absolute inset-0 w-full h-full object-cover opacity-80" />
    <div class="absolute inset-0 bg-black/40"></div>
    <!-- capa de niebla animada -->
    <div class="bg-fog absolute inset-0 z-10 pointer-events-none"></div>

    <!-- Contenido principal -->
    <main class="relative z-20 w-full max-w-6xl space-y-6 animate-fadeIn">
      <!-- Header -->
      <header class="flex flex-col lg:flex-row items-center justify-between gap-4 animate-fadeItem delay-[100ms]">
        <h1 class="text-3xl text-lime-400 font-bold drop-shadow-[0_0_15px_#66FCF1] text-center tracking-widest">
          Taula de Classificació
        </h1>

        <div class="flex flex-wrap gap-3 items-center">
          <input v-model.trim="q" type="text" placeholder="Cercar jugador..."
            class="bg-gray-900/60 border border-lime-400 rounded-md px-3 py-2 text-lime-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-400 min-w-[200px]"
            @keydown.stop />

          <div class="flex items-center gap-2 text-lime-300 text-sm">
            <span>Ordenar per:</span>
            <select v-model="sortKey"
              class="bg-gray-900/60 border border-lime-400 rounded-md px-2 py-1 text-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="wpm">PPM</option>
              <option value="position">Puntuació</option>
              <option value="accuracy">Precisió</option>
              <option value="errors">Errors</option>
              <option value="nickname">Nom (A–Z)</option>
            </select>
          </div>

          <div class="flex items-center gap-2 text-lime-300 text-sm">
            <span>Ordre:</span>
            <select v-model="sortDir"
              class="bg-gray-900/60 border border-lime-400 rounded-md px-2 py-1 text-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </header>

      <!-- Tabla de clasificación -->
      <section
        class="bg-black/40 border border-lime-400 rounded-lg overflow-hidden shadow-lg animate-fadeItem delay-[200ms]">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-900/60 border-b border-lime-400">
              <tr>
                <th class="px-4 py-3 text-left text-lime-400 font-semibold">
                  #
                </th>
                <th @click="setSort('nickname')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition">
                  Jugador
                </th>
                <th @click="setSort('position')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition">
                  Puntuació
                </th>
                <th @click="setSort('wpm')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition">
                  PPM
                </th>
                <th @click="setSort('accuracy')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition">
                  Precisió
                </th>
                <th @click="setSort('errors')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition">
                  Errors
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr v-for="(row, i) in pagedRows" :key="row.id || i"
                :class="{ 'current-player-row': row.nickname === user.nickname, 'hover:bg-gray-800/30': row.nickname !== user.nickname }"
                class="transition">
                <td class="px-4 py-3 text-gray-300">
                  {{ startIndex + i + 1 }}
                </td>
                <td class="px-4 py-3 text-lime-300 font-semibold">
                  {{ row.nickname }}
                </td>
                <td class="px-4 py-3 text-gray-300">{{ row.position }}</td>
                <td class="px-4 py-3 text-gray-300">{{ row.wpm }}</td>
                <td class="px-4 py-3 text-gray-300">{{ row.accuracy }}%</td>
                <td class="px-4 py-3 text-gray-300">
                  {{ displayErrors(row) }}
                </td>
              </tr>
              <tr v-if="pagedRows.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-gray-500 italic">
                  No hi ha jugadors.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Paginación -->
      <footer v-if="pages > 1" class="flex items-center justify-center gap-4 animate-fadeItem delay-[300ms]">
        <button
          class="px-4 py-2 border border-lime-400 text-lime-400 rounded-md font-bold uppercase tracking-wider hover:bg-lime-400 hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-lime-400"
          :disabled="page === 1" @click="page--">
          Anterior
        </button>
        <span class="text-lime-300">Pàgina {{ page }} / {{ pages }}</span>
        <button
          class="px-4 py-2 border border-lime-400 text-lime-400 rounded-md font-bold uppercase tracking-wider hover:bg-lime-400 hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-lime-400"
          :disabled="page === pages" @click="page++">
          Següent
        </button>
      </footer>

      <!-- Botón volver -->
      <div class="flex justify-center animate-fadeItem delay-[400ms]">
        <button @click="leaveRoom"
          class="border border-lime-400 text-lime-400 rounded-md px-6 py-2 font-bold uppercase tracking-widest hover:bg-lime-400 hover:text-black transition">
          Tornar a l'inici
        </button>
      </div>
    </main>

    <!-- Footer -->
    <footer
      class="relative z-20 text-center text-xs text-gray-500 italic mt-8 tracking-widest animate-fadeItem delay-[500ms]">
      "Els supervivents deixen empremta... Els altres només records."
    </footer>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import rawData from "@/data/leaderboard.json"; // static for now, backend later
import { socket } from "@/services/socket.js";
import { useUserStore } from "@/stores/user";

const rows = ref(rawData);
const user = useUserStore();
const $router = useRouter();

// filters / sorting
const q = ref("");
const sortKey = ref("position");
const sortDir = ref("desc");
const page = ref(1);
const pageSize = 10;

// Estado para el ranking por WPM
const currentPlayerResult = computed(() => {
  const userNick = (user.nickname || "").trim();
  console.log("Looking for player:", userNick, "in rows:", rows.value);
  const result = rows.value.find((r) => {
    const rowNick = (r.nickname || "").trim();
    const matches = rowNick === userNick;
    if (!matches) {
      console.log("Comparing:", rowNick, "with", userNick, "=>", matches);
    }
    return matches;
  });
  console.log("Found result:", result);
  return result;
});

const sortedByWPM = computed(() => {
  return [...rows.value].sort((a, b) => {
    const wpmA = Number(a.wpm) || 0;
    const wpmB = Number(b.wpm) || 0;
    return wpmB - wpmA;
  });
});

const currentPlayerPosition = computed(() => {
  const position = sortedByWPM.value.findIndex(
    (r) => r.nickname === user.nickname
  );
  return position !== -1 ? position + 1 : null;
});

onMounted(() => {
  socket.emit("requestRoomResults", { roomName: user.roomName });

  socket.on("roomResults", (data) => {
    console.log("RECEIVED RESULTS:", data.results);
    console.log("Current user nickname:", user.nickname);

    // Asegurarse de que cada resultado tenga todos los datos necesarios
    rows.value = (data.results || []).map((result) => ({
      ...result,
      wpm: Number(result.wpm) || 0,
      accuracy: Number(result.accuracy) || 0,
      errors:
        Number(result.errors) !== undefined
          ? Number(result.errors)
          : 100 - Number(result.accuracy || 0),
      timestamp: result.timestamp || Date.now(),
    }));
  });

  // Hacer una solicitud inicial con delay de 2 segundos para que todos terminen
  setTimeout(() => {
    socket.emit("requestRoomResults", { roomName: user.roomName });
  }, 2000);
});

const filtered = computed(() => {
  const term = q.value.toLowerCase();
  if (!term) return rows.value;
  return rows.value.filter((r) => r.nickname?.toLowerCase().includes(term));
});

const sorted = computed(() => {
  const k = sortKey.value;
  const dir = sortDir.value === "asc" ? 1 : -1;

  return [...filtered.value].sort((a, b) => {
    let va, vb;

    if (k === "errors") {
      const errsA =
        a.errors != null
          ? Number(a.errors)
          : a.accuracy != null
            ? 100 - Number(a.accuracy)
            : 0;
      const errsB =
        b.errors != null
          ? Number(b.errors)
          : b.accuracy != null
            ? 100 - Number(b.accuracy)
            : 0;
      va = errsA;
      vb = errsB;
    } else {
      va = a[k];
      vb = b[k];
    }

    if (typeof va === "string") {
      return va.localeCompare(vb) * dir;
    }

    return (va - vb) * dir;
  });
});

const pages = computed(() =>
  Math.max(1, Math.ceil(sorted.value.length / pageSize))
);
const startIndex = computed(() => (page.value - 1) * pageSize);
const pagedRows = computed(() =>
  sorted.value.slice(startIndex.value, startIndex.value + pageSize)
);

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = key === "nickname" || key === "position" ? "asc" : "desc";
  }
  page.value = 1;
}

function displayErrors(row) {
  if (row.errors != null) return row.errors;
  if (row.accuracy != null) return Math.round(100 - Number(row.accuracy));
  return "-";
}

function leaveRoom() {
  console.log("leaveRoom called with:", {
    roomName: user.roomName,
    nickname: user.nickname,
  });

  socket.emit("leaveRoom", {
    roomName: user.roomName,
    nickname: user.nickname,
  });

  // Limpiar roomName del store (para que no intente reconectar a la misma sala)
  user.clearRoomName();

  // Dar tiempo para que se procese antes de redirigir
  setTimeout(() => {
    console.log("Redirecting to home after leaving room");
    $router.push("/");
  }, 500);
}

// formatters
function iso(dt) {
  return new Date(dt).toISOString();
}
function relativeTime(dt) {
  const d = new Date(dt).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ara mateix";
  if (mins < 60) return `fa ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `fa ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `fa ${days}d`;
}
</script>

<style scoped>
/* ===== PANEL DE RESULTADOS PERSONALES ===== */
.player-result-panel {
  background: linear-gradient(135deg,
      rgba(0, 0, 0, 0.6) 0%,
      rgba(26, 37, 38, 0.4) 100%);
  border: 2px solid #66fcf1;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 0 20px rgba(102, 252, 241, 0.3),
    inset 0 0 20px rgba(102, 252, 241, 0.1);
  transition: all 0.3s ease;
}

.player-result-panel:hover {
  box-shadow: 0 0 40px rgba(102, 252, 241, 0.5),
    inset 0 0 30px rgba(102, 252, 241, 0.15);
  transform: translateY(-2px);
}

.player-result-panel.winner-panel {
  background: linear-gradient(135deg,
      rgba(255, 215, 0, 0.15) 0%,
      rgba(255, 165, 0, 0.1) 100%);
  border-color: #ffd700;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.4),
    inset 0 0 20px rgba(255, 215, 0, 0.2);
  animation: winner-pulse 1s ease-in-out infinite;
}

@keyframes winner-pulse {

  0%,
  100% {
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.4),
      inset 0 0 20px rgba(255, 215, 0, 0.2);
  }

  50% {
    box-shadow: 0 0 50px rgba(255, 215, 0, 0.6),
      inset 0 0 30px rgba(255, 215, 0, 0.3);
  }
}

.result-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}

.left-section {
  flex: 1;
  min-width: 200px;
}

.result-title {
  font-size: 1.75rem;
  font-weight: bold;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(90deg, #a3e635 0%, #66fcf1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 10px rgba(163, 230, 53, 0.3);
}

.player-name {
  font-size: 1.5rem;
  color: #a3e635;
  margin: 0;
  text-shadow: 0 0 8px rgba(163, 230, 53, 0.5);
  font-weight: 600;
}

.position-badge {
  font-size: 1.2rem;
  color: #66fcf1;
  margin-top: 0.5rem;
  font-weight: bold;
  text-shadow: 0 0 6px rgba(102, 252, 241, 0.4);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1.5rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(26, 37, 38, 0.5);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(102, 252, 241, 0.3);
  transition: all 0.3s ease;
}

.stat-item:hover {
  background: rgba(26, 37, 38, 0.8);
  border-color: #66fcf1;
  transform: translateY(-2px);
}

.stat-label {
  font-size: 0.875rem;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: bold;
  color: #a3e635;
  text-shadow: 0 0 8px rgba(163, 230, 53, 0.4);
}

/* ===== ANIMACIONES EXISTENTES ===== */
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
  opacity: 0.8;
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

/* Scrollbar personalizado para la tabla */
.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #66fcf1;
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #45a29e;
}

/* Jugador actual */
.current-player-row {
  background: rgba(163, 230, 53, 0.1) !important;
  border-left: 3px solid #a3e635;
}

.current-player-row td {
  color: #a3e635;
  font-weight: 600;
}
</style>
