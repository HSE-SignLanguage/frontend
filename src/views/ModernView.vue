<template>
  <div class="app-container">
    <a class="skip-link" href="#main-content" :inert="sidebarOpen">Перейти к переводчику</a>

    <header class="desktop-header" :inert="sidebarOpen">
      <router-link to="/" class="logo" aria-label="Sigma Sign, главная">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" />
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
        </svg>
        <span class="logo-wordmark">Sigma <strong>Sign</strong></span>
      </router-link>
      <nav aria-label="Режим перевода">
        <div class="mode-switch" role="group" aria-label="Источник видео">
          <button
            @click="setMode('camera')"
            :class="{ active: mode === 'camera' }"
            :aria-pressed="mode === 'camera'"
          >
            Камера
          </button>
          <button
            @click="setMode('upload')"
            :class="{ active: mode === 'upload' }"
            :aria-pressed="mode === 'upload'"
          >
            Видеофайл
          </button>
        </div>
        <router-link to="/simple/" class="nav-link">Упрощённый режим</router-link>
      </nav>
    </header>

    <header class="mobile-header" :inert="sidebarOpen">
      <router-link to="/" class="logo compact-logo" aria-label="Sigma Sign, главная">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" />
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
        </svg>
        <span class="logo-wordmark">Sigma <strong>Sign</strong></span>
      </router-link>
      <button
        ref="menuButtonRef"
        type="button"
        class="menu-toggle"
        @click="toggleSidebar"
        :aria-label="sidebarOpen ? 'Закрыть меню' : 'Открыть меню'"
        :aria-expanded="sidebarOpen"
        aria-controls="mobile-navigation-dialog"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
    </header>

    <Transition name="mobile-drawer">
      <div
        v-if="sidebarOpen"
        id="mobile-navigation-dialog"
        class="mobile-sidebar open"
        @keydown="handleSidebarKeydown"
      >
        <div class="sidebar-overlay" aria-hidden="true" @click="closeSidebar()"></div>
        <aside
          ref="sidebarDialogRef"
          class="sidebar-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-navigation-title"
          tabindex="-1"
        >
          <div class="sidebar-heading">
            <span id="mobile-navigation-title">Режим перевода</span>
            <button
              type="button"
              class="sidebar-close"
              data-drawer-autofocus
              @click="closeSidebar()"
              aria-label="Закрыть меню"
            >
              ×
            </button>
          </div>
          <nav class="sidebar-nav" aria-label="Режим перевода">
            <button @click="selectMobileMode('camera')" :class="{ active: mode === 'camera' }">
              Камера
            </button>
            <button @click="selectMobileMode('upload')" :class="{ active: mode === 'upload' }">
              Видеофайл
            </button>
            <router-link to="/simple/" class="nav-link" @click="closeSidebar()">
              Упрощённый режим
            </router-link>
          </nav>
        </aside>
      </div>
    </Transition>

    <main id="main-content" class="content-wrapper" :inert="sidebarOpen">
      <h1 class="visually-hidden">Sigma Sign — перевод русской жестовой речи</h1>

      <!-- РЕЖИМ КАМЕРЫ -->
      <div v-show="mode === 'camera'" class="video-viewport">
        <div class="video-ui-top" role="status" aria-live="polite" aria-atomic="true">
          <div class="recording-dot" :class="{ active: isStreaming }"></div>
          <div>
            <span class="status-name">{{ statusText }}</span>
            <span class="status-description">{{ statusDescription }}</span>
          </div>
        </div>

        <!-- Рамка трекинга (декоративная) -->
        <div class="hand-tracking-box" :class="{ active: isStreaming }"></div>

        <!-- Видео элемент -->
        <video ref="videoEl" autoplay playsinline muted></video>
        <!-- Скрытый холст для сжатия кадров -->
        <canvas ref="canvasEl" width="854" height="480" style="display: none"></canvas>

        <!-- Кнопки управления -->
        <div class="video-controls">
          <button
            class="stream-btn"
            :class="{ 'is-recording': isStreaming }"
            @click="toggleStream"
            :aria-pressed="isStreaming"
          >
            <span v-if="isConnecting">Отменить подключение</span>
            <span v-else-if="!isStreaming">▶ Начать распознавание</span>
            <span v-else>■ Остановить</span>
          </button>
        </div>
      </div>

      <!-- РЕЖИМ ЗАГРУЗКИ -->
      <div v-show="mode === 'upload'" class="video-viewport upload-viewport">
        <div
          v-if="!uploadedFile && !jobId"
          class="upload-zone"
          role="button"
          tabindex="0"
          aria-label="Выбрать видео для обработки"
          @click="triggerFileUpload"
          @keydown.enter.prevent="triggerFileUpload"
          @keydown.space.prevent="triggerFileUpload"
          :class="{ 'is-dragover': isDragOver }"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        >
          <input
            type="file"
            ref="fileInput"
            accept="video/*"
            @click.stop
            @change="handleFileSelect"
            style="display: none"
          />
          <svg
            width="50"
            height="50"
            viewBox="0 0 24 24"
            fill="none"
            class="upload-icon"
            stroke="currentColor"
            stroke-width="1"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <div class="upload-text">Выберите видео с жестами</div>
          <div class="upload-subtext">Нажмите или перетащите файл сюда</div>
          <div class="upload-formats">MP4 · WEBM · AVI · MOV · до 100 МиБ</div>
        </div>

        <div v-else-if="uploadedFile && !jobId" class="file-preview">
          <div class="file-info">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              class="file-icon"
              stroke="currentColor"
              stroke-width="1.5"
            >
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
            <button class="text-btn" @click="cancelUpload">Сбросить форму</button>
          </div>
          <p v-if="isUploading" class="upload-note" role="status">
            Сброс остановит ожидание ответа. Если сервер уже принял файл, обработка может
            продолжиться.
          </p>
        </div>

        <div v-else-if="jobId" class="job-status">
          <div class="status-header">
            <h3>Обработка видео</h3>
            <div class="job-id">ID: {{ jobId.substring(0, 8) }}...</div>
          </div>

          <div class="status-info">
            <div
              class="status-indicator"
              :class="jobStatus"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <div class="status-dot"></div>
              <span>{{ getStatusText(jobStatus) }}</span>
            </div>

            <div v-if="jobStatus === 'processing'" class="progress-details">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: processingProgress + '%' }"></div>
              </div>
              <div class="progress-text">
                <span v-if="jobData">
                  Обработано частей: {{ jobData.processed_batches || 0 }} из
                  {{ jobData.total_batches || '?' }}
                </span>
                <span v-else>Получаем состояние обработки…</span>
              </div>
            </div>

            <div v-if="jobError" class="error-message" role="alert">
              <svg
                class="error-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Ошибка: {{ jobError }}</span>
            </div>

            <div v-if="jobStatus === 'completed'" class="completion-info">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                class="completion-icon"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <p>Видео обработано</p>
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
          <div>
            <div class="panel-title">
              {{ mode === 'camera' ? 'Эфир распознавания' : 'Распознанный текст' }}
              <span v-if="mode === 'upload' && jobId" class="job-badge">
                {{ jobId.substring(0, 6) }}…
              </span>
            </div>
            <p v-if="mode === 'camera'" class="panel-caption">
              Показывайте жесты по одному. Между одинаковыми жестами сделайте короткую нейтральную
              паузу.
            </p>
            <p v-else class="panel-caption">Фразы появятся здесь после обработки видео.</p>
          </div>
          <div class="panel-actions">
            <button v-if="isPolling" class="polling-btn" @click="stopPolling">
              <span class="polling-dot"></span>
              Остановить опрос
            </button>
            <button class="export-btn" @click="downloadText" :disabled="!downloadableText">
              Скачать TXT
            </button>
          </div>
        </div>

        <div v-if="mode === 'camera'" class="live-transcript">
          <p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
            {{ liveAnnouncement }}
          </p>

          <section class="gesture-stream" aria-labelledby="gesture-stream-title">
            <div class="live-section-heading">
              <div>
                <h2 id="gesture-stream-title">Эфир жестов</h2>
                <span>Выход модели без редактуры</span>
              </div>
              <span v-if="liveTranscript.gestures.length" class="feed-count" aria-hidden="true">
                {{ liveTranscript.gestures.length }} / {{ MAX_GESTURE_FEED_ITEMS }}
              </span>
            </div>

            <TransitionGroup
              v-if="liveTranscript.gestures.length"
              name="gesture-feed"
              tag="ol"
              class="gesture-list"
              aria-label="Последние распознанные жесты"
            >
              <li
                v-for="(gesture, index) in liveTranscript.gestures"
                :key="gesture.sequenceKey || `${gesture.segmentId}-${gesture.text}-${index}`"
                class="gesture-chip"
              >
                <span>{{ gesture.text }}</span>
                <small v-if="gesture.confidence !== null">
                  {{ formatConfidence(gesture.confidence) }}
                </small>
              </li>
            </TransitionGroup>
            <p v-else class="gesture-empty">Здесь сразу появится первый распознанный жест.</p>
          </section>

          <section class="phrase-output" aria-labelledby="phrase-output-title">
            <div class="live-section-heading phrase-heading">
              <div>
                <h2 id="phrase-output-title">Связный текст</h2>
                <span>Черновик виден сразу, фраза оформляется позже</span>
              </div>
              <span
                class="phrase-status"
                :class="{
                  'is-formatting': liveTranscript.formatting.active,
                  'is-enhanced':
                    !liveTranscript.formatting.active && liveTranscript.finalKind === 'enhanced',
                }"
              >
                <span class="phrase-status-dot" aria-hidden="true"></span>
                {{ phraseStatusText }}
              </span>
            </div>

            <div class="phrase-stage" aria-live="off">
              <Transition name="phrase-rewrite">
                <p :key="liveTranscript.revision" class="phrase-copy">
                  <span v-if="liveTranscript.finalText" class="phrase-final">
                    {{ liveTranscript.finalText }}
                  </span>
                  <span v-if="liveTranscript.draftText" class="phrase-draft">
                    {{ liveTranscript.draftText }}
                  </span>
                  <span v-if="!liveTranscript.fullText" class="phrase-empty">
                    Начните распознавание и покажите короткую последовательность жестов.
                  </span>
                </p>
              </Transition>
            </div>

            <div v-if="liveTranscript.fullText || liveTranscript.truncated" class="phrase-footer">
              <div v-if="liveTranscript.fullText" class="phrase-legend" aria-hidden="true">
                <span
                  v-if="liveTranscript.finalText"
                  class="legend-final"
                  :class="{
                    'is-enhanced': liveTranscript.finalKind === 'enhanced',
                    'is-mixed': liveTranscript.finalKind === 'mixed',
                  }"
                >
                  {{ finalKindLabel }}
                </span>
                <span v-if="liveTranscript.draftText" class="legend-draft"> Черновик жестов </span>
              </div>
              <p v-if="liveTranscript.truncated" class="transcript-truncation">
                Начало длинной сессии скрыто: показан доступный хвост текста.
              </p>
            </div>
          </section>
        </div>

        <textarea
          v-else
          ref="textareaRef"
          class="transcription-area"
          readonly
          v-model="transcribedText"
          aria-label="Распознанный текст из видео"
          placeholder="Пока здесь пусто. Загрузите видео и дождитесь обработки."
        ></textarea>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { getApiUrl, getWsUrl } from '../features/api/urls'
