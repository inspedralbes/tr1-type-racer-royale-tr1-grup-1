<template>
  <main class="wrap">
    <header class="header">
      <h1>Leaderboard</h1>

      <div class="controls">
        <input
          v-model.trim="q"
          type="text"
          placeholder="Search player…"
          class="input"
          @keydown.stop
        />

        <label class="select-wrap">
          <span>Sort by</span>
          <select v-model="sortKey" class="select">
            <option value="time">Time</option>
            <option value="wpm">WPM</option>
            <option value="accuracy">Accuracy</option>
            <option value="errors">Errors</option>
            <option value="races">Races</option>
            <option value="lastPlayed">Last Played</option>
            <option value="nickname">Name (A–Z)</option>
          </select>
        </label>

        <label class="select-wrap">
          <span>Order</span>
          <select v-model="sortDir" class="select">
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>
      </div>
    </header>

    <section class="card">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th @click="setSort('nickname')" class="th-btn">Player</th>
            <th @click="setSort('time')" class="th-btn">Time</th>
            <th @click="setSort('wpm')" class="th-btn">WPM</th>
            <th @click="setSort('accuracy')" class="th-btn">Accuracy</th>
            <th @click="setSort('errors')" class="th-btn">Errors</th>
            <th @click="setSort('races')" class="th-btn">Races</th>
            <th @click="setSort('lastPlayed')" class="th-btn">Last Played</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in pagedRows" :key="row.id || i">
            <td>{{ startIndex + i + 1 }}</td>
            <td class="nick">{{ row.nickname }}</td>
            <td>
              <span v-if="row.time">{{ row.time }}s</span>
              <span v-else>{{ relativeTime(row.lastPlayed) }}</span>
            </td>
            <td>{{ row.wpm }}</td>
            <td>{{ row.accuracy }}%</td>
            <td>{{ displayErrors(row) }}</td>
            <td>{{ row.races ?? '-' }}</td>
            <td :title="iso(row.lastPlayed)">{{ relativeTime(row.lastPlayed) }}</td>
          </tr>
          <tr v-if="pagedRows.length === 0">
            <td colspan="8" class="empty">No players match your filter.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer class="pager" v-if="pages > 1">
      <button class="btn" :disabled="page === 1" @click="page--">Prev</button>
      <span>Page {{ page }} / {{ pages }}</span>
      <button class="btn" :disabled="page === pages" @click="page++">Next</button>
    </footer>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import rawData from "@/data/leaderboard.json"; // optional fallback if present

const rows = ref(Array.isArray(rawData) ? rawData : []);

// add loading/error state
const loading = ref(false);
const error = ref(null);

// filters / sorting
const q = ref("");
const sortKey = ref("wpm");
const sortDir = ref("desc");
const page = ref(1);
const pageSize = 10;

onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch("/api/leaderboard");
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    rows.value = Array.isArray(data) ? data : data.results ?? [];
  } catch (e) {
    console.error(e);
    error.value = e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
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

    if (k === "time") {
      va = a.time != null ? Number(a.time) * 1000 : new Date(a.lastPlayed).getTime();
      vb = b.time != null ? Number(b.time) * 1000 : new Date(b.lastPlayed).getTime();
    } else if (k === "errors") {
      const errsA = a.errors != null
        ? Number(a.errors)
        : a.accuracy != null
        ? 100 - Number(a.accuracy)
        : 0;
      const errsB = b.errors != null
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

const pages = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize)));
const startIndex = computed(() => (page.value - 1) * pageSize);
const pagedRows = computed(() => sorted.value.slice(startIndex.value, startIndex.value + pageSize));

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
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
</script>

<style scoped>
.wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.25rem;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.header h1 {
  margin: 0;
  font-size: 1.5rem;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.input {
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  min-width: 220px;
}
.select-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.select {
  padding: 0.4rem 0.55rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
}

.card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: white;
}
.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.table thead {
  background: #f9fafb;
}
.table th,
.table td {
  padding: 0.7rem 0.8rem;
  text-align: left;
  border-bottom: 1px solid #f1f5f9;
}
.table th {
  font-weight: 600;
  font-size: 0.9rem;
}
.th-btn {
  cursor: pointer;
  user-select: none;
}
.nick {
  font-weight: 600;
}
.empty {
  text-align: center;
  color: #6b7280;
  padding: 1rem;
}

.pager {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  justify-content: center;
  margin-top: 1rem;
}
.btn {
  padding: 0.45rem 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>