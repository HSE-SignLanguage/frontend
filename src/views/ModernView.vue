<template>
  <div class="app-container">
    <!-- Живой фон -->
    <div class="ambient-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <!-- Шапка -->
    <header>
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>
        </svg>
        Sigma<span>Sign</span>
      </div>
      <nav>
        <button @click="setMode('camera')" :class="{ active: mode === 'camera' }">Live Camera</button>
        <button @click="setMode('upload')" :class="{ active: mode === 'upload' }">Upload File</button>
        <router-link to="/simple/" class="nav-link">Simple Mode</router-link>
      </nav>
    </header>

    <main class="content-wrapper">
      
      <!-- РЕЖИМ КАМЕРЫ -->
      <div v-show="mode === 'camera'" class="video-viewport">
        <div class="scanlines"></div>
        
        <!-- UI поверх видео -->
        <div class="video-ui-top">
          <div class="recording-dot" :class="{ active: isStreaming }"></div>
          <span>{{ statusText }}</span>
        </div>

        <!-- Рамка трекинга (декоративная) -->
        <div class="hand-tracking-box" :class="{ active: isStreaming }"></div>
        
        <!-- Видео элемент -->
        <video ref="videoEl" autoplay playsinline muted></video>
        <!-- Скрытый холст для сжатия кадров -->
        <canvas ref="canvasEl" width="854" height="480" style="display:none;"></canvas>

        <!-- Кнопки управления -->
        <div class="video-controls">
          <button class="stream-btn" :class="{ 'is-recording': isStreaming }" @click="toggleStream">
            <span v-if="!isStreaming">▶ Start Stream</span>
            <span v-else>■ Stop Stream</span>
          </button>
        </div>
      </div>

      <!-- РЕЖИМ ЗАГРУЗКИ (Заготовка) -->
      <div v-show="mode === 'upload'" class="video-viewport upload-viewport">
        <div class="upload-zone" @click="triggerFileUpload" v-if="!uploadedFile">
          <input type="file" ref="fileInput" accept="video/*" @change="handleFileSelect" style="display:none">
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#a0a0a0" stroke-width="1">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <div class="upload-text">Нажмите для выбора видео</div>
          <div class="upload-subtext">MP4, WEBM (API Integration Pending)</div>
        </div>
        
        <div v-else class="file-preview">
          <p class="file-name">Файл: {{ uploadedFile.name }}</p>
          <div class="btn-group">
            <button class="stream-btn" @click="processUpload">Обработать</button>
            <button class="text-btn" @click="uploadedFile = null">Отмена</button>
          </div>
        </div>
      </div>

      <!-- ПАНЕЛЬ РАСШИФРОВКИ -->
      <section class="transcription-panel">
        <div class="panel-header">
          <div class="panel-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            Live Transcription
          </div>
          <button class="export-btn" @click="downloadText">Save TXT</button>
        </div>
        <textarea class="transcription-area" readonly v-model="transcribedText" placeholder="Система ожидает видеопоток..."></textarea>
      </section>

    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// --- Конфигурация ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const FPS = 24;

// --- State ---
const mode = ref('camera'); // 'camera' | 'upload'
const isStreaming = ref(false);
const statusText = ref('Ready');
const transcribedText = ref('');
const uploadedFile = ref(null);

// --- Refs ---
const videoEl = ref(null);
const canvasEl = ref(null);
const fileInput = ref(null);

// --- WebSocket Vars ---
let ws = null;
let intervalId = null;

// --- Helper: URL Builder ---
const getWsUrl = () => {
  // Убираем слеш в конце, если есть
  let url = API_BASE.replace(/\/$/, '');
  
  // Меняем протокол
  if (url.startsWith('https')) {
    url = url.replace(/^https/, 'wss');
  } else {
    url = url.replace(/^http/, 'ws');
  }
  
  // Добавляем endpoint (согласно Swagger path: /socket)
  return `${url}/socket`;
};

// --- Lifecycle ---
onMounted(async () => {
  await initCamera();
});

onUnmounted(() => {
  stopStream();
});

// --- Camera Logic ---
async function initCamera() {
  if (mode.value !== 'camera') return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 }, 
        height: { ideal: 720 }, 
        facingMode: "user" 
      } 
    });
    if (videoEl.value) {
      videoEl.value.srcObject = stream;
    }
  } catch (err) {
    console.error("Camera Init Error:", err);
    statusText.value = "Camera Error";
  }
}