import { diagnostics } from '../features/diagnostics/logger'
import { getRetryAfterDelay, isTerminalPollingStatus } from '../features/jobs/polling'
import { createRealtimeSession, mergeTranscription } from '../features/realtime/session'
import {
  MAX_GESTURE_FEED_ITEMS,
  createLiveTranscriptState,
  getLiveMessageAnnouncement,
  reduceLiveTranscript,
  shouldAnnounceLiveMessage,
} from '../features/realtime/transcript'

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024
const POLL_BASE_DELAY = 2_000
const POLL_MAX_DELAY = 10_000
const POLL_REQUEST_TIMEOUT = 10_000
const POLL_TOTAL_TIMEOUT = 15 * 60_000

// --- State ---
const mode = ref('camera') // 'camera' | 'upload'
const streamState = ref('idle')
const isStreaming = computed(() => streamState.value === 'streaming')
const isConnecting = computed(() => streamState.value === 'connecting')
const statusText = ref('Камера готова')
const statusDescription = computed(() => {
  if (streamState.value === 'connecting') {
    return 'Проверяем камеру и соединение с сервером'
  }
  if (streamState.value === 'streaming') {
    return 'Показывайте жесты по одному; между повторами нужна короткая пауза'
  }

  const descriptions = {
    'Камера недоступна': 'Разрешите доступ к камере в настройках браузера',
    'Ошибка соединения': 'Попробуйте подключиться ещё раз',
    'Соединение закрыто': 'Перевод остановлен, можно запустить снова',
    'Нет сети': 'Проверьте интернет-соединение',
  }
  return descriptions[statusText.value] || 'Видео не записывается и не отправляется'
})
const transcribedText = ref('')
const liveTranscript = ref(createLiveTranscriptState())
const liveAnnouncement = ref('')
const downloadableText = computed(() =>
  mode.value === 'camera' ? liveTranscript.value.fullText : transcribedText.value,
)
const phraseStatusText = computed(() => {
  if (liveTranscript.value.formatting.active) return 'ИИ оформляет фразу'
  if (liveTranscript.value.finalKind === 'enhanced') return 'Фраза оформлена'
  if (liveTranscript.value.finalKind === 'literal') return 'Дословный результат'
  if (liveTranscript.value.finalKind === 'mixed') return 'Частично оформлено'
  return 'Ждём жесты'
})
const finalKindLabel = computed(() => {
  if (liveTranscript.value.finalKind === 'enhanced') return 'Оформлено ИИ'
  if (liveTranscript.value.finalKind === 'literal') return 'Сохранено дословно'
  return 'Смешанный результат'
})
const uploadedFile = ref(null)
const jobId = ref(null)
const jobStatus = ref(null)
const jobData = ref(null)
const jobError = ref(null)
const uploadProgress = ref(0)
const isUploading = ref(false)
const isPolling = ref(false)
const isDragOver = ref(false)
const processingProgress = ref(0)
const sidebarOpen = ref(false)

