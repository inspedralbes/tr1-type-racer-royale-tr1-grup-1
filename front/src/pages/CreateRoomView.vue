<template>
    <form @submit.prevent="onSubmit" class="create-room">
        <div>
            <label>Nombre de la room</label>
            <input v-model="roomName" type="text" required />
        </div>

        <div>
            <label>Idioma</label>
            <select v-model="language" required>
                <option disabled value="">Selecciona...</option>
                <option v-for="lang in languages" :key="lang" :value="lang">{{ lang }}</option>
            </select>
        </div>

        <div>
            <label>Dificultad</label>
            <select v-model="difficulty" required>
                <option disabled value="">Selecciona...</option>
                <option v-for="d in difficulties" :key="d" :value="d">{{ d }}</option>
            </select>
        </div>

        <div>
            <label>Tu nombre</label>
            <input v-model="userName" type="text" required />
        </div>

        <div>
            <button type="submit" :disabled="!isValid || sending">Crear room</button>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="success" class="success">Room creada: {{ success }}</p>
    </form>
</template>

<script setup>
import { ref, computed } from 'vue'
import { socket } from '@/services/socket'
import { useRouter } from "vue-router";
const router = useRouter();

const languages = ['es', 'ca', 'en']
const difficulties = ['facil', 'intermig', 'dificil']

const roomName = ref('')
const language = ref('')
const difficulty = ref('')
const userName = ref('')

const isValid = computed(() => {
    return roomName.value.trim() &&
        userName.value.trim() &&
        languages.includes(language.value) &&
        difficulties.includes(difficulty.value)
})

function onSubmit() {
    if (!isValid.value) {
        error.value = 'Rellena todos los campos correctamente.'
        return
    }

    if (difficulty.value == "facil") {
        difficulty.value = 1
    } else if (difficulty.value == "intermig") {
        difficulty.value = 2
    } else if (difficulty.value == "dificil") {
        difficulty.value = 3
    }

    const payload = {
        roomName: roomName.value.trim(),
        language: language.value,
        difficulty: difficulty.value,
        userName: userName.value.trim()
    }

    console.log('🚀 Creando room con datos:', payload);

    // Emitir evento 'create-room' y aceptar un ack (si el servidor lo soporta)
    socket.emit('createRoom', payload);

    socket.once('roomCreated', (data) => {
        console.log('✅ Room creada con éxito:', data);
        socket.emit("joinRoom", {
            room: data.roomName,
            nickname: data.nickname,
        });
        socket.on("userJoined", (data) => {
            console.log(`➡️ ${data.id} se ha unido a ${data.room}`);
            const redirectTo = router.currentRoute.value.query.redirectTo || '/lobby';
            router.push(redirectTo);
        });
    });



    // Si el servidor no usa ack, se puede escuchar un evento de respuesta global:
    // socket.once('room-created', (data) => { ... })
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