function setMode(newMode) {
  mode.value = newMode;
  if (newMode === 'camera') {
    initCamera();
  } else {
    stopStream();
    if (videoEl.value && videoEl.value.srcObject) {
      const tracks = videoEl.value.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoEl.value.srcObject = null;
    }
  }
}

function toggleStream() {
  if (isStreaming.value) stopStream();
  else startStream();
}

function startStream() {
  const wsUrl = getWsUrl();
  console.log('Connecting to WS:', wsUrl);
  
  statusText.value = "Connecting...";
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    isStreaming.value = true;
    statusText.value = "Streaming";
    transcribedText.value = ""; // Очистка при новом старте
    
    // Запуск цикла отправки кадров (24 FPS -> ~41ms)
    intervalId = setInterval(sendFrame, 1000 / FPS);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.text) {
        transcribedText.value += data.text + " ";
        // Автоскролл вниз
        const area = document.querySelector('.transcription-area');
        if(area) area.scrollTop = area.scrollHeight;
      }
    } catch (e) {
      console.error("WS Parse Error", e);
    }
  };

  ws.onerror = (err) => {
    console.error("WS Error:", err);
    statusText.value = "Connection Error";
    stopStream();
  };
  
  ws.onclose = () => {
    if (isStreaming.value) {
      statusText.value = "Disconnected";
      stopStream();
    }
  };
}

function stopStream() {
  isStreaming.value = false;
  statusText.value = "Ready";
  
  if (intervalId) clearInterval(intervalId);
  if (ws) {
    ws.close();
    ws = null;
  }
}

function sendFrame() {
  if (!videoEl.value || !canvasEl.value || !ws || ws.readyState !== WebSocket.OPEN) return;

  const ctx = canvasEl.value.getContext('2d');
  // Рисуем текущий кадр видео на канвас 854x480
  ctx.drawImage(videoEl.value, 0, 0, 854, 480);
  
  // Конвертируем в Blob (JPEG 0.5 для скорости)
  canvasEl.value.toBlob((blob) => {
    if (blob && ws.readyState === WebSocket.OPEN) {
      ws.send(blob);
    }
  }, 'image/jpeg', 0.5);
}

// --- Upload Logic ---
function triggerFileUpload() {
  if (fileInput.value) fileInput.value.click();
}

function handleFileSelect(e) {
  if (e.target.files.length) {
    uploadedFile.value = e.target.files[0];
  }
}

function processUpload() {
  if (!uploadedFile.value) return;
  alert(`Файл "${uploadedFile.value.name}" готов к отправке. \n(Функционал загрузки файлов еще не подключен к бэкенду).`);
  // Здесь будет fetch запрос на /upload
}