// --- Refs ---
const videoEl = ref(null)
const canvasEl = ref(null)
const fileInput = ref(null)
const textareaRef = ref(null)
const menuButtonRef = ref(null)
const sidebarDialogRef = ref(null)

let uploadGeneration = 0
let uploadController = null
let pollGeneration = 0
let pollTimer = null
let pollController = null
let pollStartedAt = 0
let pollDelay = POLL_BASE_DELAY
let mobileViewportQuery = null

const realtimeSession = createRealtimeSession({
  getVideoElement: () => videoEl.value,
  getCanvasElement: () => canvasEl.value,
  getSocketUrl: () => getWsUrl('socket'),
  onStateChange(nextState, reason) {
    streamState.value = nextState

    if (nextState === 'connecting') {
      statusText.value = 'Подключаемся'
      resetLiveTranscript()
    } else if (nextState === 'streaming') {
      statusText.value = 'Распознавание идёт'
    } else if (reason === 'disconnected') {
      statusText.value = 'Соединение закрыто'
    } else if (reason === 'error') {
      statusText.value = 'Ошибка соединения'
    } else if (reason === 'camera-error') {
      statusText.value = 'Камера недоступна'
    } else if (reason === 'offline') {
      statusText.value = 'Нет сети'
    } else {
      statusText.value = 'Камера готова'
    }
  },
  onMessage(message) {
    const previousState = liveTranscript.value
    const nextState = reduceLiveTranscript(previousState, message)
    if (nextState === previousState) return

    liveTranscript.value = nextState
    updateLiveAnnouncement(previousState, nextState, message)
  },
  onError() {
    diagnostics.warn('realtime-failed')
  },
})

// --- Lifecycle ---
onMounted(() => {
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('offline', handleConnectionLoss)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  mobileViewportQuery = window.matchMedia?.('(max-width: 900px)') || null
  addMobileViewportListener(mobileViewportQuery)
})

onUnmounted(() => {
  window.removeEventListener('pagehide', handlePageHide)
  window.removeEventListener('offline', handleConnectionLoss)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  removeMobileViewportListener(mobileViewportQuery)
  mobileViewportQuery = null
  realtimeSession.destroy()
  abortUpload()
  stopPolling()
})

function handlePageHide() {
  realtimeSession.stop('pagehide')
  abortUpload()
  stopPolling()
}

function handleConnectionLoss() {
  realtimeSession.stop('offline')
}

function handleVisibilityChange() {
  if (document.hidden) {
    realtimeSession.stop('hidden')
  }
}

function handleMobileViewportChange(event) {
  if (!event.matches) {
    closeSidebar({ restoreFocus: false })
  }
}

function addMobileViewportListener(mediaQuery) {
  if (
    typeof mediaQuery?.addEventListener === 'function' &&
    typeof mediaQuery?.removeEventListener === 'function'
  ) {
    mediaQuery.addEventListener('change', handleMobileViewportChange)
  } else if (
    typeof mediaQuery?.addListener === 'function' &&
    typeof mediaQuery?.removeListener === 'function'
  ) {
    mediaQuery.addListener(handleMobileViewportChange)
  }
}

function removeMobileViewportListener(mediaQuery) {
  if (
    typeof mediaQuery?.addEventListener === 'function' &&
    typeof mediaQuery?.removeEventListener === 'function'
  ) {
    mediaQuery.removeEventListener('change', handleMobileViewportChange)
  } else if (
    typeof mediaQuery?.addListener === 'function' &&
    typeof mediaQuery?.removeListener === 'function'
  ) {
    mediaQuery.removeListener(handleMobileViewportChange)
  }
}

function setMode(newMode) {
  if (mode.value === newMode) return

  mode.value = newMode
  if (newMode === 'camera') {
    resetUpload()
  } else {
    realtimeSession.stop('mode-change')
  }
}

function toggleStream() {
  if (isConnecting.value || isStreaming.value) {
    realtimeSession.stop(isConnecting.value ? 'cancelled' : 'stopped')
  } else {
    void realtimeSession.start()
  }
}

function resetLiveTranscript() {
  liveTranscript.value = createLiveTranscriptState()
  liveAnnouncement.value = ''
}

function updateLiveAnnouncement(previousState, nextState, message) {
  if (!shouldAnnounceLiveMessage(previousState, nextState, message)) return
  liveAnnouncement.value = getLiveMessageAnnouncement(message)
}

function formatConfidence(confidence) {
  return `${Math.round(confidence * 100)}%`
}

// --- Upload Logic ---
function triggerFileUpload() {
  fileInput.value?.click()
}

function handleDragOver(e) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

function validateVideoFile(file) {
  if (!file || !file.type?.toLowerCase().startsWith('video/')) {
    return 'Пожалуйста, выберите видеофайл'
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return 'Размер видео не должен превышать 100 МиБ'
  }
  return null
}

function selectVideoFile(file) {
  const validationError = validateVideoFile(file)
  if (validationError) {
    jobError.value = validationError
    alert(validationError)
    return
  }

  uploadedFile.value = file
  jobError.value = null
}

function handleDrop(e) {
  e.preventDefault()
  isDragOver.value = false
  selectVideoFile(e.dataTransfer.files?.[0])
}

