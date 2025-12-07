<template>
  <div class="app-container">
    <div class="ambient-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <header>
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
        Sigma<span>Sign</span>
      </div>
      <nav>
        <button @click="mode = 'camera'" :class="{ active: mode === 'camera' }">Live Camera</button>
        <button @click="mode = 'upload'" :class="{ active: mode === 'upload' }">Upload File</button>
        <router-link to="/simple/">Simple Mode</router-link>
      </nav>
    </header>

    <main class="content-wrapper">
      
      <!-- MODE: CAMERA -->
      <div v-show="mode === 'camera'" class="video-viewport">
        <div class="scanlines"></div>
        <div class="video-ui-top">
          <div class="recording-dot" :class="{ active: isStreaming }"></div>
          <span>{{ statusText }}</span>
        </div>

        <div class="hand-tracking-box" :class="{ active: isStreaming }"></div>
        <video ref="videoEl" autoplay playsinline muted></video>
        <!-- Скрытый canvas для ресайза кадров -->
        <canvas ref="canvasEl" width="854" height="480" style="display:none;"></canvas>

        <div class="video-controls">
          <button class="stream-btn" :class="{ 'is-recording': isStreaming }" @click="toggleStream">
            <span v-if="!isStreaming">▶ Старт</span>
            <span v-else>■ Стоп</span>
          </button>
        </div>
      </div>

      <!-- MODE: UPLOAD (Заготовка) -->
      <div v-show="mode === 'upload'" class="video-viewport upload-viewport">
        <div class="upload-zone" @click="$refs.fileInput.click()" v-if="!uploadedFile">
          <input type="file" ref="fileInput" accept="video/*" @change="handleFileSelect" style="display:none">
          <div class="upload-text">Нажмите для выбора видео</div>
          <div class="upload-subtext">MP4, WEBM (Заготовка API)</div>
        </div>
        <div v-else class="file-preview">
          <p>Выбран файл: {{ uploadedFile.name }}</p>
          <button class="stream-btn" @click="processUpload">Отправить на обработку</button>
          <button class="text-btn" @click="uploadedFile = null">Отмена</button>
        </div>
      </div>

      <!-- TRANSCRIPTION PANEL -->
      <section class="transcription-panel">
        <div class="panel-header">
          <div class="panel-title">Распознанный текст</div>
          <button class="export-btn" @click="downloadText">Экспорт TXT</button>
        </div>
        <textarea class="transcription-area" readonly v-model="transcribedText" placeholder="Ожидание данных..."></textarea>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// State
const mode = ref('camera'); // 'camera' | 'upload'
const isStreaming = ref(false);
const statusText = ref('Ожидание');
const transcribedText = ref('');
const uploadedFile = ref(null);

// Refs
const videoEl = ref(null);
const canvasEl = ref(null);
const fileInput = ref(null);

// WebSocket
let ws = null;
let intervalId = null;
const API_WS_URL = 'wss://hack.eferzo.xyz/api/socket'; // SSL WebSocket
const FPS = 24;

// --- Camera Logic ---
onMounted(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } 
    });
    if (videoEl.value) videoEl.value.srcObject = stream;
  } catch (err) {
    console.error("Camera access denied:", err);
    statusText.value = "Ошибка доступа к камере";
  }
});

onUnmounted(() => {
  stopStream();
});

function toggleStream() {
  if (isStreaming.value) stopStream();
  else startStream();
}

function startStream() {
  // 1. Connect WS
  ws = new WebSocket(API_WS_URL);
  
  ws.onopen = () => {
    isStreaming.value = true;
    statusText.value = "Трансляция";
    transcribedText.value = "";
    
    // 2. Start Frame Loop (24 FPS)
    intervalId = setInterval(sendFrame, 1000 / FPS);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.text) {
        transcribedText.value += data.text + " ";
        // Auto-scroll
        const area = document.querySelector('.transcription-area');
        if(area) area.scrollTop = area.scrollHeight;
      }
    } catch (e) {
      console.error("Error parsing WS message", e);
    }
  };

  ws.onerror = (err) => {
    console.error("WS Error:", err);
    statusText.value = "Ошибка соединения";
    stopStream();
  };
  
  ws.onclose = () => stopStream();
}

function stopStream() {
  isStreaming.value = false;
  statusText.value = "Ожидание";
  if (intervalId) clearInterval(intervalId);
  if (ws) ws.close();
}

function sendFrame() {
  if (!videoEl.value || !canvasEl.value || ws.readyState !== WebSocket.OPEN) return;

  const ctx = canvasEl.value.getContext('2d');
  // Resize to 480p (854x480)
  ctx.drawImage(videoEl.value, 0, 0, 854, 480);
  
  canvasEl.value.toBlob((blob) => {
    if (blob) ws.send(blob);
  }, 'image/jpeg', 0.6); // JPEG quality 0.6 for speed
}

