<template>
  <div class="simple-body">
    <!-- Шапка -->
    <header class="simple-header">
      <h1>SigmaSign - упрощенный</h1>
      <router-link to="/" class="back-link">
        ← Вернуться к обычной версии
      </router-link>
    </header>

    <main class="simple-main">
      <!-- Статус бар -->
      <div 
        class="status-bar" 
        :style="{ 
          backgroundColor: isStreaming ? '#d4edda' : '#eef2f5',
          color: isStreaming ? '#155724' : '#383d41',
          borderColor: isStreaming ? '#c3e6cb' : '#d6d8db'
        }"
      >
        <span v-if="!isStreaming">📹 Камера готова. Нажмите <strong>«Начать перевод»</strong></span>
        <span v-else>🔴 Идет запись... Покажите жесты в камеру.</span>
      </div>

      <!-- Видео -->
      <div class="video-container">
        <video ref="videoEl" autoplay playsinline muted></video>
        <!-- Скрытый холст -->
        <canvas ref="canvasEl" width="854" height="480" style="display:none;"></canvas>
      </div>

      <!-- Кнопки (Огромные) -->
      <div class="controls">
        <button v-if="!isStreaming" class="btn btn-start" @click="startStream">
          ▶ НАЧАТЬ ПЕРЕВОД
        </button>
        <button v-else class="btn btn-stop" @click="stopStream">
          ■ ОСТАНОВИТЬ
        </button>
      </div>

      <!-- Поле текста -->
      <div class="text-section">
        <label for="outText">Распознанный текст:</label>
        <textarea 
          id="outText" 
          readonly 
          v-model="transcribedText"
          placeholder="Здесь появится текст, когда вы начнете..."
        ></textarea>
        
        <button class="btn-download" @click="downloadText" :disabled="!transcribedText">
          📥 Скачать текст
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// --- Конфигурация ---
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const FPS = 24;

const isStreaming = ref(false);
const transcribedText = ref('');
const videoEl = ref(null);
const canvasEl = ref(null);

let ws = null;
let intervalId = null;

// --- Helper URL ---
const getWsUrl = () => {
  let url = API_BASE.replace(/\/$/, '');
  if (url.startsWith('https')) {
    url = url.replace(/^https/, 'wss');
  } else {
    url = url.replace(/^http/, 'ws');
  }
  return `${url}/socket`;
};

// --- Lifecycle ---
onMounted(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "user" } 
    });
    if(videoEl.value) {
      videoEl.value.srcObject = stream;
    }
  } catch (e) {
    alert("Ошибка: Камера не найдена или доступ запрещен.");
  }
});

onUnmounted(() => {
  stopStream();
  if (videoEl.value && videoEl.value.srcObject) {
    videoEl.value.srcObject.getTracks().forEach(t => t.stop());
  }
});

// --- Stream Logic ---
function startStream() {
  const wsUrl = getWsUrl();
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    isStreaming.value = true;
    transcribedText.value = "";
    
    // Запускаем отправку 24 раза в секунду
    intervalId = setInterval(() => {
      if(!videoEl.value || !canvasEl.value || ws.readyState !== WebSocket.OPEN) return;
      
      const ctx = canvasEl.value.getContext('2d');
      // Рисуем
      ctx.drawImage(videoEl.value, 0, 0, 854, 480);
      // Отправляем
      canvasEl.value.toBlob(blob => {
        if(blob && ws.readyState === WebSocket.OPEN) ws.send(blob);
      }, 'image/jpeg', 0.5);
      
    }, 1000 / FPS); 
  };
  
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if(data.text) {
        transcribedText.value += data.text + " ";
        // Автоскролл
        const ta = document.getElementById('outText');
        if(ta) ta.scrollTop = ta.scrollHeight;
      }
    } catch(err) {
      console.error(err);
    }
  };
  
  ws.onerror = (e) => {
    console.error(e);
    alert("Ошибка соединения с сервером.");
    stopStream();
  };
  
  ws.onclose = () => stopStream();
}

function stopStream() {
  isStreaming.value = false;
  if(intervalId) clearInterval(intervalId);
  if(ws) {
    ws.close();
    ws = null;
  }
}

function downloadText() {
  const blob = new Blob([transcribedText.value], {type: "text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "перевод.txt";
  a.click();
}
</script>

<style scoped>
/* --- Доступный стиль (Accessible) --- */
.simple-body {
  font-family: 'Verdana', 'Arial', sans-serif;
  background-color: #f4f7f6;
  color: #2c3e50;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.simple-header {
  background: white;
  padding: 20px 30px;
  border-bottom: 3px solid #dcdcdc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.simple-header h1 {
  margin: 0;
  color: #0056b3;
  font-size: 32px;
}

.back-link {
  font-size: 20px;
  color: #333;
  text-decoration: none;
  border: 2px solid #ccc;
  padding: 10px 20px;
  border-radius: 8px;
  background: #f9f9f9;
  font-weight: bold;
}
.back-link:hover { background: #e2e6ea; }

.simple-main {
  padding: 30px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  flex: 1;
}

.status-bar {
  padding: 20px;
  font-size: 26px;
  text-align: center;
  border-radius: 12px;
  margin-bottom: 25px;
  border: 2px solid #ccc;
  transition: all 0.3s;
}

.video-container {
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 25px;
  border: 4px solid #333;
  line-height: 0; /* Убирает отступ снизу видео */
}

video {
  width: 100%;
  height: auto;
  display: block;
  transform: scaleX(-1); /* Зеркало */
}

.controls {
  display: flex;
  justify-content: center;
  margin-bottom: 35px;
}

.btn {
  font-size: 32px;
  padding: 25px 50px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  color: white;
  width: 100%;
  font-weight: bold;
  text-transform: uppercase;
  transition: transform 0.1s;
}
.btn:active { transform: translateY(4px); box-shadow: none !important; }

.btn-start {
  background-color: #28a745;
  box-shadow: 0 6px 0 #218838;
}
.btn-start:hover { background-color: #218838; }

.btn-stop {
  background-color: #dc3545;
  box-shadow: 0 6px 0 #c82333;
}
.btn-stop:hover { background-color: #c82333; }

.text-section label {
  font-size: 28px;
  font-weight: bold;
  display: block;
  margin-bottom: 15px;
}

textarea {
  width: 100%;
  height: 250px;
  font-size: 32px;
  padding: 20px;
  border: 3px solid #0056b3;
  border-radius: 8px;
  box-sizing: border-box;
  font-family: inherit;
  resize: vertical;
}

.btn-download {
  margin-top: 15px;
  width: 100%;
  padding: 15px;
  font-size: 24px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.btn-download:hover:not(:disabled) { background-color: #5a6268; }
.btn-download:disabled { opacity: 0.5; cursor: not-allowed; }

/* Адаптив для телефонов */
@media (max-width: 600px) {
  .simple-header { flex-direction: column; text-align: center; }
  .btn { font-size: 24px; padding: 20px; }
  textarea { font-size: 24px; }
}
</style>