function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (file) {
    selectVideoFile(file)
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function abortUpload() {
  uploadGeneration += 1
  uploadController?.abort()
  uploadController = null
  isUploading.value = false
}

async function uploadVideo() {
  if (isUploading.value) return

  const file = uploadedFile.value
  const validationError = validateVideoFile(file)
  if (validationError) {
    jobError.value = validationError
    alert(validationError)
    return
  }

  const requestGeneration = ++uploadGeneration
  const controller = new AbortController()
  uploadController = controller
  isUploading.value = true
  uploadProgress.value = 0
  jobError.value = null

  const formData = new FormData()
  formData.append('video', file)
  formData.append('interval', '1')

  try {
    const response = await fetch(getApiUrl('upload'), {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    if (requestGeneration !== uploadGeneration) return
    if (!response.ok) {
      throw new Error(`Ошибка загрузки: ${response.status}`)
    }

    const data = await response.json()
    if (requestGeneration !== uploadGeneration) return
    if (!data.job_id) {
      throw new Error('Не получен ID задания')
    }

    uploadProgress.value = 100
    jobId.value = data.job_id
    jobStatus.value = data.status || 'queued'
    startPolling()
  } catch (error) {
    if (requestGeneration !== uploadGeneration || error.name === 'AbortError') return

    diagnostics.warn('upload-failed')
    jobError.value = error.message
    alert(`Ошибка загрузки: ${error.message}`)
  } finally {
    if (requestGeneration === uploadGeneration) {
      uploadController = null
      isUploading.value = false
    }
  }
}

function isCurrentPoll(requestGeneration, polledJobId) {
  return isPolling.value && pollGeneration === requestGeneration && jobId.value === polledJobId
}

function startPolling() {
  stopPolling()
  if (!jobId.value) return

  const requestGeneration = ++pollGeneration
  const polledJobId = jobId.value
  isPolling.value = true
  pollStartedAt = Date.now()
  pollDelay = POLL_BASE_DELAY
  void pollJobStatus(requestGeneration, polledJobId)
}

function schedulePoll(requestGeneration, polledJobId) {
  if (!isCurrentPoll(requestGeneration, polledJobId)) return

  pollTimer = setTimeout(() => {
    pollTimer = null
    void pollJobStatus(requestGeneration, polledJobId)
  }, pollDelay)
}

async function pollJobStatus(requestGeneration, polledJobId) {
  if (!isCurrentPoll(requestGeneration, polledJobId)) return

  if (Date.now() - pollStartedAt >= POLL_TOTAL_TIMEOUT) {
    jobStatus.value = 'failed'
    jobError.value = 'Превышено время ожидания обработки'
    stopPolling()
    return
  }

  const controller = new AbortController()
  pollController = controller
  let requestTimedOut = false
  const timeoutId = setTimeout(() => {
    requestTimedOut = true
    controller.abort()
  }, POLL_REQUEST_TIMEOUT)

  try {
    const response = await fetch(getApiUrl(`job/${encodeURIComponent(polledJobId)}`), {
      signal: controller.signal,
    })

    if (!isCurrentPoll(requestGeneration, polledJobId)) return
    if (isTerminalPollingStatus(response.status)) {
      jobStatus.value = 'failed'
      jobError.value =
        response.status === 404
          ? 'Задание не найдено'
          : `Запрос статуса отклонён сервером (${response.status})`
      stopPolling()
      return
    }
    if (response.status === 429) {
      jobError.value = 'Сервер занят. Ожидаем разрешённое время перед повтором...'
      pollDelay = getRetryAfterDelay(
        response.headers.get('Retry-After'),
        Math.min(pollDelay * 2, POLL_MAX_DELAY),
      )
      return
    }
    if (!response.ok) {
      throw new Error(`Сервер вернул статус ${response.status}`)
    }

    const data = await response.json()
    if (!isCurrentPoll(requestGeneration, polledJobId)) return

    jobData.value = data
    jobStatus.value = data.status
    jobError.value = data.error || null
    pollDelay = POLL_BASE_DELAY

    if (data.total_batches > 0) {
      processingProgress.value = Math.round(
        ((data.processed_batches || 0) / data.total_batches) * 100,
      )
    }

    if (data.status === 'completed') {
      stopPolling()
      loadTranscription()
    } else if (data.status === 'failed') {
      stopPolling()
    }
  } catch {
    if (!isCurrentPoll(requestGeneration, polledJobId)) return
    if (controller.signal.aborted && !requestTimedOut) return

    diagnostics.warn('polling-failed')
    jobError.value = requestTimedOut
      ? 'Сервер не ответил вовремя. Повторяем запрос...'
      : 'Ошибка получения статуса. Повторяем запрос...'
    pollDelay = Math.min(pollDelay * 2, POLL_MAX_DELAY)
  } finally {
    clearTimeout(timeoutId)
    if (pollController === controller) {
      pollController = null
    }
    schedulePoll(requestGeneration, polledJobId)
  }
}

function stopPolling() {
  pollGeneration += 1

  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  pollController?.abort()
  pollController = null
  isPolling.value = false
}

function loadTranscription() {
  let fullText = ''
  if (typeof jobData.value?.full_text === 'string') {
    fullText = jobData.value.full_text
  } else if (Array.isArray(jobData.value?.transcription)) {
    fullText = jobData.value.transcription.join(' ')
  }

  transcribedText.value = mergeTranscription('', { full_text: fullText })
}

function retryProcessing() {
  if (!uploadedFile.value) return

  jobId.value = null
  jobStatus.value = null
  jobData.value = null
  jobError.value = null
  processingProgress.value = 0
  transcribedText.value = ''
  void uploadVideo()
}

function cancelUpload() {
  resetUpload()
}

function resetUpload() {
  abortUpload()
  stopPolling()
  uploadedFile.value = null
  jobId.value = null
  jobStatus.value = null
  jobData.value = null
  jobError.value = null
  uploadProgress.value = 0
  isDragOver.value = false
  processingProgress.value = 0
  transcribedText.value = ''

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function getStatusText(status) {
  const statusMap = {
    queued: 'В очереди',
    processing: 'Обработка...',
    completed: 'Завершено',
    failed: 'Ошибка',
  }
  return statusMap[status] || status
}

// --- Sidebar ---
const SIDEBAR_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function toggleSidebar() {
  if (sidebarOpen.value) {
    closeSidebar()
  } else {
    openSidebar()
  }
}

function openSidebar() {
  if (sidebarOpen.value) return

  sidebarOpen.value = true
  void nextTick(() => {
    const dialog = sidebarDialogRef.value
    const initialTarget = dialog?.querySelector('[data-drawer-autofocus]') || dialog
    initialTarget?.focus()
  })
}

function closeSidebar({ restoreFocus = true } = {}) {
  if (!sidebarOpen.value) return

  sidebarOpen.value = false
  if (restoreFocus) {
    void nextTick(() => menuButtonRef.value?.focus())
  }
}

function handleSidebarKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeSidebar()
    return
  }
  if (event.key !== 'Tab') return

  const dialog = sidebarDialogRef.value
  const focusableElements = Array.from(dialog?.querySelectorAll(SIDEBAR_FOCUSABLE_SELECTOR) || [])
  if (!focusableElements.length) {
    event.preventDefault()
    dialog?.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements.at(-1)
  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

function selectMobileMode(newMode) {
  setMode(newMode)
  closeSidebar()
}

// --- Export ---
function downloadText() {
  const text = downloadableText.value
  if (!text) return

  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `transcription_${Date.now()}.txt`
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
/* Optical translation workspace: one liquid-glass focal surface */
.app-container {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --space-3xl: 48px;
  --ink: #f8f6ff;
  --ink-muted: #b8b1c9;
  --ink-subtle: #777184;
  --violet: #8d5cff;
  --violet-bright: #b18cff;
  --violet-solid: #6840c7;
  --cyan: #00f2ff;
  --cyan-soft: #8feef3;
  --green: #00ff88;
  --warning: #ffaa00;
  --danger: #ff4444;
  --surface-base: #0e0c16;
  --surface-panel: #0e0c18;
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  font-family: 'Golos Text', 'Segoe UI', sans-serif;
  font-kerning: normal;
  background:
    radial-gradient(circle at 10% -16%, rgba(141, 92, 255, 0.28), transparent 34%),
    radial-gradient(circle at 96% 116%, rgba(0, 242, 255, 0.12), transparent 30%),
    var(--surface-base);
  color: var(--ink);
  min-height: 100dvh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: var(--space-lg);
  gap: var(--space-lg);
  position: relative;
  overflow: hidden;
}

.app-container::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: '';
  pointer-events: none;
  opacity: 0.22;
  background-image: repeating-radial-gradient(
    circle at 18% 12%,
    rgba(255, 255, 255, 0.13) 0,
    rgba(255, 255, 255, 0.13) 0.6px,
    transparent 0.7px,
    transparent 6px
  );
  -webkit-mask-image: linear-gradient(to bottom, black, transparent 58%);
  mask-image: linear-gradient(to bottom, black, transparent 58%);
}

.skip-link {
  position: fixed;
  top: var(--space-sm);
  left: var(--space-sm);
  z-index: 1200;
  transform: translateY(-160%);
  background: var(--cyan);
  color: var(--surface-base);
  padding: var(--space-md) var(--space-lg);
  border-radius: 8px;
  font-weight: 700;
  text-decoration: none;
  transition: transform 160ms ease-out;
}

.skip-link:focus {
  transform: translateY(0);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.desktop-header {
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 64px;
  height: 64px;
  padding: 0 var(--space-xl);
  background: rgba(25, 21, 44, 0.84);
  border: 1px solid rgba(194, 170, 255, 0.18);
  border-radius: 18px;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px) saturate(1.15);
}

.mobile-header,
.mobile-sidebar {
  display: none;
}

.logo,
.compact-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-md);
  min-height: 44px;
  color: var(--ink);
  text-decoration: none;
}

.logo-wordmark {
  font-family: 'Onest', 'Segoe UI', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.logo .logo-wordmark {
  color: var(--ink);
  text-shadow: none;
}

.logo-wordmark strong {
  color: var(--cyan);
  font-weight: 700;
}

.logo span {
  text-shadow: none;
}

.desktop-header nav {
  display: flex;
  align-items: center;
  gap: var(--space-xl);
}

.mode-switch {
  display: flex;
  align-items: stretch;
  gap: var(--space-sm);
  min-height: 44px;
}

.desktop-header .mode-switch button,
.desktop-header .nav-link {
  min-height: 44px;
  margin: 0;
  padding: 0 var(--space-lg);
  border: 0;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--ink-muted);
  font-family: 'Golos Text', 'Segoe UI', sans-serif;
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.4;
  text-shadow: none;
  transition:
    color 180ms ease-out,
    border-color 180ms ease-out,
    background-color 180ms ease-out,
    transform 180ms var(--ease-out-quint);
}

.desktop-header .mode-switch button.active {
  color: var(--ink);
  border-color: rgba(194, 170, 255, 0.34);
  background: var(--violet-solid);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.18),
    0 8px 22px rgba(77, 42, 153, 0.28);
  text-shadow: none;
}

.desktop-header .nav-link {
  display: inline-flex;
  align-items: center;
  padding-inline: var(--space-md);
}

.desktop-header .nav-link:hover,
.desktop-header .mode-switch button:hover {
  color: var(--ink);
  background: rgba(141, 92, 255, 0.14);
  transform: translateY(-1px);
  text-shadow: none;
}

.content-wrapper {
  position: relative;
  isolation: isolate;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 28vw);
  gap: 10px;
  padding: 10px;
  flex: 1;
  min-height: 0;
  height: auto;
  border: 1px solid rgba(214, 197, 255, 0.24);
  border-radius: 30px 30px 20px 30px;
  background:
    linear-gradient(
      115deg,
      rgba(255, 255, 255, 0.11),
      transparent 19%,
      transparent 76%,
      rgba(141, 92, 255, 0.12)
    ),
    rgba(31, 25, 52, 0.56);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.18),
    inset 0 -1px rgba(113, 75, 190, 0.14),
    0 30px 90px rgba(6, 3, 18, 0.5),
    0 0 42px rgba(103, 58, 190, 0.1);
  backdrop-filter: blur(22px) saturate(1.22);
  animation: workspace-enter 680ms var(--ease-out-quint) both;
}

