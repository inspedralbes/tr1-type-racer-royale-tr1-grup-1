<template>
    <div class="teclat" style="margin: 10px;" v-for="(fila, index) in filesDelTeclat" :key="index">
        <span v-for="lletra in fila" :key="lletra" :class="getClassKeyboard(lletra)" :style="getStyleKeyboard(lletra)"
            @click="handleKeyClick(lletra)" role="button" tabindex="0">{{ lletra }}</span>
    </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { socket } from '../services/socket';

const filesDelTeclat = ref([
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
]);

let teclaPremuda = ref('');
const emit = defineEmits(['key-clicked']);
const props = defineProps({
    nickname: { type: String, default: '' }
});

// mapa de teclas presionadas por OTROS jugadores
const pressedKeys = ref({}); // { "A": "#ff0000", ... }

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // escuchar eventos del servidor
    socket.on('userKey', ({ key, color, nickname }) => {
        console.log('Received userKey event:', { key, color, nickname });
        // si el evento viene de otro usuario, no de mí mismo
        if (nickname !== props.nickname && key) {
            const K = String(key).toUpperCase();
            pressedKeys.value[K] = color || null;

            // borrar el color después de 300ms
            setTimeout(() => {
                delete pressedKeys.value[K];
            }, 300);
        }
    });
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    socket.off('userKey');
});

function handleKeyDown(event) {
    const key = String(event.key).toUpperCase();
    if (teclaPremuda.value !== key) {
        teclaPremuda.value = key;
    }
    // emite el evento al servidor
    socket.emit('userKey', {
        room: 'main-room',
        nickname: props.nickname,
        key: teclaPremuda.value
    });
}

function handleKeyUp() {
    teclaPremuda.value = '';
}

function handleKeyClick(lletra) {
    teclaPremuda.value = lletra;
    emit('key-clicked', lletra);
}

function getClassKeyboard(lletra) {
    if (lletra === teclaPremuda.value) {
        return 'tecla-premuda'; // azul celeste (tu tecla)
    } else {
        return 'tecla';
    }
}

function getStyleKeyboard(lletra) {
    const color = pressedKeys.value[lletra];
    if (color) {
        return { backgroundColor: color, color: '#000' }; // color de otros jugadores
    }
    return {};
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