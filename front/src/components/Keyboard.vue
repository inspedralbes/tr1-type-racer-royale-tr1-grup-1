<template>
    <div class="teclat" style="margin: 10px;" v-for="(fila, index) in filesDelTeclat" :key="index">
        <span v-for="lletra in fila" :key="lletra" :class="getClassKeyboard(lletra)" @click="handleKeyClick(lletra)"
            role="button" tabindex="0">{{ lletra }}</span>
    </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { socket } from '../services/socket'; // <-- importa el socket

const filesDelTeclat = ref([
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
]);
let teclaPremuda = ref('');

const emit = defineEmits(['key-clicked']); // mantiene el emit al padre si aún lo usas

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
})

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
})

function handleKeyDown(event) {
    teclaPremuda = String(event.key).toUpperCase();
    const key = String(event.key).toUpperCase();
    // evita reenvío continuo si la tecla se mantiene pulsada
    if (teclaPremuda.value !== key) {
        teclaPremuda.value = key;
        // emite al socket para que el backend pueda reenviarlo al room
        socket.emit('key-pressed', { key });
    }
}

function handleKeyUp(event) {
    teclaPremuda.value = '';
}

function handleKeyClick(lletra) {
    // marca la tecla en la UI
    teclaPremuda.value = lletra;

    // emite evento al padre del componente (mantener compatibilidad)
    emit('key-clicked', lletra);

    // envia al socket para que el servidor lo propague al room
    socket.emit('key-pressed', { key: lletra });
}


function getClassKeyboard(lletra) {
    if (lletra === teclaPremuda.value) {
        return "tecla-premuda";
    }
    else {
        return "tecla"
    }
}
</script>
<style scoped>
.teclat {
    display: flex;
    align-items: center;
    justify-content: center;
}

.tecla {
    background-color: white;
    border-radius: 4px;
    padding: 4px 8px;
    margin: 10px;
    color: #222;
    font-weight: bold;
}

.tecla-premuda {
    background-color: aquamarine;
    border-radius: 4px;
    padding: 4px 8px;
    margin: 10px;
    color: #222;
    font-weight: bold;
    transition: background 0.2s;
}
</style>