.content-wrapper::before {
  position: absolute;
  z-index: -1;
  top: -96px;
  left: 4%;
  width: min(46vw, 560px);
  height: 220px;
  content: '';
  pointer-events: none;
  border-radius: 48% 52% 62% 38% / 38% 48% 52% 62%;
  background: radial-gradient(
    ellipse at center,
    rgba(141, 92, 255, 0.38),
    rgba(93, 52, 171, 0.1) 52%,
    transparent 72%
  );
  filter: blur(28px);
  animation: liquid-drift 12s ease-in-out infinite alternate;
}

.content-wrapper::after {
  position: absolute;
  z-index: 4;
  inset: 1px;
  content: '';
  pointer-events: none;
  border-radius: inherit;
  background:
    linear-gradient(
      112deg,
      rgba(255, 255, 255, 0.2),
      transparent 13%,
      transparent 84%,
      rgba(177, 140, 255, 0.12)
    ),
    radial-gradient(circle at 92% 8%, rgba(255, 255, 255, 0.16), transparent 11%);
  -webkit-mask-image: linear-gradient(to bottom, black, transparent 20%, transparent 80%, black);
  mask-image: linear-gradient(to bottom, black, transparent 20%, transparent 80%, black);
  opacity: 0.78;
}

.video-viewport {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: var(--space-xl);
  border: 1px solid rgba(231, 222, 255, 0.14);
  border-radius: 22px 16px 16px 22px;
  background:
    radial-gradient(circle at 22% 18%, rgba(141, 92, 255, 0.14), transparent 34%), #08070d;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.07),
    0 14px 32px rgba(7, 3, 18, 0.34);
  overflow: hidden;
}

.video-viewport::after {
  position: absolute;
  inset: 0;
  z-index: 2;
  content: '';
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(
    122deg,
    rgba(255, 255, 255, 0.055),
    transparent 24%,
    transparent 78%,
    rgba(141, 92, 255, 0.055)
  );
}

.video-viewport video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.video-ui-top {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  top: var(--space-xl);
  left: var(--space-xl);
  right: var(--space-xl);
  width: fit-content;
  max-width: calc(100% - 48px);
  padding: var(--space-md) var(--space-lg);
  gap: var(--space-md);
  border: 1px solid rgba(226, 214, 255, 0.24);
  border-radius: 16px 16px 16px 8px;
  background: rgba(15, 12, 27, 0.68);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.12),
    0 12px 30px rgba(5, 3, 13, 0.26);
  backdrop-filter: blur(16px) saturate(1.22);
}

.video-ui-top > div:last-child {
  display: grid;
  gap: 2px;
}

.recording-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-subtle);
  box-shadow: 0 0 0 4px rgba(119, 113, 132, 0.16);
}

.recording-dot.active {
  background: var(--danger);
  box-shadow:
    0 0 0 5px rgba(255, 68, 68, 0.18),
    0 0 18px rgba(255, 68, 68, 0.36);
  animation: pulse 1.6s ease-in-out infinite;
}

.video-ui-top .status-name {
  color: var(--ink);
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0;
  text-transform: none;
}

.video-ui-top .status-description {
  color: var(--ink-muted);
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: 0;
  text-transform: none;
}

.hand-tracking-box {
  position: absolute;
  z-index: 3;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(38%, 320px);
  height: min(48%, 320px);
  border: 1px dashed rgba(214, 197, 255, 0.3);
  border-radius: 22px;
  box-shadow: 0 0 0 1px rgba(141, 92, 255, 0.04) inset;
  pointer-events: none;
  transition:
    border-color 220ms ease-out,
    box-shadow 220ms ease-out,
    transform 220ms var(--ease-out-quint);
}

