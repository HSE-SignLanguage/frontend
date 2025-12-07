<template>
  <div class="modern-view">
    <!-- Шапка (Логотип) -->
    <header class="app-header">
      <h1 class="logo">SIGMASIGN</h1>
    </header>

    <!-- Навигация (ПК версия - Вкладки сверху) -->
    <nav class="desktop-nav">
      <button 
        :class="{ active: currentTab === 'realtime' }" 
        @click="currentTab = 'realtime'"
      >
        В реальном времени
      </button>
      <button 
        :class="{ active: currentTab === 'file' }" 
        @click="currentTab = 'file'"
      >
        Из файла
      </button>
      <button 
        :class="{ active: currentTab === 'pensioners' }" 
        @click="currentTab = 'pensioners'"
      >
        Для пенсионеров
      </button>
    </nav>

    <!-- Основной контент -->
    <main class="content-area">
      
      <!-- Вкладка: В реальном времени -->
      <div v-if="currentTab === 'realtime'" class="tab-content">
        <div class="status-bar">{{ statusText || 'Готов к работе' }}</div>
        <div class="controls">
          <button class="btn btn-primary">▶ Старт</button>
          <button class="btn btn-danger">■ Стоп</button>
        </div>
      </div>

      <!-- Вкладка: Из файла (Основная логика) -->
      <div v-if="currentTab === 'file'" class="tab-content file-mode">
        
        <!-- Сценарий 1: Загрузка файла -->
        <div v-if="!uploadedFile && !jobId" class="upload-zone" @dragover.prevent @drop.prevent="handleDrop">
          <div class="upload-icon">📁</div>
          <h3>Нажмите для выбора видео</h3>
          <p>или перетащите файл сюда</p>
          <span class="file-types">MP4, WEBM, AVI, MOV</span>
          <input type="file" ref="fileInput" @change="handleFileSelect" hidden>
          <button class="btn-select" @click="$refs.fileInput.click()">Выбрать файл</button>
        </div>

        <!-- Сценарий 2: Файл выбран / Загрузка -->
        <div v-else-if="uploadedFile && !jobId" class="file-preview">
          <div class="file-info">
            <span class="icon">📄</span>
            <div>
              <div class="filename">{{ uploadedFile.name }}</div>
              <div class="filesize">{{ formatFileSize(uploadedFile.size) }}</div>
            </div>
          </div>
          
          <div class="progress-bar-container" v-if="isUploading">
            <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <div v-if="isUploading" class="progress-text">{{ uploadProgress }}%</div>

          <div class="actions">
            <button class="btn btn-primary" :disabled="isUploading" @click="startUpload">
              {{ isUploading ? 'Загрузка...' : 'Отправить на обработку' }}
            </button>
            <button class="btn btn-secondary" @click="resetUpload">Отмена</button>
          </div>
        </div>

        <!-- Сценарий 3: Обработка -->
        <div v-else-if="jobId && jobStatus !== 'completed'" class="processing-state">
          <h2>Обработка видео</h2>
          <p class="job-id">ID: {{ jobId.substring(0, 8) }}...</p>
          
          <div class="status-badge">{{ getStatusText(jobStatus) }}</div>
          
          <div class="stats">
            <p>Кадры: {{ jobData.processed_batches || 0 }} / {{ jobData.total_batches || '?' }}</p>
            <p v-if="jobError" class="error">Ошибка: {{ jobError }}</p>
            <p v-else>Загрузка...</p>
          </div>
        </div>

        <!-- Сценарий 4: Готово -->
        <div v-else-if="jobStatus === 'completed'" class="finished-state">
          <div class="success-icon">✅</div>
          <h2>Обработка завершена!</h2>
          <div class="result-actions">
            <button class="btn btn-outline" @click="showTranscript = !showTranscript">Показать расшифровку</button>
            <button class="btn btn-primary">Повторить</button>
            <button class="btn btn-secondary" @click="resetUpload">Новое видео</button>
          </div>

          <!-- Расшифровка -->
          <div v-if="showTranscript" class="transcript-box">
            <h3>Расшифровка {{ jobId.substring(0, 6) }}...</h3>
            <textarea readonly>Пример текста расшифровки...</textarea>
            <div class="transcript-actions">
              <button class="btn btn-small">Остановить опрос</button>
              <button class="btn btn-small">Save TXT</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Вкладка: Для пенсионеров -->
      <div v-if="currentTab === 'pensioners'" class="tab-content large-text">
        <h2>Режим для слабовидящих</h2>
        <p>Интерфейс увеличен для удобства.</p>
        <!-- Здесь может быть упрощенный интерфейс -->
      </div>

    </main>

    <!-- Навигация (МОБИЛЬНАЯ ВЕРСИЯ - Меню снизу как в YouTube/Viggle) -->
    <nav class="mobile-nav">
      <button 
        class="nav-item" 
        :class="{ active: currentTab === 'realtime' }" 
        @click="currentTab = 'realtime'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
        <span>Realtime</span>
      </button>
      
      <button 
        class="nav-item" 
        :class="{ active: currentTab === 'file' }" 
        @click="currentTab = 'file'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
        <span>Файл</span>
      </button>
      
      <button 
        class="nav-item" 
        :class="{ active: currentTab === 'pensioners' }" 
        @click="currentTab = 'pensioners'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path></svg>
        <span>Помощь</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';

