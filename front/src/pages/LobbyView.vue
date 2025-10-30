<template>
  <section style="padding: 1.5rem">
    <h2 style="font-size: 1.5rem; font-weight: 600">Lobby</h2>
    <p style="margin-top: 0.5rem">
      Welcome, <strong>{{ user.nickname }}!</strong>
    </p>

    <!-- Attention dear compañeros, you all can add socket.io lobby join here later -->
  </section>
  <section>
    <div
      style="
        /* margin-top: 1rem; */
        max-width: 400px;
        margin: 1rem auto;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        padding: 0.75rem;
      "
    >
      <h3 style="font-weight: 600; font-size: 1rem">Connected players:</h3>
      <ul
        v-if="players.length > 1"
        style="
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          padding: 0.5rem;
          margin-top: 0.5rem;
          list-style: none;
        "
      >
        <li
          v-for="player in players"
          :key="player.id"
          style="padding: 0.25rem 0"
        >
          <span>{{ player.name }}</span>
          <span
            v-if="player.name === user.nickname"
            style="color: #2563eb; font-size: 0.85rem; margin-left: 4px"
          >
            (You)
          </span>
        </li>
      </ul>
      <p v-else style="margin-top: 0.5rem; color: #6b7280; font-size: 0.9rem">
        Waiting for other players to join...
      </p>
    </div>

    <div style="margin-top: 1rem">
      <button
        @click="logout"
        style="
          border: 1px solid #d1d5db;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
        "
      >
        Back
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { io } from "socket.io-client"; // 👈 import del cliente socket.io
const socket = io("http://localhost:3000"); // ⬅️ cambia el puerto si tu servidor usa otro


const router = useRouter();
const user = useUserStore();
const players = ref([]);

const totalTime = 10; // Temporizador
const seconds = ref(totalTime);
let intervalId = null;

// Cuando el componente se monta
onMounted(() => {
  startCountDown();

  // 👉 Nos unimos a la sala activa (si ya existe en backend)
  socket.emit("joinRoom", {
    room: "main-room", // puedes cambiarlo si usas otro nombre
    nickname: user.nickname,
  });

  socket.on("updateUserList", (list) => {
    console.log("📜 Lista actualizada desde el servidor:", list);
    players.value = list.map((name, i) => ({
      id: i + 1,
      name,
    }));
  });


  // Escuchamos cuando un nuevo usuario entra
  socket.on("userJoined", (data) => {
    console.log(`➡️ ${data.id} se ha unido a ${data.room}`);
  });
});

onUnmounted(() => {
  clearInterval(intervalId);
  socket.disconnect();
});
// Temporizador countdown
const radius = 45;
const circumference = 2 * Math.PI * radius;
const dashOffset = computed(() => {
  const progress = seconds.value / totalTime;
  return circumference * (1 - progress);
});

function startCountDown() {
  intervalId = setInterval(() => {
    if (seconds.value > 0) {
      seconds.value--;
    } else {
      clearInterval(intervalId);
    }
  }, 1000);
}

onMounted(() => startCountDown());
onUnmounted(() => clearInterval(intervalId));

//backend connection with socket.io to get real players list
// import { io } from "socket.io-client";
// const socket = io("http://localhost:3000");
// socket.on("update_players", (list) => { players.value = list });

function logout() {
  user.clearNickname();
  router.push({ name: "home" });
}
</script>