.hand-tracking-box.active {
  border-color: var(--cyan);
  box-shadow:
    0 0 0 1px rgba(0, 242, 255, 0.16) inset,
    0 0 28px rgba(0, 242, 255, 0.14);
  transform: translate(-50%, -50%) scale(1.015);
}

.video-controls {
  position: absolute;
  z-index: 5;
  left: 50%;
  transform: translateX(-50%);
  bottom: var(--space-xl);
  width: max-content;
  max-width: calc(100% - 48px);
}

.stream-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: var(--space-md) var(--space-xl);
  border: 1px solid rgba(113, 255, 186, 0.7);
  border-radius: 15px;
  background: #00d876;
  color: #07170f;
  font-family: 'Golos Text', 'Segoe UI', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0;
  text-transform: none;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.35),
    0 12px 28px rgba(0, 216, 118, 0.24);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition:
    background-color 180ms ease-out,
    color 180ms ease-out,
    border-color 180ms ease-out,
    box-shadow 180ms ease-out,
    transform 180ms var(--ease-out-quint);
}

.stream-btn:hover:not(:disabled) {
  background: var(--green);
  color: #06140e;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.38),
    0 16px 36px rgba(0, 255, 136, 0.3);
  transform: translateY(-2px);
}

.stream-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.985);
}

.stream-btn.is-recording {
  border-color: var(--danger);
  background: rgba(64, 16, 30, 0.9);
  color: #ff9aaa;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.1),
    0 12px 28px rgba(255, 68, 68, 0.16);
}

.stream-btn.is-recording:hover {
  background: var(--danger);
  color: var(--ink);
  box-shadow: 0 16px 34px rgba(255, 68, 68, 0.24);
}

.stream-btn:disabled,
.text-btn:disabled,
.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-viewport {
  flex-direction: column;
  background:
    radial-gradient(circle at 78% 20%, rgba(141, 92, 255, 0.16), transparent 36%), #131020;
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 720px;
  min-height: 300px;
  padding: var(--space-3xl) var(--space-xl);
  gap: var(--space-md);
  border: 1px dashed rgba(194, 170, 255, 0.42);
  border-radius: 22px 12px 22px 22px;
  background: rgba(12, 10, 21, 0.48);
  text-align: center;
  cursor: pointer;
  transition:
    border-color 220ms ease-out,
    background-color 220ms ease-out,
    transform 220ms var(--ease-out-quint),
    box-shadow 220ms ease-out;
}

.upload-zone:hover,
.upload-zone.is-dragover {
  border-color: var(--violet-bright);
  background: rgba(66, 37, 123, 0.25);
  box-shadow: 0 18px 48px rgba(39, 18, 82, 0.24);
  transform: translateY(-2px);
}

.upload-zone svg {
  width: 44px;
  height: 44px;
  margin-bottom: var(--space-sm);
  stroke: var(--violet-bright);
  filter: drop-shadow(0 8px 18px rgba(141, 92, 255, 0.24));
}

.upload-text {
  margin: 0;
  color: var(--ink);
  font-family: 'Onest', 'Segoe UI', sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.35;
}

.upload-subtext,
.upload-formats {
  color: var(--ink-muted);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.upload-formats {
  margin-top: var(--space-sm);
  font-size: 0.8125rem;
}

.file-preview,
.job-status {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 720px;
  gap: var(--space-xl);
}

.file-info {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-xl);
  border: 1px solid rgba(194, 170, 255, 0.18);
  border-radius: 18px;
  background: rgba(15, 12, 26, 0.72);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.06);
}

.file-icon,
.completion-icon {
  color: var(--green);
}

.error-icon {
  color: var(--danger);
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name,
.file-size {
  margin: 0;
}

.file-name {
  margin-bottom: var(--space-xs);
}

.file-name {
  overflow-wrap: anywhere;
  font-family: 'Onest', 'Segoe UI', sans-serif;
  font-size: 1.125rem;
}

.file-size,
.progress-text,
.upload-note {
  color: var(--ink-muted);
}

.progress-bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(218, 205, 255, 0.12);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--violet);
  box-shadow: 0 0 18px rgba(141, 92, 255, 0.34);
  transition: width 180ms ease-out;
}

.upload-progress,
.progress-details {
  display: grid;
  gap: var(--space-sm);
}

.progress-text {
  font-size: 0.875rem;
  text-align: center;
}

.btn-group {
  display: flex;
  align-items: stretch;
  gap: var(--space-md);
  margin: 0;
}

.text-btn,
.polling-btn,
.export-btn {
  min-height: 44px;
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid rgba(194, 170, 255, 0.24);
  border-radius: 12px;
  background: rgba(141, 92, 255, 0.08);
  color: var(--ink);
  font-family: 'Golos Text', 'Segoe UI', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 180ms ease-out,
    border-color 180ms ease-out,
    transform 180ms var(--ease-out-quint);
}

.text-btn:hover:not(:disabled),
.polling-btn:hover,
.export-btn:hover:not(:disabled) {
  border-color: rgba(194, 170, 255, 0.56);
  background: rgba(141, 92, 255, 0.18);
  color: var(--ink);
  transform: translateY(-1px);
}

.upload-note {
  max-width: 65ch;
  margin: calc(var(--space-md) * -1) auto 0;
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid rgba(194, 170, 255, 0.16);
}

.status-header h3 {
  margin: 0;
  font-family: 'Onest', 'Segoe UI', sans-serif;
  font-size: 1.25rem;
}

.job-id,
.job-badge {
  font-family: 'Golos Text', 'Segoe UI', sans-serif;
  font-variant-numeric: tabular-nums;
}

.job-id {
  color: var(--ink-muted);
  font-size: 0.8125rem;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.status-indicator,
.error-message,
.completion-info {
  border-radius: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg);
  border: 1px solid rgba(194, 170, 255, 0.16);
  background: rgba(14, 12, 24, 0.72);
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #888;
}

.status-indicator.queued {
  border-color: var(--warning);
}
.status-indicator.processing {
  border-color: var(--violet-bright);
}
.status-indicator.completed {
  border-color: var(--green);
}
.status-indicator.failed {
  border-color: var(--danger);
}
.status-indicator.queued .status-dot {
  background: var(--warning);
}
.status-indicator.processing .status-dot {
  background: var(--violet-bright);
  animation: pulse 1.4s ease-in-out infinite;
}
.status-indicator.completed .status-dot {
  background: var(--green);
}
.status-indicator.failed .status-dot {
  background: var(--danger);
}

.error-message {
  display: flex;
  align-items: flex-start;
  line-height: 1.5;
  gap: var(--space-md);
  padding: var(--space-lg);
  border: 1px solid rgba(255, 68, 68, 0.3);
  background: rgba(255, 68, 68, 0.1);
  color: #ff8888;
}

.completion-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  border: 1px solid rgba(0, 255, 136, 0.2);
  background: rgba(0, 255, 136, 0.05);
  color: var(--green);
  text-align: center;
}

.completion-info p {
  margin: 0;
  font-weight: 600;
}

.transcription-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: var(--space-xl);
  border: 1px solid rgba(214, 197, 255, 0.13);
  border-radius: 16px 22px 22px 16px;
  background: rgba(20, 16, 35, 0.88);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.07),
    0 14px 34px rgba(7, 3, 18, 0.22);
  backdrop-filter: blur(12px) saturate(1.12);
  animation: panel-enter 580ms 90ms var(--ease-out-quint) both;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-lg);
  margin: 0 0 var(--space-lg);
}

