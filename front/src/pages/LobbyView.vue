  <template>
    <section style="padding: 1.5rem">
      <h2 style="font-size: 1.5rem; font-weight: 600">Lobby</h2>
      <p style="margin-top: 0.5rem">
        Welcome, <strong>{{ user.nickname }}!</strong>
      </p>

      <!-- Attention dear compañeros, you all can add socket.io lobby join here later -->
    </section>
    <section>
      <div style="
          max-width: 400px;
          margin: 1rem auto;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          padding: 0.75rem;
        ">
        <h3 style="font-weight: 600; font-size: 1rem">Connected players:</h3>

        <!-- Mostrar lista de jugadores y timer cuando hay más de 1 jugador -->
        <div v-if="players.length > 1">
          <ul style="
              border: 1px solid #d1d5db;
              border-radius: 0.5rem;
              padding: 0.5rem;
              margin-top: 0.5rem;
              list-style: none;
            ">
            <li v-for="player in players" :key="player.id" style="padding: 0.25rem 0">
              <span>{{ player.name }}</span>
              <span v-if="player.name === user.nickname" style="color: #2563eb; font-size: 0.85rem; margin-left: 4px">
                (You)
              </span>
            </li>
          </ul>

          <!-- Timer que se muestra solo cuando hay jugadores conectados -->
          <div :style="{
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
          }">
            {{ seconds }}
          </div>
        </div>
        <!-- Mensaje de espera cuando no hay suficientes jugadores -->
        <p v-else style="margin-top: 0.5rem; color: #6b7280; font-size: 0.9rem">
          Waiting for other players to join...
        </p>
      </div>

      <div style="margin-top: 1rem">
        <button @click="logout" style="
            border: 1px solid #d1d5db;
            padding: 0.5rem 0.75rem;
            border-radius: 0.5rem;
          ">
          Back
        </button>
      </div>
    </section>
  </template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { socket } from "@/services/socket"; // import del cliente socket.io

const router = useRouter();
const user = useUserStore();
const players = ref([]);

const seconds = ref(10); // duración del temporizador
const totalTime = 10; // tiempo total del temporizador
let timer = null;

// Cuando el componente se monta
onMounted(() => {
  startCountDown();

  // Nos unimos a la sala activa (si ya existe en backend)
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
  if (timer) clearInterval(timer);
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
  timer = setInterval(() => {
    if (seconds.value > 0) {
      seconds.value--;
    } else {
      clearInterval(timer);
      router.push("/play");
    }
  }, 1000);
}

function logout() {
  user.clearNickname();
  router.push({ name: "home" });
}
</script>
