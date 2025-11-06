<template>
  <section style="padding: 1.5rem">
    <h2 style="font-size: 1.5rem; font-weight: 600">Lobby</h2>
    <p style="margin-top: 0.5rem">
      Welcome, <strong>{{ user.nickname }}!</strong>
    </p>
  </section>

  <section>
    <div
      style="
        max-width: 400px;
        margin: 1rem auto;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        padding: 0.75rem;
      "
    >
      <h3 style="font-weight: 600; font-size: 1rem">Connected players:</h3>

      <div v-if="players.length > 1">
        <ul
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
            :key="player.id || player.name || player"
            style="padding: 0.25rem 0"
          >
            <span>{{ player.nickname || player.name || player }}</span>
            <span
              v-if="(player.nickname || player.name || player) === user.nickname"
              style="color: #2563eb; font-size: 0.85rem; margin-left: 4px"
            >
              (You)
            </span>
          </li>
        </ul>

        <!-- Timer que se muestra solo cuando hay jugadores conectados -->
        <div
          v-if="isTimerActive"
          :style="{
            width: '75px',
            height: '75px',
            borderRadius: '50%',
            border: `6px solid ${seconds <= 5 ? '#dc2626' : '#2563eb'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: 'black',
            margin: '1.5rem auto',
            transition: 'all 0.3s ease',
          }"
        >
          {{ seconds }}
        </div>
      </div>

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
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const router = useRouter();
const user = useUserStore();
const players = ref([]);

const seconds = ref(20);
const totalTime = 20;
const isTimerActive = ref(false);

onMounted(() => {
  // Join main room on load
  socket.emit("joinRoom", {
    room: "main-room",
    nickname: user.nickname,
  });

  socket.on("updateUserList", (list) => {
    console.log("📜 Lista actualizada desde el servidor:", list);

    if (Array.isArray(list)) {
      if (list.length > 0 && typeof list[0] === "object" && list[0].nickname) {
        players.value = list;
      } else {
        players.value = list.map((name, i) => ({
          id: i + 1,
          nickname: name,
        }));
      }
    }

    // Auto-start timer if enough players
    if (players.value.length > 1 && !isTimerActive.value) {
      startSynchronizedTimer();
    } else if (players.value.length <= 1) {
      stopTimer();
    }
  });

  socket.on("timerUpdate", (data) => {
    seconds.value = data.seconds;
    isTimerActive.value = data.isActive;

    if (data.seconds === 0) {
      router.push("/play");
    }
  });

  socket.on("userJoined", (data) => {
    console.log(`➡️ ${data.nickname} joined ${data.room}`);
  });
});

onUnmounted(() => {
  socket.off("updateUserList");
  socket.off("timerUpdate");
  socket.off("userJoined");
});

const radius = 45;
const circumference = 2 * Math.PI * radius;
const dashOffset = computed(() => {
  const progress = seconds.value / totalTime;
  return circumference * (1 - progress);
});

function startSynchronizedTimer() {
  if (isTimerActive.value) return;
  isTimerActive.value = true;
  seconds.value = totalTime;
  socket.emit("startTimer", { room: "main-room" });
}

function stopTimer() {
  isTimerActive.value = false;
  seconds.value = totalTime;
}

function logout() {
  user.clearNickname();
  router.push({ name: "home" });
}
</script>