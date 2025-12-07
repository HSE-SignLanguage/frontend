<template>
  <div class="app-container">
    <!-- Живой фон -->
    <div class="ambient-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <!-- Десктопный хедер (только для ПК) -->
    <header class="desktop-header">
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>
        </svg>
        SIGMA<span>SIGN</span>
      </div>
      <nav>
        <button @click="setMode('camera')" :class="{ active: mode === 'camera' }">В реальном времени</button>
        <button @click="setMode('upload')" :class="{ active: mode === 'upload' }">Из файла</button>
        <router-link to="/simple/" class="nav-link">Для пенсионеров</router-link>
      </nav>
    </header>

    <!-- Мобильный хедер (только для мобильных) -->
    <header class="mobile-header">
      <button class="menu-toggle" @click="toggleSidebar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
    </header>

    <!-- Сайдбар для мобильных -->
    <div class="mobile-sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-overlay" @click="toggleSidebar"></div>
      <div class="sidebar-content">
        <div class="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/>
            <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>
          </svg>
          SIGMA<span>SIGN</span>
        </div>
        <nav class="sidebar-nav">
          <button @click="setMode('camera'); toggleSidebar();" :class="{ active: mode === 'camera' }">В реальном времени</button>
          <button @click="setMode('upload'); toggleSidebar();" :class="{ active: mode === 'upload' }">Из файла</button>
          <router-link to="/simple/" class="nav-link" @click="toggleSidebar">Для пенсионеров</router-link>
        </nav>
      </div>
    </div>

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
            <span v-if="!isStreaming">▶ Старт</span>
            <span v-else>■ Стоп</span>
          </button>
        </div>
      </div>

      <!-- РЕЖИМ ЗАГРУЗКИ -->
      <div v-show="mode === 'upload'" class="video-viewport upload-viewport">
        <div v-if="!uploadedFile && !jobId" class="upload-zone" @click="triggerFileUpload" :class="{ 'is-dragover': isDragOver }" 
             @dragover.prevent="handleDragOver"
             @dragleave.prevent="handleDragLeave"
             @drop.prevent="handleDrop">
          <input type="file" ref="fileInput" accept="video/*" @change="handleFileSelect" style="display:none">
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#a0a0a0" stroke-width="1">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <div class="upload-text">Нажмите для выбора видео</div>
          <div class="upload-subtext">или перетащите файл сюда</div>
          <div class="upload-subtext">MP4, WEBM, AVI, MOV</div>
        </div>
        
        <div v-else-if="uploadedFile && !jobId" class="file-preview">
          <div class="file-info">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <div class="file-details">
              <p class="file-name">{{ uploadedFile.name }}</p>
              <p class="file-size">{{ formatFileSize(uploadedFile.size) }}</p>
            </div>
          </div>
          
          <div class="upload-progress" v-if="uploadProgress > 0">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <div class="progress-text">{{ uploadProgress }}%</div>
          </div>
          
          <div class="btn-group">
            <button class="stream-btn" @click="uploadVideo" :disabled="isUploading">
              {{ isUploading ? 'Загрузка...' : 'Отправить на обработку' }}
            </button>
            <button class="text-btn" @click="cancelUpload" :disabled="isUploading">Отмена</button>
          </div>
        </div>
        
        <div v-else-if="jobId" class="job-status">
          <div class="status-header">
            <h3>Обработка видео</h3>
            <div class="job-id">ID: {{ jobId.substring(0, 8) }}...</div>
          </div>
          
          <div class="status-info">
            <div class="status-indicator" :class="jobStatus">
              <div class="status-dot"></div>
              <span>{{ getStatusText(jobStatus) }}</span>
            </div>
            
            <div v-if="jobStatus === 'processing'" class="progress-details">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: processingProgress + '%' }"></div>
              </div>
              <div class="progress-text">
                <span v-if="jobData">
                  Кадры: {{ jobData.processed_batches || 0 }} / {{ jobData.total_batches || '?' }}
                </span>
                <span v-else>Загрузка...</span>
              </div>
            </div>
            
            <div v-if="jobError" class="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4444">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Ошибка: {{ jobError }}</span>
            </div>
            
            <div v-if="jobStatus === 'completed'" class="completion-info">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <p>Обработка завершена!</p>
            </div>
          </div>
          
          <div class="btn-group">
            <button v-if="jobStatus === 'completed'" class="stream-btn" @click="loadTranscription">
              Показать расшифровку
            </button>
            <button v-else-if="jobStatus === 'failed'" class="stream-btn" @click="retryProcessing">
              Повторить
            </button>
            <button class="text-btn" @click="resetUpload">Новое видео</button>
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
            Расшифровка
            <span v-if="mode === 'upload' && jobId" class="job-badge">
              {{ jobId.substring(0, 6) }}...
            </span>
          </div>
          <div class="panel-actions">
            <button v-if="isPolling" class="polling-btn" @click="stopPolling">
              <span class="polling-dot"></span>
              Остановить опрос
            </button>
            <button class="export-btn" @click="downloadText" :disabled="!transcribedText">
              Save TXT
            </button>
          </div>
        </div>
        <textarea class="transcription-area" readonly v-model="transcribedText" 
                  placeholder="Система ожидает видеопоток..."></textarea>
      </section>

    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// --- Конфигурация ---
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const FPS = 24;

