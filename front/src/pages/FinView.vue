<template>
  <section
    class="relative min-h-screen flex flex-col items-center justify-start px-6 py-8 font-dogica text-gray-200 bg-gradient-to-b from-[#0B0C10] to-[#1F2833] overflow-hidden"
  >
    <!-- Fondo e iluminación -->
    <img
      src="/src/assets/opt2_img1.png"
      alt="Zombie sky background"
      class="absolute inset-0 w-full h-full object-cover opacity-80"
    />
    <div class="absolute inset-0 bg-black/40"></div>
    <!-- capa de niebla animada -->
    <div class="bg-fog absolute inset-0 z-10 pointer-events-none"></div>

    <!-- Contenido principal -->
    <main class="relative z-20 w-full max-w-6xl space-y-6 animate-fadeIn">
      <!-- Header -->
      <header
        class="flex flex-col lg:flex-row items-center justify-between gap-4 animate-fadeItem delay-[100ms]"
      >
        <h1
          class="text-3xl text-lime-400 font-bold drop-shadow-[0_0_15px_#66FCF1] text-center tracking-widest"
        >
          Taula de Classificació
        </h1>

        <div class="flex flex-wrap gap-3 items-center">
          <input
            v-model.trim="q"
            type="text"
            placeholder="Cercar jugador..."
            class="bg-gray-900/60 border border-lime-400 rounded-md px-3 py-2 text-lime-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-400 min-w-[200px]"
            @keydown.stop
          />

          <div class="flex items-center gap-2 text-lime-300 text-sm">
            <span>Ordenar per:</span>
            <select
              v-model="sortKey"
              class="bg-gray-900/60 border border-lime-400 rounded-md px-2 py-1 text-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-400"
            >
              <option value="time">Temps</option>
              <option value="wpm">PPM</option>
              <option value="accuracy">Precisió</option>
              <option value="errors">Errors</option>
              <option value="races">Carreres</option>
              <option value="lastPlayed">Última partida</option>
              <option value="nickname">Nom (A–Z)</option>
            </select>
          </div>

          <div class="flex items-center gap-2 text-lime-300 text-sm">
            <span>Ordre:</span>
            <select
              v-model="sortDir"
              class="bg-gray-900/60 border border-lime-400 rounded-md px-2 py-1 text-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-400"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </header>

      <!-- Tabla de clasificación -->
      <section
        class="bg-black/40 border border-lime-400 rounded-lg overflow-hidden shadow-lg animate-fadeItem delay-[200ms]"
      >
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-900/60 border-b border-lime-400">
              <tr>
                <th class="px-4 py-3 text-left text-lime-400 font-semibold">
                  #
                </th>
                <th
                  @click="setSort('nickname')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition"
                >
                  Jugador
                </th>
                <th
                  @click="setSort('time')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition"
                >
                  Temps
                </th>
                <th
                  @click="setSort('wpm')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition"
                >
                  PPM
                </th>
                <th
                  @click="setSort('accuracy')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition"
                >
                  Precisió
                </th>
                <th
                  @click="setSort('errors')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition"
                >
                  Errors
                </th>
                <th
                  @click="setSort('races')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition"
                >
                  Carreres
                </th>
                <th
                  @click="setSort('lastPlayed')"
                  class="px-4 py-3 text-left text-lime-400 font-semibold cursor-pointer hover:text-lime-300 transition"
                >
                  Última partida
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr
                v-for="(row, i) in pagedRows"
                :key="row.id || i"
                class="hover:bg-gray-800/30 transition"
              >
                <td class="px-4 py-3 text-gray-300">
                  {{ startIndex + i + 1 }}
                </td>
                <td class="px-4 py-3 text-lime-300 font-semibold">
                  {{ row.nickname }}
                </td>
                <td class="px-4 py-3 text-gray-300">
                  <span v-if="row.time">{{ row.time }}s</span>
                  <span v-else>{{ relativeTime(row.lastPlayed) }}</span>
                </td>
                <td class="px-4 py-3 text-gray-300">{{ row.wpm }}</td>
                <td class="px-4 py-3 text-gray-300">{{ row.accuracy }}%</td>
                <td class="px-4 py-3 text-gray-300">
                  {{ displayErrors(row) }}
                </td>
                <td class="px-4 py-3 text-gray-300">{{ row.races ?? "-" }}</td>
                <td
                  class="px-4 py-3 text-gray-300"
                  :title="iso(row.lastPlayed)"
                >
                  {{ relativeTime(row.lastPlayed) }}
                </td>
              </tr>
              <tr v-if="pagedRows.length === 0">
                <td
                  colspan="8"
                  class="px-4 py-8 text-center text-gray-500 italic"
                >
                  No hi ha jugadors que coincideixin amb el filtre.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Paginación -->
      <footer
        v-if="pages > 1"
        class="flex items-center justify-center gap-4 animate-fadeItem delay-[300ms]"
      >
        <button
          class="px-4 py-2 border border-lime-400 text-lime-400 rounded-md font-bold uppercase tracking-wider hover:bg-lime-400 hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-lime-400"
          :disabled="page === 1"
          @click="page--"
        >
          Anterior
        </button>
        <span class="text-lime-300">Pàgina {{ page }} / {{ pages }}</span>
        <button
          class="px-4 py-2 border border-lime-400 text-lime-400 rounded-md font-bold uppercase tracking-wider hover:bg-lime-400 hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-lime-400"
          :disabled="page === pages"
          @click="page++"
        >
          Següent
        </button>
      </footer>

      <!-- Botón volver -->
      <div class="flex justify-center animate-fadeItem delay-[400ms]">
        <button
          @click="$router.push('/')"
          class="border border-lime-400 text-lime-400 rounded-md px-6 py-2 font-bold uppercase tracking-widest hover:bg-lime-400 hover:text-black transition"
        >
          Tornar a l'inici
        </button>
      </div>
    </main>

    <!-- Footer -->
    <footer
      class="relative z-20 text-center text-xs text-gray-500 italic mt-8 tracking-widest animate-fadeItem delay-[500ms]"
    >
      "Els supervivents deixen empremta... Els altres només records."
    </footer>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000"); // o la URL de tu backend