// --- Upload Logic (Skeleton) ---
function handleFileSelect(e) {
  if (e.target.files.length) uploadedFile.value = e.target.files[0];
}

async function processUpload() {
  if (!uploadedFile.value) return;
  
  transcribedText.value = "Загрузка файла... (Заглушка)";
  
  // Пример будущей реализации:
  /*
  const formData = new FormData();
  formData.append('video', uploadedFile.value);
  try {
    const res = await fetch('https://hack.eferzo.xyz/api/upload', {
       method: 'POST', body: formData 
    });
    const result = await res.json();
    console.log(result);
  } catch (e) { ... }
  */
}

// --- Utilities ---
function downloadText() {
  const blob = new Blob([transcribedText.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sign_language_${Date.now()}.txt`;
  a.click();
}
</script>

<style scoped>
/* Modern / Cyberpunk Styles */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=JetBrains+Mono:wght@400;700&display=swap');

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
}

/* Ambient Background */
.ambient-bg {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;
  background: radial-gradient(circle at 50% 50%, #1a1a2e, #000);
  overflow: hidden; pointer-events: none;
}
.orb {
  position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.6;
}
.orb-1 { width: 500px; height: 500px; background: #4a00e0; top: -100px; left: -100px; }
.orb-2 { width: 400px; height: 400px; background: #00f2ff; bottom: -100px; right: -100px; opacity: 0.3; }

header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 24px; height: 60px; z-index: 10;
  background: rgba(255,255,255,0.05); backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
}
.logo { font-family: 'JetBrains Mono'; font-weight: 700; display: flex; gap: 8px; align-items: center; }
.logo span { color: #00f2ff; }

nav button, nav a {
  background: none; border: none; color: #a0a0a0; font-size: 0.9rem; margin-left: 20px;
  cursor: pointer; text-decoration: none; padding: 5px 10px; transition: 0.3s;
}
nav button.active, nav a:hover { color: white; text-shadow: 0 0 10px rgba(255,255,255,0.5); }

.content-wrapper {
  display: flex; gap: 20px; flex: 1; z-index: 10; height: calc(100% - 80px);
}

/* Video Section */
.video-viewport {
  flex: 3; position: relative; background: black; border-radius: 20px;
  overflow: hidden; border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  display: flex; flex-direction: column; justify-content: center;
}
video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }

.video-ui-top {
  position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.6);
  padding: 6px 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; z-index: 5;
}
.recording-dot { width: 8px; height: 8px; background: #555; border-radius: 50%; }
.recording-dot.active { background: #ff4444; box-shadow: 0 0 8px #ff4444; }

.video-controls {
  position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 5;
}
.stream-btn {
  background: rgba(0,0,0,0.5); border: 1px solid #00ff88; color: #00ff88;
  padding: 12px 32px; border-radius: 30px; font-weight: 600; cursor: pointer;
  transition: 0.3s; font-size: 1rem;
}
.stream-btn:hover { background: #00ff88; color: black; box-shadow: 0 0 20px rgba(0,255,136,0.4); }
.stream-btn.is-recording { border-color: #ff4444; color: #ff4444; }
.stream-btn.is-recording:hover { background: #ff4444; color: white; box-shadow: 0 0 20px rgba(255,68,68,0.4); }

.hand-tracking-box {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 300px; height: 300px; border: 2px dashed rgba(255,255,255,0.2);
  border-radius: 12px; transition: 0.5s; pointer-events: none;
}
.hand-tracking-box.active { border-color: #00f2ff; box-shadow: 0 0 20px rgba(0,242,255,0.2); }

/* Transcription Section */
.transcription-panel {
  flex: 1; background: rgba(255,255,255,0.05); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 20px;
  display: flex; flex-direction: column;
}
.panel-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
.transcription-area {
  flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px; color: white; padding: 15px; font-size: 1.1rem; resize: none;
}
.export-btn {
  background: rgba(255,255,255,0.1); border: none; color: white;
  padding: 5px 15px; border-radius: 8px; cursor: pointer;
}
.export-btn:hover { background: #00f2ff; color: black; }

/* Upload Styles */
.upload-viewport { align-items: center; }
.upload-zone {
  border: 2px dashed rgba(255,255,255,0.3); padding: 40px; border-radius: 20px;
  text-align: center; cursor: pointer; transition: 0.3s;
}
.upload-zone:hover { border-color: #00f2ff; background: rgba(0,242,255,0.05); }
.file-preview { text-align: center; }
.text-btn { background: none; border: none; color: #aaa; margin-top: 10px; cursor: pointer; display: block; width: 100%; }

@media (max-width: 800px) {
  .content-wrapper { flex-direction: column; }
  .video-viewport { flex: none; height: 300px; }
}
</style>