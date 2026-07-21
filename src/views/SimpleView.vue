<template>
  <div class="simple-body">
    <a class="simple-skip-link" href="#simple-main">Перейти к переводчику</a>
    <header class="simple-header">
      <div class="simple-brand">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" />
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
        </svg>
        <div>
          <h1>Sigma Sign</h1>
          <span>Упрощённый режим</span>
        </div>
      </div>
      <router-link to="/" class="back-link"> ← Обычный режим </router-link>
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
        <canvas ref="canvasEl" width="854" height="480" style="display: none"></canvas>
      </div>

      <div class="controls">
        <button v-if="streamState === 'idle'" class="btn btn-start" @click="startStream">
          ▶ Начать перевод
        </button>
        <button v-else-if="isConnecting" class="btn btn-stop" @click="stopStream">
          Отменить подключение
        </button>
        <button v-else class="btn btn-stop" @click="stopStream">■ Остановить перевод</button>
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
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { getWsUrl } from '../features/api/urls'
import { createRealtimeSession, mergeTranscription } from '../features/realtime/session'

const streamState = ref('idle')
const isStreaming = computed(() => streamState.value === 'streaming')
const isConnecting = computed(() => streamState.value === 'connecting')
const streamError = ref('')
const simpleStatusClass = computed(() => {
  if (isStreaming.value) return 'is-active'
  if (isConnecting.value) return 'is-connecting'
  if (streamError.value) return 'is-error'
  return 'is-ready'
})
const simpleStatusTitle = computed(() => {
  if (isStreaming.value) return 'Перевод идёт'
  if (isConnecting.value) return 'Подключаемся'
  if (streamError.value.includes('Камера')) return 'Камера недоступна'
  if (streamError.value.includes('сети')) return 'Нет соединения'
  if (streamError.value) return 'Перевод остановлен'
  return 'Камера готова'
})
const simpleStatusDescription = computed(() => {
  if (isStreaming.value) return 'Показывайте жесты по одному в центре кадра.'
  if (isConnecting.value) return 'Проверяем камеру и соединение с сервером.'
  if (streamError.value) return streamError.value
  return 'Видео не отправляется, пока вы не начнёте перевод.'
})
const transcribedText = ref('')
const videoEl = ref(null)
const canvasEl = ref(null)
const textareaRef = ref(null)

const realtimeSession = createRealtimeSession({
  getVideoElement: () => videoEl.value,
  getCanvasElement: () => canvasEl.value,
  getSocketUrl: () => getWsUrl('socket'),
  onStateChange(nextState, reason) {
    streamState.value = nextState

    if (nextState === 'connecting') {
      streamError.value = ''
    } else if (nextState === 'streaming') {
      streamError.value = ''
      transcribedText.value = ''
    } else if (reason === 'disconnected') {
      streamError.value = 'Соединение с сервером закрыто.'
    } else if (reason === 'error') {
      streamError.value = 'Ошибка соединения с сервером.'
    } else if (reason === 'camera-error') {
      streamError.value = 'Камера не найдена или доступ запрещён.'
    } else if (reason === 'offline') {
      streamError.value = 'Нет подключения к сети.'
    }
  },
  onMessage(message) {
    const nextText = mergeTranscription(transcribedText.value, message)
    if (nextText === transcribedText.value) return

    transcribedText.value = nextText
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.scrollTop = textareaRef.value.scrollHeight
      }
    })
  },
  onError(error) {
    console.error('Realtime error:', error)
  },
})

onMounted(() => {
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('offline', handleConnectionLoss)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  void initCamera()
})

onUnmounted(() => {
  window.removeEventListener('pagehide', handlePageHide)
  window.removeEventListener('offline', handleConnectionLoss)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  realtimeSession.destroy()
})

function handlePageHide() {
  realtimeSession.stop('pagehide')
}

function handleConnectionLoss() {
  realtimeSession.stop('offline')
}

function handleVisibilityChange() {
  if (document.hidden) {
    realtimeSession.stop('hidden')
  }
}

async function initCamera() {
  try {
    await realtimeSession.prepareCamera()
  } catch (error) {
    console.error('Camera Init Error:', error)
    streamError.value = 'Камера не найдена или доступ запрещён.'
  }
}

