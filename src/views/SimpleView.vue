<template>
  <div class="simple-body">
    <a class="simple-skip-link" href="#simple-main">Перейти к переводчику</a>
    <header class="simple-header">
      <div class="simple-brand">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>
        </svg>
        <div>
          <h1>Sigma Sign</h1>
          <span>Упрощённый режим</span>
        </div>
      </div>
      <router-link to="/" class="back-link">
        ← Обычный режим
      </router-link>
    </header>

    <main id="simple-main" class="simple-main">
      <div 
        class="status-bar" 
        :class="simpleStatusClass"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span class="simple-status-dot" aria-hidden="true"></span>
        <div>
          <strong>{{ simpleStatusTitle }}</strong>
          <span>{{ simpleStatusDescription }}</span>
        </div>
      </div>

      <div class="video-container">
        <video ref="videoEl" autoplay playsinline muted></video>
        <canvas ref="canvasEl" width="854" height="480" style="display:none;"></canvas>
      </div>

      <div class="controls">
        <button v-if="streamState === 'idle'" class="btn btn-start" @click="startStream">
          ▶ Начать перевод
        </button>
        <button v-else-if="isConnecting" class="btn btn-stop" @click="stopStream">
          Отменить подключение
        </button>
        <button v-else class="btn btn-stop" @click="stopStream">
          ■ Остановить перевод
        </button>
      </div>

      <div class="text-section">
        <div class="text-heading">
          <label for="outText">Распознанный текст</label>
          <span>Текст появляется автоматически</span>
        </div>
        <textarea 
          id="outText"
          ref="textareaRef" 
          readonly 
          v-model="transcribedText"
          placeholder="Пока здесь пусто. Нажмите «Начать перевод» и покажите жест в камеру."
        ></textarea>
        
        <button class="btn-download" @click="downloadText" :disabled="!transcribedText">
          Скачать текст
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { getWsUrl } from '../features/api/urls';
import {
  createRealtimeSession,
  mergeTranscription,
} from '../features/realtime/session';

const streamState = ref('idle');
const isStreaming = computed(() => streamState.value === 'streaming');
const isConnecting = computed(() => streamState.value === 'connecting');
const streamError = ref('');
const simpleStatusClass = computed(() => {
  if (isStreaming.value) return 'is-active';
  if (isConnecting.value) return 'is-connecting';
  if (streamError.value) return 'is-error';
  return 'is-ready';
});
const simpleStatusTitle = computed(() => {
  if (isStreaming.value) return 'Перевод идёт';
  if (isConnecting.value) return 'Подключаемся';
  if (streamError.value.includes('Камера')) return 'Камера недоступна';
  if (streamError.value.includes('сети')) return 'Нет соединения';
  if (streamError.value) return 'Перевод остановлен';
  return 'Камера готова';
});
const simpleStatusDescription = computed(() => {
  if (isStreaming.value) return 'Показывайте жесты по одному в центре кадра.';
  if (isConnecting.value) return 'Проверяем камеру и соединение с сервером.';
  if (streamError.value) return streamError.value;
  return 'Видео не отправляется, пока вы не начнёте перевод.';
});
const transcribedText = ref('');
const videoEl = ref(null);
const canvasEl = ref(null);
const textareaRef = ref(null);

const realtimeSession = createRealtimeSession({
  getVideoElement: () => videoEl.value,
  getCanvasElement: () => canvasEl.value,
  getSocketUrl: () => getWsUrl('socket'),
  onStateChange(nextState, reason) {
    streamState.value = nextState;

    if (nextState === 'connecting') {
      streamError.value = '';
    } else if (nextState === 'streaming') {
      streamError.value = '';
      transcribedText.value = '';
    } else if (reason === 'disconnected') {
      streamError.value = 'Соединение с сервером закрыто.';
    } else if (reason === 'error') {
      streamError.value = 'Ошибка соединения с сервером.';
    } else if (reason === 'camera-error') {
      streamError.value = 'Камера не найдена или доступ запрещён.';
    } else if (reason === 'offline') {
      streamError.value = 'Нет подключения к сети.';
    }
  },
  onMessage(message) {
    const nextText = mergeTranscription(transcribedText.value, message);
    if (nextText === transcribedText.value) return;

    transcribedText.value = nextText;
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.scrollTop = textareaRef.value.scrollHeight;
      }
    });
  },
  onError(error) {
    console.error('Realtime error:', error);
  },
});