// --- Export ---
function downloadText() {
  if (!transcribedText.value) return;
  const blob = new Blob([transcribedText.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transcription_${Date.now()}.txt`;
  a.click();
}
</script>

<style scoped>
/* --- Шрифты --- */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=JetBrains+Mono:wght@400;700&display=swap');

/* --- Общие --- */
.app-container {
  font-family: 'Inter', sans-serif;
  background: #0f0f13;
  color: white;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
  position: relative;
  overflow: hidden;
}

/* --- Фон --- */
.ambient-bg {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;
  background: radial-gradient(circle at 50% 50%, #1a1a2e, #000);
  pointer-events: none;
}
.orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.6; }
.orb-1 { width: 500px; height: 500px; background: #4a00e0; top: -20%; left: -10%; }
.orb-2 { width: 400px; height: 400px; background: #00f2ff; bottom: -20%; right: -10%; opacity: 0.3; }
.orb-3 { width: 300px; height: 300px; background: #00ff88; top: 40%; left: 40%; opacity: 0.2; }

/* --- Header --- */
header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 24px; height: 60px; z-index: 10;
  background: rgba(255,255,255,0.05); backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
}

.logo { 
  font-family: 'JetBrains Mono'; font-weight: 700; font-size: 1.2rem;
  display: flex; gap: 10px; align-items: center; 
}
.logo span { color: #00f2ff; text-shadow: 0 0 10px rgba(0,242,255,0.5); }

nav button, .nav-link {
  background: none; border: none; color: #a0a0a0; font-size: 0.9rem; margin-left: 15px;
  cursor: pointer; text-decoration: none; padding: 6px 12px; border-radius: 6px;
  transition: all 0.3s; font-family: 'Inter', sans-serif;
}
nav button.active, .nav-link:hover {
  color: white; background: rgba(255,255,255,0.1);
  text-shadow: 0 0 10px rgba(255,255,255,0.5);
}

/* --- Layout --- */
.content-wrapper {
  display: flex; gap: 20px; flex: 1; z-index: 10; height: calc(100% - 80px);
}

/* --- Video Section --- */
.video-viewport {
  flex: 3; position: relative; background: #000; border-radius: 20px;
  overflow: hidden; border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  display: flex; flex-direction: column; justify-content: center; align-items: center;
}
.scanlines {
  position: absolute; inset: 0; pointer-events: none; z-index: 2;
  background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2));
  background-size: 100% 4px; opacity: 0.3;
}
video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }

/* UI Elements inside Video */
.video-ui-top {
  position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.6);
  padding: 8px 16px; border-radius: 30px; display: flex; align-items: center; gap: 10px; z-index: 5;
  border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(4px);
}
.recording-dot { width: 10px; height: 10px; background: #555; border-radius: 50%; transition: 0.3s; }
.recording-dot.active { background: #ff4444; box-shadow: 0 0 10px #ff4444; animation: pulse 1.5s infinite; }
.video-ui-top span { font-size: 0.85rem; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }

@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

.video-controls {
  position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 5;
}
.stream-btn {
  background: rgba(0,0,0,0.6); border: 1px solid #00ff88; color: #00ff88;
  padding: 14px 40px; border-radius: 30px; font-weight: 600; cursor: pointer;
  transition: all 0.3s ease; font-size: 1rem; backdrop-filter: blur(4px);
  text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 10px;
}
.stream-btn:hover { background: #00ff88; color: black; box-shadow: 0 0 25px rgba(0,255,136,0.4); }
.stream-btn.is-recording { border-color: #ff4444; color: #ff4444; }
.stream-btn.is-recording:hover { background: #ff4444; color: white; box-shadow: 0 0 25px rgba(255,68,68,0.4); }

.hand-tracking-box {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 300px; height: 300px; border: 2px dashed rgba(255,255,255,0.1);
  border-radius: 12px; transition: 0.5s; pointer-events: none; z-index: 3;
}
.hand-tracking-box.active { border-color: #00f2ff; box-shadow: 0 0 20px rgba(0,242,255,0.2), inset 0 0 20px rgba(0,242,255,0.1); }

/* --- Upload Mode --- */
.upload-viewport { background: rgba(0,0,0,0.3); }
.upload-zone {
  border: 2px dashed rgba(255,255,255,0.2); padding: 60px; border-radius: 20px;
  text-align: center; cursor: pointer; transition: 0.3s;
  display: flex; flex-direction: column; align-items: center; gap: 15px;
}
.upload-zone:hover { border-color: #00f2ff; background: rgba(0,242,255,0.05); }
.upload-text { font-size: 1.2rem; font-weight: 600; }
.upload-subtext { color: #888; font-size: 0.9rem; }
.file-name { font-size: 1.2rem; margin-bottom: 20px; color: #00ff88; }
.btn-group { display: flex; gap: 15px; }
.text-btn { background: none; border: 1px solid rgba(255,255,255,0.3); color: white; padding: 12px 24px; border-radius: 30px; cursor: pointer; }
.text-btn:hover { background: rgba(255,255,255,0.1); }

/* --- Transcription Section --- */
.transcription-panel {
  flex: 1; background: rgba(255,255,255,0.03); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 20px;
  display: flex; flex-direction: column;
}
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.panel-title { color: #a0a0a0; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 1px; }
.transcription-area {
  flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px; color: #fff; padding: 16px; font-size: 1.1rem; line-height: 1.6;
  resize: none; outline: none; font-family: 'Inter', sans-serif;
}
.transcription-area:focus { border-color: rgba(0,242,255,0.5); }
.export-btn {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white;
  padding: 6px 16px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; transition: 0.3s;
}
.export-btn:hover { background: #00f2ff; color: black; border-color: #00f2ff; }

/* --- Mobile --- */
@media (max-width: 900px) {
  .content-wrapper { flex-direction: column; }
  .video-viewport { flex: none; height: 350px; }
}
</style>