// --- State ---
const mode = ref('camera'); // 'camera' | 'upload'
const isStreaming = ref(false);
const statusText = ref('Ready');
const transcribedText = ref('');
const uploadedFile = ref(null);
const jobId = ref(null);
const jobStatus = ref(null);
const jobData = ref(null);
const jobError = ref(null);
const uploadProgress = ref(0);
const isUploading = ref(false);
const isPolling = ref(false);
const isDragOver = ref(false);
const processingProgress = ref(0);
const sidebarOpen = ref(false);

// --- Refs ---
const videoEl = ref(null);
const canvasEl = ref(null);
const fileInput = ref(null);

// --- WebSocket Vars ---
let ws = null;
let intervalId = null;
let pollInterval = null;

// --- Helper: URL Builder ---
const getWsUrl = () => {
  let url = API_BASE.replace(/\/$/, '');
  if (url.startsWith('https')) {
    url = url.replace(/^https/, 'wss');
  } else {
    url = url.replace(/^http/, 'ws');
  }
  return `${url}/socket`;
};

// --- Helper: API URL ---
const getApiUrl = (endpoint) => {
  return `${API_BASE.replace(/\/$/, '')}${endpoint}`;
};

// --- Lifecycle ---
onMounted(async () => {
  if (mode.value === 'camera') {
    await initCamera();
  }
});