// Состояние вкладок
const currentTab = ref('file'); // По умолчанию 'file', так как там больше всего контента

// Переменные состояния (восстановлены из вашего шаблона)
const statusText = ref('');
const uploadedFile = ref(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const jobId = ref('');
const jobStatus = ref('idle'); // idle, processing, completed
const jobError = ref('');
const showTranscript = ref(false);

const jobData = reactive({
  processed_batches: 0,
  total_batches: 100
});

// Хелперы
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getStatusText = (status) => {
  const map = {
    idle: 'Ожидание',
    processing: 'В работе...',
    completed: 'Готово'
  };
  return map[status] || status;
};

// Методы-заглушки (имитация логики)
const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) uploadedFile.value = file;
};

const handleDrop = (event) => {
  const file = event.dataTransfer.files[0];
  if (file) uploadedFile.value = file;
};

const startUpload = () => {
  isUploading.value = true;
  // Имитация загрузки
  let p = 0;
  const interval = setInterval(() => {
    p += 10;
    uploadProgress.value = p;
    if (p >= 100) {
      clearInterval(interval);
      isUploading.value = false;
      jobId.value = '12345678-abc'; // Фейковый ID
      jobStatus.value = 'processing';
      
      // Имитация обработки
      setTimeout(() => {
        jobStatus.value = 'completed';
      }, 2000);
    }
  }, 300);
};

const resetUpload = () => {
  uploadedFile.value = null;
  jobId.value = '';
  jobStatus.value = 'idle';
  uploadProgress.value = 0;
  jobError.value = '';
};
</script>

<style scoped>
/* --- Базовые стили --- */
.modern-view {
  font-family: 'Inter', sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 80px; /* Отступ снизу для мобильного меню */
  color: #333;
}

.app-header {
  padding: 1rem;
  text-align: center;
}

.logo {
  font-weight: 800;
  color: #2c3e50;
  margin: 0;
  letter-spacing: 2px;
}

/* --- Навигация Desktop (Вкладки сверху) --- */
.desktop-nav {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 1rem;
}

.desktop-nav button {
  background: none;
  border: none;
  font-size: 1rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.desktop-nav button.active {
  color: #007bff;
  border-bottom-color: #007bff;
  font-weight: 600;
}

/* --- Навигация Mobile (Скрыта по умолчанию) --- */
.mobile-nav {
  display: none; /* Скрыто на ПК */
}

/* --- Контент --- */
.content-area {
  padding: 0 1rem;
  max-width: 600px;
  margin: 0 auto;
}

.upload-zone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 3rem 1rem;
  text-align: center;
  background: #f9f9f9;
  cursor: pointer;
  transition: border-color 0.2s;
}

.upload-zone:hover {
  border-color: #007bff;
}

.file-types {
  display: block;
  font-size: 0.8rem;
  color: #999;
  margin-top: 0.5rem;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  margin: 0.2rem;
}

.btn-primary { background: #007bff; color: white; }
.btn-secondary { background: #e2e6ea; color: #333; }
.btn-danger { background: #dc3545; color: white; }
.btn-select { margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
.btn-outline { background: transparent; border: 1px solid #007bff; color: #007bff; }

/* Прогресс бар */
.progress-bar-container {
  height: 6px;
  background: #eee;
  border-radius: 3px;
  margin: 1rem 0;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #007bff;
  transition: width 0.3s;
}

/* Инфо о файле */
.file-preview {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.file-info .icon { font-size: 2rem; }
.filename { font-weight: 600; }
.filesize { font-size: 0.8rem; color: #666; }

/* Расшифровка */
.transcript-box {
  margin-top: 1rem;
  border: 1px solid #eee;
  padding: 1rem;
  border-radius: 8px;
}
.transcript-box textarea {
  width: 100%;
  height: 100px;
  margin-top: 0.5rem;
  padding: 0.5rem;
}

/* --- АДАПТИВНОСТЬ (Mobile Fix) --- */
@media (max-width: 768px) {
  /* 1. Скрываем верхние вкладки на мобильном */
  .desktop-nav {
    display: none;
  }

  /* 2. Показываем нижнюю панель (YouTube style) */
  .mobile-nav {
    display: flex;
    justify-content: space-around;
    align-items: center;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: #ffffff;
    border-top: 1px solid #e0e0e0;
    z-index: 1000;
    padding-bottom: env(safe-area-inset-bottom); /* Для iPhone X+ */
  }

  .nav-item {
    background: none;
    border: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #606060;
    font-size: 10px;
    gap: 4px;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .nav-item svg {
    width: 24px;
    height: 24px;
  }

  .nav-item.active {
    color: #0f0f0f; /* Более темный для актива */
  }
  
  .nav-item.active svg {
    stroke: #007bff; /* Или любой акцентный цвет */
  }

  /* 3. Корректируем контент, чтобы он не залезал под меню */
  .content-area {
    padding-bottom: 20px;
  }
  
  .modern-view {
    padding-bottom: 70px; /* Учитываем высоту меню */
  }

  .logo {
    font-size: 1.2rem;
  }
}
</style>