.panel-header > div:first-child {
  min-width: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--ink);
  font-family: 'Onest', 'Segoe UI', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  text-transform: none;
}

.panel-title::before {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  content: '';
  border-radius: 50% 40% 52% 46%;
  background: var(--violet-bright);
  box-shadow:
    0 0 0 5px rgba(141, 92, 255, 0.12),
    0 0 20px rgba(141, 92, 255, 0.32);
}

.panel-caption {
  max-width: 36ch;
  margin: var(--space-xs) 0 0;
  color: var(--ink-muted);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.job-badge {
  flex: 0 0 auto;
  border-radius: 4px;
  padding: 2px 6px;
  background: rgba(141, 92, 255, 0.2);
  color: #d3beff;
  font-size: 0.75rem;
}

.panel-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: var(--space-sm);
}

.polling-btn {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  white-space: nowrap;
}

.polling-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--violet-bright);
  box-shadow: 0 0 14px rgba(141, 92, 255, 0.46);
  animation: pulse 1.4s ease-in-out infinite;
}

.live-transcript {
  display: grid;
  grid-template-rows: minmax(132px, 0.72fr) minmax(210px, 1.28fr);
  flex: 1;
  min-height: 0;
  gap: var(--space-md);
  overflow: hidden;
}

.gesture-stream,
.phrase-output {
  min-width: 0;
  min-height: 0;
  padding: var(--space-lg);
  border: 1px solid rgba(194, 170, 255, 0.16);
  background: var(--surface-panel);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.04);
}

.gesture-stream {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  border-radius: 14px 14px 10px 14px;
  background:
    radial-gradient(circle at 100% 0, rgba(0, 242, 255, 0.07), transparent 30%),
    var(--surface-panel);
}

.phrase-output {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--space-md);
  border-color: rgba(177, 140, 255, 0.24);
  border-radius: 10px 14px 18px 14px;
  background:
    radial-gradient(circle at 100% 0, rgba(141, 92, 255, 0.13), transparent 34%),
    var(--surface-panel);
}

.live-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.live-section-heading > div:first-child {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.live-section-heading h2 {
  margin: 0;
  color: var(--ink);
  font-family: 'Onest', 'Segoe UI', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.live-section-heading > div > span {
  color: var(--ink-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}

.feed-count {
  flex: 0 0 auto;
  color: var(--cyan-soft);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}

.gesture-list {
  display: flex;
  align-content: flex-start;
  flex-wrap: wrap;
  min-height: 0;
  margin: 0;
  padding: 0 2px 2px 0;
  gap: var(--space-sm);
  list-style: none;
  overflow: auto;
  scrollbar-color: rgba(177, 140, 255, 0.4) transparent;
}

.gesture-chip {
  display: inline-flex;
  align-items: baseline;
  max-width: 100%;
  padding: 6px 9px;
  gap: 6px;
  border: 1px solid rgba(0, 242, 255, 0.24);
  border-radius: 8px 10px 10px 8px;
  background: rgba(0, 242, 255, 0.07);
  color: #dbfcff;
  font-size: 0.875rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.gesture-chip small {
  flex: 0 0 auto;
  color: var(--cyan-soft);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}

.gesture-empty,
.phrase-empty {
  margin: 0;
  color: var(--ink-muted);
  font-size: 0.875rem;
  line-height: 1.55;
}

.gesture-empty {
  margin-block: auto;
}

.phrase-heading {
  display: grid;
}

.phrase-status {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  min-height: 24px;
  padding: 3px 8px;
  gap: 6px;
  border: 1px solid rgba(194, 170, 255, 0.18);
  border-radius: 999px;
  background: rgba(141, 92, 255, 0.08);
  color: var(--ink-muted);
  font-size: 0.6875rem;
  line-height: 1.35;
  white-space: nowrap;
}

.phrase-status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--ink-subtle);
}

.phrase-status.is-formatting {
  border-color: rgba(177, 140, 255, 0.42);
  background: rgba(141, 92, 255, 0.16);
  color: #dbcaff;
}

.phrase-status.is-formatting .phrase-status-dot {
  background: var(--violet-bright);
  box-shadow: 0 0 10px rgba(177, 140, 255, 0.46);
}

.phrase-status.is-enhanced {
  border-color: rgba(0, 255, 136, 0.28);
  background: rgba(0, 255, 136, 0.07);
  color: #a3f6cb;
}

.phrase-status.is-enhanced .phrase-status-dot {
  background: var(--green);
}

.phrase-stage {
  display: grid;
  min-height: 0;
  padding: var(--space-sm) 2px;
  overflow: auto;
  scrollbar-color: rgba(177, 140, 255, 0.4) transparent;
}

.phrase-copy {
  grid-area: 1 / 1;
  align-self: start;
  margin: 0;
  color: var(--ink);
  font-size: 1.0625rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.phrase-final {
  color: var(--ink);
}

.phrase-draft {
  border-radius: 5px;
  background: rgba(141, 92, 255, 0.13);
  color: #d8c8ff;
  box-shadow: 0 0 0 3px rgba(141, 92, 255, 0.13);
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

.phrase-final + .phrase-draft::before {
  content: ' ';
}

.phrase-footer {
  display: grid;
  gap: var(--space-sm);
}

.phrase-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  color: var(--ink-muted);
  font-size: 0.6875rem;
  line-height: 1.35;
}

.phrase-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.phrase-legend span::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  content: '';
  border-radius: 50%;
}

.legend-final::before {
  background: var(--ink-subtle);
}

.legend-final.is-enhanced::before {
  background: var(--green);
}

.legend-final.is-mixed::before {
  background: var(--violet-bright);
}

.legend-draft::before {
  background: var(--violet-bright);
}

.transcript-truncation {
  margin: 0;
  padding-top: var(--space-sm);
  border-top: 1px solid rgba(194, 170, 255, 0.14);
  color: var(--ink-muted);
  font-size: 0.6875rem;
  line-height: 1.45;
}

.gesture-feed-enter-active,
.phrase-rewrite-enter-active,
.phrase-rewrite-leave-active {
  transition:
    opacity 240ms var(--ease-out-quint),
    transform 240ms var(--ease-out-quint);
}

.gesture-feed-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

.phrase-rewrite-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.phrase-rewrite-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.transcription-area {
  flex: 1;
  width: 100%;
  min-height: 180px;
  padding: var(--space-lg);
  border: 1px solid rgba(194, 170, 255, 0.18);
  border-radius: 14px 14px 18px 14px;
  background:
    radial-gradient(circle at 100% 0, rgba(141, 92, 255, 0.09), transparent 28%),
    var(--surface-panel);
  color: var(--ink);
  font-family: 'Golos Text', 'Segoe UI', sans-serif;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.65;
  resize: none;
  outline: none;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.04);
  transition:
    border-color 180ms ease-out,
    box-shadow 180ms ease-out;
}

.transcription-area:focus {
  border-color: rgba(177, 140, 255, 0.56);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.05),
    0 0 0 4px rgba(141, 92, 255, 0.1);
}