onUnmounted(() => {
  stopStream();
  stopPolling();
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
  stopPolling();
  
  if (newMode === 'camera') {
    resetUpload();
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
    transcribedText.value = "";
    
    intervalId = setInterval(sendFrame, 1000 / FPS);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.text) {
        transcribedText.value += data.text + " ";
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
  ctx.drawImage(videoEl.value, 0, 0, 854, 480);
  
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

function handleDragOver(e) {
  e.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave() {
  isDragOver.value = false;
}

function handleDrop(e) {
  e.preventDefault();
  isDragOver.value = false;
  
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.startsWith('video/')) {
    uploadedFile.value = files[0];
  } else {
    alert('Пожалуйста, выберите видео файл');
  }
}

function handleFileSelect(e) {
  if (e.target.files.length) {
    uploadedFile.value = e.target.files[0];
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function uploadVideo() {
  if (!uploadedFile.value) return;
  
  isUploading.value = true;
  uploadProgress.value = 0;
  
  const formData = new FormData();
  formData.append('video', uploadedFile.value);
  formData.append('interval', '1');
  
  try {
    const response = await fetch(getApiUrl('/upload'), {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка загрузки: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.job_id) {
      jobId.value = data.job_id;
      jobStatus.value = 'queued';
      startPolling();
    } else {
      throw new Error('Не получен ID задания');
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    alert(`Ошибка загрузки: ${error.message}`);
    jobError.value = error.message;
  } finally {
    isUploading.value = false;
    uploadProgress.value = 100;
  }
}

async function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  isPolling.value = true;
  
  // Первый опрос сразу
  await pollJobStatus();
  
  // Затем каждые 2 секунды
  pollInterval = setInterval(async () => {
    await pollJobStatus();
  }, 2000);
}

async function pollJobStatus() {
  if (!jobId.value) return;
  
  try {
    const response = await fetch(getApiUrl(`/job/${jobId.value}`));
    
    if (!response.ok) {
      if (response.status === 404) {
        jobStatus.value = 'failed';
        jobError.value = 'Задание не найдено';
        stopPolling();
      }
      return;
    }
    
    const data = await response.json();
    jobData.value = data;
    jobStatus.value = data.status;
    jobError.value = data.error || null;
    
    // Обновляем прогресс
    if (data.total_batches && data.processed_batches) {
      processingProgress.value = Math.round((data.processed_batches / data.total_batches) * 100);
    }
    
    // Если обработка завершена
    if (data.status === 'completed') {
      stopPolling();
      // Автоматически загружаем текст
      loadTranscription();
    } else if (data.status === 'failed') {
      stopPolling();
    }
    
  } catch (error) {
    console.error('Polling error:', error);
    jobError.value = 'Ошибка получения статуса';
  }
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  isPolling.value = false;
}

function loadTranscription() {
  if (jobData.value && jobData.value.full_text) {
    transcribedText.value = jobData.value.full_text;
  } else if (jobData.value && jobData.value.transcription) {
    transcribedText.value = jobData.value.transcription.join(' ');
  }
}

function retryProcessing() {
  if (uploadedFile.value) {
    jobId.value = null;
    jobStatus.value = null;
    jobData.value = null;
    jobError.value = null;
    processingProgress.value = 0;
    transcribedText.value = '';
    uploadVideo();
  }
}

function cancelUpload() {
  resetUpload();
}

function resetUpload() {
  uploadedFile.value = null;
  jobId.value = null;
  jobStatus.value = null;
  jobData.value = null;
  jobError.value = null;
  uploadProgress.value = 0;
  isUploading.value = false;
  isDragOver.value = false;
  processingProgress.value = 0;
  stopPolling();
  
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

function getStatusText(status) {
  const statusMap = {
    'queued': 'В очереди',
    'processing': 'Обработка...',
    'completed': 'Завершено',
    'failed': 'Ошибка'
  };
  return statusMap[status] || status;
}

// --- Sidebar ---
function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
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

/* --- Десктопный хедер (только для ПК) --- */
.desktop-header {
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

.desktop-header nav button, .nav-link {
  background: none; border: none; color: #a0a0a0; font-size: 0.9rem; margin-left: 15px;
  cursor: pointer; text-decoration: none; padding: 6px 12px; border-radius: 6px;
  transition: all 0.3s; font-family: 'Inter', sans-serif;
}
.desktop-header nav button.active, .nav-link:hover {
  color: white; background: rgba(255,255,255,0.1);
  text-shadow: 0 0 10px rgba(255,255,255,0.5);
}

/* --- Мобильный хедер (скрыт на ПК) --- */
.mobile-header {
  display: none;
}

/* --- Сайдбар для мобильных (скрыт на ПК) --- */
.mobile-sidebar {
  display: none;
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
  padding: 30px;
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
.stream-btn:hover:not(:disabled) { background: #00ff88; color: black; box-shadow: 0 0 25px rgba(0,255,136,0.4); }
.stream-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.stream-btn.is-recording { border-color: #ff4444; color: #ff4444; }
.stream-btn.is-recording:hover { background: #ff4444; color: white; box-shadow: 0 0 25px rgba(255,68,68,0.4); }

.hand-tracking-box {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 300px; height: 300px; border: 2px dashed rgba(255,255,255,0.1);
  border-radius: 12px; transition: 0.5s; pointer-events: none; z-index: 3;
}
.hand-tracking-box.active { border-color: #00f2ff; box-shadow: 0 0 20px rgba(0,242,255,0.2), inset 0 0 20px rgba(0,242,255,0.1); }

/* --- Upload Mode --- */
.upload-viewport { 
  background: rgba(0,0,0,0.3); 
  display: flex; 
  flex-direction: column;
  justify-content: center;
}

.upload-zone {
  border: 2px dashed rgba(255,255,255,0.2); 
  padding: 60px; 
  border-radius: 20px;
  text-align: center; 
  cursor: pointer; 
  transition: all 0.3s;
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  gap: 15px;
  width: 100%;
}
.upload-zone:hover, .upload-zone.is-dragover {
  border-color: #00f2ff; 
  background: rgba(0,242,255,0.05);
}
.upload-text { 
  font-size: 1.2rem; 
  font-weight: 600; 
  margin-top: 10px;
}
.upload-subtext { 
  color: #888; 
  font-size: 0.9rem; 
}

.file-preview {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
}

.file-details {
  flex: 1;
}

.file-name {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 5px 0;
  color: #fff;
}

.file-size {
  color: #888;
  font-size: 0.9rem;
  margin: 0;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.progress-bar {
  height: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00f2ff, #00ff88);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-size: 0.9rem;
  color: #aaa;
}

.btn-group {
  display: flex;
  gap: 15px;
  margin-top: 10px;
}

.text-btn {
  background: none; 
  border: 1px solid rgba(255,255,255,0.3); 
  color: white; 
  padding: 12px 24px; 
  border-radius: 30px; 
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s;
}
.text-btn:hover:not(:disabled) { 
  background: rgba(255,255,255,0.1); 
}
.text-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.job-status {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.status-header h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.job-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: #888;
  background: rgba(255,255,255,0.05);
  padding: 4px 8px;
  border-radius: 4px;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
}

.status-indicator.queued {
  border-color: #ffaa00;
}

.status-indicator.processing {
  border-color: #00f2ff;
}

.status-indicator.completed {
  border-color: #00ff88;
}

.status-indicator.failed {
  border-color: #ff4444;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #888;
}

.status-indicator.queued .status-dot {
  background: #ffaa00;
  animation: pulse 2s infinite;
}

.status-indicator.processing .status-dot {
  background: #00f2ff;
  animation: pulse 1s infinite;
}

.status-indicator.completed .status-dot {
  background: #00ff88;
}

.status-indicator.failed .status-dot {
  background: #ff4444;
}

.progress-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: rgba(255,68,68,0.1);
  border: 1px solid rgba(255,68,68,0.3);
  border-radius: 12px;
  color: #ff8888;
}

.completion-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 30px;
  background: rgba(0,255,136,0.05);
  border: 1px solid rgba(0,255,136,0.2);
  border-radius: 12px;
  text-align: center;
}

.completion-info p {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #00ff88;
}

/* --- Transcription Section --- */
.transcription-panel {
  flex: 1; 
  background: rgba(255,255,255,0.03); 
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1); 
  border-radius: 20px; 
  padding: 20px;
  display: flex; 
  flex-direction: column;
}

.panel-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 15px; 
}

.panel-title { 
  color: #a0a0a0; 
  font-size: 0.9rem; 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  text-transform: uppercase; 
  letter-spacing: 1px; 
}

.job-badge {
  background: rgba(0,242,255,0.2);
  color: #00f2ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
}

.panel-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.polling-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.3s;
}

.polling-btn:hover {
  background: rgba(255,255,255,0.1);
}

.polling-dot {
  width: 8px;
  height: 8px;
  background: #00f2ff;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

.transcription-area {
  flex: 1; 
  background: rgba(0,0,0,0.2); 
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px; 
  color: #fff; 
  padding: 16px; 
  font-size: 1.1rem; 
  line-height: 1.6;
  resize: none; 
  outline: none; 
  font-family: 'Inter', sans-serif;
}
.transcription-area:focus { 
  border-color: rgba(0,242,255,0.5); 
}

.export-btn {
  background: rgba(255,255,255,0.05); 
  border: 1px solid rgba(255,255,255,0.1); 
  color: white;
  padding: 6px 16px; 
  border-radius: 8px; 
  cursor: pointer; 
  font-size: 0.8rem; 
  transition: 0.3s;
}
.export-btn:hover:not(:disabled) { 
  background: #00f2ff; 
  color: black; 
  border-color: #00f2ff; 
}
.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==================== МОБИЛЬНАЯ ВЕРСИЯ ==================== */
@media (max-width: 900px) {
  /* Скрываем десктопный хедер на мобильных */
  .desktop-header {
    display: none;
  }

  /* Показываем мобильный хедер */
  .mobile-header {
    display: flex;
    align-items: center;
    padding: 0 16px;
    height: 60px;
    z-index: 100;
  }

  .menu-toggle {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.1);
  }

  /* Сайдбар для мобильных - ИЗМЕНЕНИЯ: */
  .mobile-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: block;
    opacity: 0; /* Скрыт по умолчанию */
    visibility: hidden; /* Скрыт по умолчанию */
    transition: opacity 0.3s ease, visibility 0.3s ease;
  }

  .mobile-sidebar.open {
    opacity: 1; /* Показываем */
    visibility: visible; /* Показываем */
  }

  .sidebar-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .mobile-sidebar.open .sidebar-overlay {
    opacity: 1;
  }

  .sidebar-content {
    position: absolute;
    top: 0;
    left: -100%; /* Полностью скрыт за экраном */
    width: 280px;
    height: 100%;
    background: #0f0f13;
    border-right: 1px solid rgba(255,255,255,0.1);
    display: flex;
    flex-direction: column;
    transition: left 0.3s ease 0.1s; /* Задержка чтобы начать анимацию после появления */
    padding: 20px;
  }

  .mobile-sidebar.open .sidebar-content {
    left: 0; /* Показываем */
    transition: left 0.3s ease 0s; /* Без задержки при показе */
  }

  /* Остальные стили остаются без изменений */
  .sidebar-logo {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 1.3rem;
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 20px 0;
    margin-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .sidebar-logo span {
    color: #00f2ff;
    text-shadow: 0 0 10px rgba(0,242,255,0.5);
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sidebar-nav button,
  .sidebar-nav .nav-link {
    background: none;
    border: none;
    color: #a0a0a0;
    font-size: 1rem;
    cursor: pointer;
    text-align: left;
    padding: 12px 16px;
    border-radius: 8px;
    transition: all 0.3s;
    text-decoration: none;
    font-family: 'Inter', sans-serif;
  }

  .sidebar-nav button.active,
  .sidebar-nav .nav-link:hover,
  .sidebar-nav button:hover {
    color: white;
    background: rgba(255,255,255,0.1);
    text-shadow: 0 0 10px rgba(255,255,255,0.5);
  }

  /* Остальные мобильные стили (оригинальные) */
  .content-wrapper {
    flex-direction: column;
    height: calc(100% - 60px);
  }

  .video-viewport {
    flex: none;
    height: 350px;
    padding: 20px;
  }

  .upload-zone {
    padding: 30px;
  }

  .file-info {
    flex-direction: column;
    text-align: center;
  }

  .btn-group {
    flex-direction: column;
  }
}
</style>