const rows = ref([]);
const loading = ref(true);

onMounted(() => {
  // Cuando lleguen los resultados de la partida
  socket.on("updateGameResults", (results) => {
    rows.value = results.map(r => ({
      nickname: r.nickname,
      wpm: r.wpm,
      accuracy: r.accuracy,
      errors: 100 - r.accuracy,
      races: r.races ?? "-", // si quieres trackear carreras
      lastPlayed: r.timestamp
    }));
    loading.value = false;
  });
  console.log("DATOS", rows.value);
});


// filters / sorting
const q = ref("");
const sortKey = ref("wpm");
const sortDir = ref("desc");
const page = ref(1);
const pageSize = 10;

const filtered = computed(() => {
  const term = q.value.toLowerCase();
  if (!term) return rows.value;
  return rows.value.filter(r => r.nickname?.toLowerCase().includes(term));
});

const sorted = computed(() => {
  const k = sortKey.value;
  const dir = sortDir.value === "asc" ? 1 : -1;

  return [...filtered.value].sort((a, b) => {
    let va, vb;

    if (k === "time") {
      va =
        a.time != null
          ? Number(a.time) * 1000
          : new Date(a.lastPlayed).getTime();
      vb =
        b.time != null
          ? Number(b.time) * 1000
          : new Date(b.lastPlayed).getTime();
    } else if (k === "errors") {
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
    } else if (k === "lastPlayed") {
      va = new Date(a.lastPlayed).getTime();
      vb = new Date(b.lastPlayed).getTime();
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
    sortDir.value = key === "nickname" ? "asc" : "desc";
  }
  page.value = 1;
}

function displayErrors(row) {
  if (row.errors != null) return row.errors;
  if (row.accuracy != null) return Math.round(100 - Number(row.accuracy));
  return "-";
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
</style>