.transcription-area::placeholder {
  color: var(--ink-muted);
  opacity: 1;
}

.app-container :is(button, a, [role='button'], textarea):focus-visible {
  outline: 3px solid #c5a8ff;
  outline-offset: 3px;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@keyframes workspace-enter {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.992);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes panel-enter {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes liquid-drift {
  from {
    opacity: 0.72;
    transform: translate3d(-1.5%, -1%, 0) rotate(-2deg);
  }
  to {
    opacity: 1;
    transform: translate3d(3%, 3%, 0) rotate(3deg);
  }
}

@media (max-width: 1100px) {
  .content-wrapper {
    grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
  }

  .panel-header {
    flex-direction: column;
  }
}

@media (min-width: 901px) and (max-height: 720px) {
  .app-container {
    height: auto;
    min-height: 720px;
    overflow: visible;
  }

  .content-wrapper {
    min-height: 600px;
  }
}

@media (max-width: 900px) {
  .app-container {
    height: auto;
    min-height: 100dvh;
    overflow: visible;
    padding: max(var(--space-md), env(safe-area-inset-top))
      max(var(--space-md), env(safe-area-inset-right))
      max(var(--space-xl), env(safe-area-inset-bottom))
      max(var(--space-md), env(safe-area-inset-left));
    gap: var(--space-md);
  }

  .desktop-header {
    display: none;
  }

  .mobile-header {
    display: flex;
    justify-content: space-between;
    min-height: 60px;
    height: auto;
    padding: 0 var(--space-md);
    border: 1px solid rgba(194, 170, 255, 0.2);
    border-radius: 17px;
    background: rgba(25, 21, 44, 0.86);
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(14px) saturate(1.14);
  }

  .compact-logo {
    display: inline-flex;
  }

  .menu-toggle,
  .sidebar-close {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid rgba(194, 170, 255, 0.26);
    border-radius: 12px;
    background: rgba(141, 92, 255, 0.1);
    color: var(--ink);
    backdrop-filter: blur(10px);
  }

  .mobile-sidebar {
    position: fixed;
    inset: 0;
    display: block;
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 180ms ease-out,
      visibility 180ms ease-out;
  }

  .mobile-sidebar.open {
    opacity: 1;
    visibility: visible;
  }

  .mobile-drawer-enter-active,
  .mobile-drawer-leave-active {
    transition: opacity 180ms ease-out;
  }

  .mobile-sidebar.open.mobile-drawer-enter-from,
  .mobile-sidebar.open.mobile-drawer-leave-to {
    opacity: 0;
  }

  .mobile-sidebar.open.mobile-drawer-enter-from .sidebar-content,
  .mobile-sidebar.open.mobile-drawer-leave-to .sidebar-content {
    transform: translateX(-100%);
  }

  .sidebar-overlay {
    position: absolute;
    inset: 0;
    background: rgba(7, 4, 17, 0.72);
    backdrop-filter: blur(8px);
  }

  .sidebar-content {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(320px, 88vw);
    padding: max(var(--space-xl), env(safe-area-inset-top)) var(--space-xl)
      max(var(--space-xl), env(safe-area-inset-bottom));
    border-right: 1px solid rgba(194, 170, 255, 0.22);
    background:
      radial-gradient(circle at 0 0, rgba(141, 92, 255, 0.26), transparent 36%),
      rgba(16, 13, 27, 0.96);
    box-shadow:
      28px 0 70px rgba(4, 2, 12, 0.48),
      inset -1px 0 rgba(255, 255, 255, 0.06);
    transform: translateX(-100%);
    transition: transform 220ms ease-out;
  }

  .mobile-sidebar.open .sidebar-content {
    left: 0;
    transform: translateX(0);
    transition: transform 220ms ease-out;
  }

  .sidebar-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-lg);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-family: 'Onest', 'Segoe UI', sans-serif;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding-top: var(--space-lg);
  }

  .sidebar-nav button,
  .sidebar-nav .nav-link {
    display: flex;
    align-items: center;
    min-height: 48px;
    margin: 0;
    padding: var(--space-md) var(--space-lg);
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    font-family: 'Golos Text', 'Segoe UI', sans-serif;
    font-size: 1rem;
    color: var(--ink-muted);
    cursor: pointer;
    text-align: left;
    text-decoration: none;
    text-shadow: none;
  }

  .sidebar-nav button.active {
    border-color: rgba(194, 170, 255, 0.3);
    background: var(--violet-solid);
    color: var(--ink);
    box-shadow:
      inset 0 1px rgba(255, 255, 255, 0.14),
      0 12px 26px rgba(64, 32, 128, 0.24);
    text-shadow: none;
  }

  .sidebar-nav .nav-link:hover,
  .sidebar-nav button:hover {
    background: rgba(141, 92, 255, 0.16);
    text-shadow: none;
  }

  .content-wrapper {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 7px;
    height: auto;
    min-height: 0;
    border-radius: 23px 23px 18px 23px;
    backdrop-filter: blur(16px) saturate(1.16);
  }

  .video-viewport {
    width: 100%;
    height: clamp(320px, 52dvh, 460px);
    padding: var(--space-lg);
    border-radius: 17px 14px 14px 17px;
  }

  .video-ui-top {
    top: var(--space-lg);
    left: var(--space-lg);
    right: var(--space-lg);
    width: auto;
    max-width: none;
  }

  .hand-tracking-box {
    width: min(66%, 260px);
    height: min(52%, 260px);
  }

  .video-controls {
    bottom: var(--space-lg);
    width: calc(100% - 32px);
    max-width: none;
  }

  .video-controls .stream-btn {
    width: 100%;
  }

  .upload-viewport {
    height: auto;
    min-height: 420px;
  }

  .upload-zone {
    min-height: 300px;
    padding: var(--space-2xl) var(--space-lg);
  }

  .file-info {
    flex-direction: row;
    text-align: left;
  }

  .btn-group {
    flex-direction: column;
  }

  .transcription-panel {
    min-height: 340px;
    padding: var(--space-lg);
    border-radius: 14px 14px 17px 17px;
  }

  .live-transcript {
    grid-template-rows: auto auto;
    overflow: visible;
  }

  .gesture-stream {
    min-height: 148px;
  }

  .phrase-output {
    min-height: 220px;
  }

  .panel-header {
    flex-direction: row;
  }
}

@media (max-width: 560px) {
  .logo-wordmark {
    font-size: 1rem;
  }

  .video-viewport {
    height: 360px;
  }

  .video-ui-top .status-description {
    max-width: 29ch;
  }

  .panel-header {
    flex-direction: column;
  }

  .panel-actions,
  .panel-actions .export-btn,
  .panel-actions .polling-btn {
    width: 100%;
  }

  .gesture-stream,
  .phrase-output {
    padding: var(--space-md);
  }

  .phrase-copy {
    font-size: 1rem;
  }

  .file-info {
    flex-direction: column;
    text-align: center;
  }
}

@media (pointer: coarse) {
  .app-container :is(button, a, [role='button']) {
    min-height: 48px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-container *,
  .app-container *::before,
  .app-container *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