function startStream() {
  if (streamState.value !== 'idle') return
  void realtimeSession.start()
}

function stopStream() {
  realtimeSession.stop()
}

function downloadText() {
  if (!transcribedText.value) return

  const blob = new Blob([transcribedText.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'перевод.txt'
  document.body.appendChild(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
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
  --violet: #6534c6;
  --violet-bright: #8053db;
  --violet-pale: #eee7ff;
  --simple-ink: #272138;
  --simple-muted: #595266;
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  min-height: 100dvh;
  background:
    radial-gradient(circle at 8% 6%, rgba(128, 83, 219, 0.14), transparent 27%),
    radial-gradient(circle at 94% 54%, rgba(0, 86, 179, 0.07), transparent 28%), #f6f3fb;
  color: var(--simple-ink);
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
  border-radius: 10px;
  background: var(--violet);
  color: #fbf9ff;
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
  border-bottom: 1px solid rgba(101, 52, 198, 0.18);
  background: rgba(252, 250, 255, 0.84);
  box-shadow:
    0 10px 34px rgba(57, 34, 89, 0.07),
    inset 0 -1px rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(16px) saturate(1.08);
}

.simple-brand {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  color: var(--violet);
}

.simple-brand > div {
  display: grid;
  gap: 1px;
}

.simple-header h1 {
  margin: 0;
  color: var(--violet);
  font-family: 'Onest', 'Verdana', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.simple-brand span {
  color: var(--simple-muted);
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.35;
}

.back-link {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: var(--space-sm) var(--space-lg);
  border: 2px solid rgba(101, 52, 198, 0.24);
  border-radius: 12px;
  background: rgba(238, 231, 255, 0.58);
  color: #4c258f;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  text-decoration: none;
  transition:
    background-color 180ms ease-out,
    border-color 180ms ease-out,
    transform 180ms var(--ease-out-quint);
}

.back-link:hover {
  border-color: rgba(101, 52, 198, 0.44);
  background: var(--violet-pale);
  transform: translateY(-1px);
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
  animation: simple-enter 620ms var(--ease-out-quint) both;
}

.status-bar {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
  margin: 0;
  padding: var(--space-lg) var(--space-xl);
  border: 2px solid #dad3e6;
  border-radius: 16px;
  background: rgba(246, 243, 251, 0.86);
  color: #393143;
  font-size: 1rem;
  text-align: left;
  box-shadow:
    0 12px 30px rgba(47, 28, 77, 0.06),
    inset 0 1px rgba(255, 255, 255, 0.8);
  transition:
    border-color 180ms ease-out,
    background-color 180ms ease-out,
    transform 180ms var(--ease-out-quint);
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
  border-color: var(--violet);
  background: var(--violet-pale);
  color: #35186d;
}

.status-bar.is-connecting .simple-status-dot {
  background: var(--violet);
  box-shadow: 0 0 0 5px rgba(101, 52, 198, 0.12);
  animation: simple-pulse 1.4s ease-in-out infinite;
}

.status-bar.is-error {
  border-color: #c82333;
}

.status-bar.is-error .simple-status-dot {
  background: #c82333;
}

@keyframes simple-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.video-container {
  position: relative;
  aspect-ratio: 16 / 9;
  min-height: 260px;
  margin: 0;
  isolation: isolate;
  border: 2px solid rgba(101, 52, 198, 0.78);
  border-radius: 26px 18px 26px 26px;
  background: #0b0911;
  line-height: 0;
  overflow: hidden;
  box-shadow:
    0 0 0 7px rgba(101, 52, 198, 0.09),
    0 24px 60px rgba(54, 28, 105, 0.18),
    inset 0 1px rgba(255, 255, 255, 0.18);
}

.video-container::before {
  position: absolute;
  inset: 0;
  z-index: 2;
  content: '';
  pointer-events: none;
  border-radius: inherit;
  background:
    linear-gradient(
      118deg,
      rgba(255, 255, 255, 0.18),
      transparent 12%,
      transparent 74%,
      rgba(128, 83, 219, 0.08)
    ),
    radial-gradient(circle at 92% 8%, rgba(255, 255, 255, 0.2), transparent 10%);
  -webkit-mask-image: linear-gradient(to bottom, black, transparent 24%, transparent 80%, black);
  mask-image: linear-gradient(to bottom, black, transparent 24%, transparent 80%, black);
}

.video-container::after {
  position: absolute;
  z-index: 1;
  top: -36%;
  right: -14%;
  width: 44%;
  aspect-ratio: 1;
  content: '';
  pointer-events: none;
  border-radius: 46% 54% 40% 60% / 57% 43% 57% 43%;
  background: rgba(128, 83, 219, 0.18);
  filter: blur(30px);
  animation: simple-liquid-drift 11s ease-in-out infinite alternate;
}

.video-container video {
  position: relative;
  z-index: 0;
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
  border-radius: 15px;
  color: #fbf9ff;
  font-family: 'Onest', 'Verdana', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.35;
  text-transform: none;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.24),
    0 14px 30px rgba(28, 68, 43, 0.14);
  cursor: pointer;
  transition:
    background-color 180ms ease-out,
    box-shadow 180ms ease-out,
    transform 180ms var(--ease-out-quint);
}

.btn-start {
  background: #1a7433;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.22),
    0 14px 32px rgba(26, 116, 51, 0.22);
}

.btn-start:hover {
  background: #125926;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.18),
    0 18px 36px rgba(18, 89, 38, 0.25);
  transform: translateY(-2px);
}

.btn-stop {
  background: #c82333;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.18),
    0 14px 32px rgba(200, 35, 51, 0.2);
}

.btn-stop:hover {
  background: #dc3545;
  transform: translateY(-2px);
}

.btn:active {
  transform: translateY(0) scale(0.99);
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
  color: var(--simple-ink);
  font-family: 'Onest', 'Verdana', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
}

.text-heading span {
  color: var(--simple-muted);
  font-size: 0.9375rem;
  line-height: 1.4;
}

.text-section textarea {
  width: 100%;
  min-height: 220px;
  height: 220px;
  padding: var(--space-lg);
  border: 3px solid var(--violet);
  border-radius: 14px;
  background: radial-gradient(circle at 100% 0, rgba(128, 83, 219, 0.07), transparent 26%), #fdfbff;
  color: var(--simple-ink);
  font-family: 'Golos Text', 'Verdana', sans-serif;
  font-size: 1.375rem;
  line-height: 1.6;
  box-sizing: border-box;
  resize: vertical;
  box-shadow:
    0 14px 34px rgba(57, 32, 98, 0.08),
    inset 0 1px rgba(255, 255, 255, 0.9);
}

.text-section textarea::placeholder {
  color: var(--simple-muted);
  opacity: 1;
}

.btn-download {
  width: 100%;
  min-height: 56px;
  margin: 0;
  padding: var(--space-md) var(--space-xl);
  border-radius: 13px;
  border: 0;
  background: var(--violet);
  color: #fbf9ff;
  font-family: 'Golos Text', 'Verdana', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.2),
    0 12px 28px rgba(101, 52, 198, 0.18);
  transition:
    background-color 180ms ease-out,
    transform 180ms var(--ease-out-quint),
    box-shadow 180ms ease-out;
}

.btn-download:hover:not(:disabled) {
  background: #4d239f;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.18),
    0 16px 34px rgba(77, 35, 159, 0.22);
  transform: translateY(-1px);
}

.btn-download:disabled {
  background: #ddd7e5;
  color: #625b6c;
  opacity: 1;
  cursor: not-allowed;
}

.simple-body :is(button, a, textarea):focus-visible {
  outline: 3px solid #6737c8;
  outline-offset: 3px;
}

@keyframes simple-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes simple-liquid-drift {
  from {
    opacity: 0.68;
    transform: translate3d(-2%, -2%, 0) rotate(-3deg);
  }
  to {
    opacity: 1;
    transform: translate3d(4%, 4%, 0) rotate(3deg);
  }
}

@media (max-width: 640px) {
  .simple-header {
    align-items: stretch;
    padding: max(var(--space-lg), env(safe-area-inset-top))
      max(var(--space-lg), env(safe-area-inset-right)) var(--space-lg)
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
    padding: var(--space-xl) max(var(--space-lg), env(safe-area-inset-right))
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
    min-height: 0;
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
