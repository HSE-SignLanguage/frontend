<template>
  <div class="simple-body">
    <header class="simple-header">
      <h1>SigmaSign - Плесень edition</h1>
      <router-link to="/" class="back-link">← Обычная версия</router-link>
    </header>

    <main class="simple-main">
      <div class="status-bar" :style="{ backgroundColor: isStreaming ? '#d4edda' : '#f8d7da' }">
        {{ isStreaming ? 'Идет запись. Покажите жесты.' : 'Камера готова. Нажмите "Начать".' }}
      </div>

      <div class="video-container">
        <video ref="videoEl" autoplay playsinline muted></video>
        <!-- Canvas hidden -->
        <canvas ref="canvasEl" width="854" height="480" style="display:none;"></canvas>
      </div>

      <div class="controls">
        <button v-if="!isStreaming" class="btn btn-start" @click="startStream">
          ▶ НАЧАТЬ ПЕРЕВОД
        </button>
        <button v-else class="btn btn-stop" @click="stopStream">
          ■ ОСТАНОВИТЬ
        </button>
      </div>

      <div class="text-section">
        <label>Распознанный текст:</label>
        <textarea readonly v-model="transcribedText"></textarea>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const isStreaming = ref(false);
const transcribedText = ref('');
const videoEl = ref(null);
const canvasEl = ref(null);

let ws = null;
let intervalId = null;
const API_WS_URL = 'wss://hack.eferzo.xyz/api/socket';

onMounted(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if(videoEl.value) videoEl.value.srcObject = stream;
  } catch (e) {
    alert("Ошибка: Камера не найдена.");
  }
});

onUnmounted(() => stopStream());

function startStream() {
  ws = new WebSocket(API_WS_URL);
  ws.onopen = () => {
    isStreaming.value = true;
    transcribedText.value = "";
    // 24 FPS
    intervalId = setInterval(() => {
      if(!videoEl.value || !canvasEl.value) return;
      const ctx = canvasEl.value.getContext('2d');
      ctx.drawImage(videoEl.value, 0, 0, 854, 480);
      canvasEl.value.toBlob(blob => { if(blob) ws.send(blob); }, 'image/jpeg', 0.6);
    }, 42); 
  };
  
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if(data.text) transcribedText.value += data.text + " ";
    } catch(err) {}
  };
  
  ws.onerror = () => stopStream();
  ws.onclose = () => stopStream();
}

function stopStream() {
  isStreaming.value = false;
  if(intervalId) clearInterval(intervalId);
  if(ws) ws.close();
}
</script>

<style scoped>
.simple-body {
  font-family: 'Verdana', sans-serif; background-color: #f4f7f6; color: #2c3e50;
  min-height: 100vh; display: flex; flex-direction: column;
}
.simple-header {
  background: white; padding: 20px; border-bottom: 2px solid #ccc;
  display: flex; justify-content: space-between; align-items: center;
}
.simple-header h1 { margin: 0; color: #0056b3; font-size: 28px; }
.back-link { font-size: 20px; color: #333; text-decoration: none; border: 1px solid #ccc; padding: 10px; border-radius: 5px; }

.simple-main { padding: 20px; max-width: 800px; margin: 0 auto; width: 100%; box-sizing: border-box; }

.status-bar {
  padding: 15px; font-size: 24px; text-align: center; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ccc;
}
.video-container {
  background: black; border-radius: 8px; overflow: hidden; margin-bottom: 20px;
}
video { width: 100%; display: block; transform: scaleX(-1); }

.controls { display: flex; justify-content: center; margin-bottom: 30px; }
.btn {
  font-size: 30px; padding: 20px 40px; border: none; border-radius: 10px; cursor: pointer; color: white; width: 100%;
}
.btn-start { background-color: #28a745; box-shadow: 0 5px 0 #218838; }
.btn-start:hover { background-color: #218838; }
.btn-stop { background-color: #dc3545; box-shadow: 0 5px 0 #c82333; }
.btn-stop:hover { background-color: #c82333; }

.text-section label { font-size: 24px; display: block; margin-bottom: 10px; }
textarea {
  width: 100%; height: 200px; font-size: 30px; padding: 15px; border: 2px solid #0056b3; box-sizing: border-box;
}
</style>