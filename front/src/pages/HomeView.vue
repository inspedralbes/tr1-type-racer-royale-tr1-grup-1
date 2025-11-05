<template>
  <main class="min-h-screen grid place-items-center p-6">
    <div class="w-full max-w-sm space-y-4">
      <!-- for now here are vibecoded Tailwind classes, you can change those for yours later-->
      <h1 class="text-3xl font-bold text-center">
        Giga Racer Royale Pro Max Deluxe
      </h1>

      <p v-if="route.query.needNick" class="rounded-md" style="
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.5rem 0.75rem;
          font-size: 0.9rem;
        ">
        Please enter a nickname before joining.
      </p>

      <label class="block">
        <span style="font-size: 0.9rem; color: #374151">Nickname</span>
        <input v-model.trim="nick" type="text" placeholder="Your nickname" @keyup.enter="join" autofocus style="
            margin-top: 0.25rem;
            width: 100%;
            border: 1px solid #d1d5db;
            border-radius: 0.5rem;
            padding: 0.5rem 0.75rem;
          " />
      </label>
      <div>
        <h2 class="text-xl font-semibold">Salas disponibles</h2>

        <div v-if="rooms.length === 0" class="text-sm text-gray-500">No hay salas disponibles.</div>

        <ul v-else class="space-y-3 mt-3">
          <li v-for="room in rooms" :key="room.roomName"
            class="p-3 border rounded-md flex items-center justify-between">
            <div>
              <div class="font-medium">{{ room.roomName }}</div>
              <div class="text-sm text-gray-500">
                Jugadores: {{ room.players ? room.players.length : (room.playerCount ?? 0) }}
                · Estado: {{ room.status }}
              </div>
            </div>

            <div>
              <button v-if="room.status == 'waiting'"
                class="px-3 py-1 rounded-md bg-blue-600 text-white disabled:opacity-50" :disabled="!nick"
                @click="user.setNickname(nick); socket.emit('joinRoom', { roomName: room.roomName, nickname: user.nickname, master: false })">
                Unirse
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <button @click="router.push('/createRoom')" style="
          width: 100%;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: #2563eb;
          background: white;
          border: 1px solid #2563eb;
        ">
      CreateRoom
    </button>
  </main>
</template>

<script setup>
import { ref, watchEffect } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useUserStore } from "@/stores/user";
import { socket } from "@/services/socket";

const router = useRouter();
const route = useRoute();
const user = useUserStore();
const rooms = ref([]);

const nick = ref(user.nickname);

// Clear the banner once the user types
watchEffect(() => {
  if (route.query.needNick && nick.value) {
    router.replace({ query: {} });
  }
});

socket.emit("getRoomList");

socket.on("roomList", (data) => {
  console.log("Salas disponibles:", data.rooms);
  rooms.value = data.rooms;
});

socket.on("userJoined", (data) => {
  if (data.id === socket.id) {
    console.log(`➡️ ${data.id} se ha unido a ${data.roomName}`);
    const redirectTo = router.currentRoute.value.query.redirectTo || '/lobby';
    router.push(redirectTo);
  }
});


function join() {
  if (!nick.value?.trim()) return;
  user.setNickname(nick.value);

  // Emitimos la petición de crear sala
  socket.emit("requestRoomCreation", { roomName: "defaultRoom" });

  // Escuchamos la confirmación del servidor
  socket.on("confirmRoomCreation", (data) => {
    console.log("Confirmación recibida:", data.roomName);

    // Una vez confirmado, emitimos para crear o unirnos a la sala
    socket.emit("createRoom", { room: data.roomName });
  });

  // Escuchamos cuando se crea la sala
  socket.on("roomCreated", (data) => {
    console.log("Sala creada o unida:", data.room);

    // go back where they intended, else /lobby
    const redirectTo = route.query.redirectTo || '/lobby';
    router.push(redirectTo)
  });
}
</script>