onMounted(() => {
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('offline', handleConnectionLoss);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void initCamera();
});

onUnmounted(() => {
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('offline', handleConnectionLoss);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  realtimeSession.destroy();
});

function handlePageHide() {
  realtimeSession.stop('pagehide');
}

function handleConnectionLoss() {
  realtimeSession.stop('offline');
}

function handleVisibilityChange() {
  if (document.hidden) {
    realtimeSession.stop('hidden');
  }
}

async function initCamera() {
  try {
    await realtimeSession.prepareCamera();
  } catch (error) {
    console.error('Camera Init Error:', error);
    streamError.value = 'Камера не найдена или доступ запрещён.';
  }
}

function startStream() {
  if (streamState.value !== 'idle') return;
  void realtimeSession.start();
}

function stopStream() {
  realtimeSession.stop();
}

function downloadText() {
  if (!transcribedText.value) return;

  const blob = new Blob([transcribedText.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'перевод.txt';
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
</script>

<style scoped>
.simple-body {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --space-3xl: 48px;
  min-height: 100dvh;
  background: #f4f7f6;
  color: #2c3e50;
  font-family: 'Golos Text', 'Verdana', sans-serif;
  font-size: 1rem;
  line-height: 1.55;
  font-kerning: normal;
  display: flex;
  flex-direction: column;
}

.simple-skip-link {
  position: fixed;
  top: var(--space-sm);
  left: var(--space-sm);
  z-index: 100;
  transform: translateY(-160%);
  padding: var(--space-md) var(--space-lg);
  border-radius: 8px;
  background: #0056b3;
  color: white;
  font-weight: 700;
  text-decoration: none;
  transition: transform 160ms ease-out;
}

.simple-skip-link:focus {
  transform: translateY(0);
}

.simple-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  min-height: 76px;
  padding: var(--space-md) clamp(var(--space-lg), 4vw, var(--space-3xl));
  gap: var(--space-xl);
  border-bottom: 1px solid #dcdcdc;
  background: white;
}

.simple-brand {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  color: #0056b3;
}

.simple-brand > div {
  display: grid;
  gap: 1px;
}

.simple-header h1 {
  margin: 0;
  color: #0056b3;
  font-family: 'Onest', 'Verdana', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.simple-brand span {
  color: #383d41;
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.35;
}

.back-link {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: var(--space-sm) var(--space-lg);
  border: 2px solid #ccc;
  border-radius: 8px;
  background: #f9f9f9;
  color: #333;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  text-decoration: none;
}

.back-link:hover {
  background: #e2e6ea;
}

.simple-main {
  display: grid;
  gap: var(--space-xl);
  width: min(100%, 920px);
  max-width: none;
  margin: 0 auto;
  padding: clamp(var(--space-xl), 4vw, var(--space-3xl));
  box-sizing: border-box;
  flex: 1;
}

.status-bar {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
  margin: 0;
  padding: var(--space-lg) var(--space-xl);
  border: 2px solid #d6d8db;
  border-radius: 10px;
  background: #eef2f5;
  color: #383d41;
  font-size: 1rem;
  text-align: left;
  transition: border-color 160ms ease-out, background-color 160ms ease-out;
}

.status-bar > div {
  display: grid;
  gap: var(--space-xs);
}

.status-bar strong {
  font-family: 'Onest', 'Verdana', sans-serif;
  font-size: 1.25rem;
  line-height: 1.3;
}

.status-bar span:not(.simple-status-dot) {
  font-size: 1.0625rem;
  line-height: 1.5;
}

.simple-status-dot {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  margin-top: 7px;
  border-radius: 50%;
  background: #6c757d;
}

.status-bar.is-active {
  border-color: #c3e6cb;
  background: #d4edda;
  color: #155724;
}

.status-bar.is-active .simple-status-dot {
  background: #218838;
}

.status-bar.is-connecting {
  border-color: #0056b3;
}

.status-bar.is-connecting .simple-status-dot {
  background: #0056b3;
  animation: simple-pulse 1.4s ease-in-out infinite;
}

.status-bar.is-error {
  border-color: #c82333;
}

.status-bar.is-error .simple-status-dot {
  background: #c82333;
}

@keyframes simple-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.video-container {
  position: relative;
  aspect-ratio: 16 / 9;
  min-height: 260px;
  margin: 0;
  border: 4px solid #333;
  border-radius: 10px;
  background: #000;
  line-height: 0;
  overflow: hidden;
}

.video-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.controls {
  margin: 0;
}

.btn {
  width: 100%;
  min-height: 64px;
  padding: var(--space-lg) var(--space-xl);
  border: 0;
  border-radius: 10px;
  color: white;
  font-family: 'Onest', 'Verdana', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.35;
  text-transform: none;
  box-shadow: none;
  cursor: pointer;
  transition: background-color 160ms ease-out, transform 120ms ease-out;
}

.btn-start {
  background: #218838;
  box-shadow: none;
}

.btn-start:hover {
  background: #155724;
}

.btn-stop {
  background: #c82333;
  box-shadow: none;
}

.btn-stop:hover {
  background: #dc3545;
}

.btn:active {
  transform: translateY(1px);
  box-shadow: none !important;
}

.text-section {
  display: grid;
  gap: var(--space-md);
  padding-top: var(--space-sm);
}

.text-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-lg);
}

.text-section label {
  margin: 0;
  color: #2c3e50;
  font-family: 'Onest', 'Verdana', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
}

.text-heading span {
  color: #5a6268;
  font-size: 0.9375rem;
  line-height: 1.4;
}

.text-section textarea {
  width: 100%;
  min-height: 220px;
  height: 220px;
  padding: var(--space-lg);
  border: 3px solid #0056b3;
  border-radius: 8px;
  background: white;
  color: #2c3e50;
  font-family: 'Golos Text', 'Verdana', sans-serif;
  font-size: 1.375rem;
  line-height: 1.6;
  box-sizing: border-box;
  resize: vertical;
}

.text-section textarea::placeholder {
  color: #5a6268;
  opacity: 1;
}

.btn-download {
  width: 100%;
  min-height: 56px;
  margin: 0;
  padding: var(--space-md) var(--space-xl);
  border-radius: 8px;
  border: 0;
  background: #5a6268;
  color: white;
  font-family: 'Golos Text', 'Verdana', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-download:hover:not(:disabled) {
  background: #383d41;
}

.btn-download:disabled {
  background: #d6d8db;
  color: #5a6268;
  opacity: 1;
  cursor: not-allowed;
}

.simple-body :is(button, a, textarea):focus-visible {
  outline: 3px solid #0056b3;
  outline-offset: 3px;
}

@media (max-width: 640px) {
  .simple-header {
    align-items: stretch;
    padding:
      max(var(--space-lg), env(safe-area-inset-top))
      max(var(--space-lg), env(safe-area-inset-right))
      var(--space-lg)
      max(var(--space-lg), env(safe-area-inset-left));
    text-align: left;
  }

  .simple-brand {
    align-self: flex-start;
  }

  .back-link {
    justify-content: center;
    width: 100%;
  }

  .simple-main {
    gap: var(--space-lg);
    padding:
      var(--space-xl)
      max(var(--space-lg), env(safe-area-inset-right))
      max(var(--space-2xl), env(safe-area-inset-bottom))
      max(var(--space-lg), env(safe-area-inset-left));
  }

  .status-bar {
    padding: var(--space-lg);
  }

  .status-bar strong {
    font-size: 1.125rem;
  }

  .status-bar span:not(.simple-status-dot) {
    font-size: 1rem;
  }

  .video-container {
    min-height: 190px;
  }

  .btn {
    min-height: 60px;
    padding: var(--space-md) var(--space-lg);
    font-size: 1.125rem;
  }

  .text-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .text-section label {
    font-size: 1.375rem;
  }

  .text-section textarea {
    min-height: 240px;
    height: 240px;
    font-size: 1.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .simple-body *,
  .simple-body *::before,
  .simple-body *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
