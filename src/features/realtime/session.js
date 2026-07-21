const DEFAULT_FPS = 24;
const MAX_BUFFERED_BYTES = 64 * 1024;
const DEFAULT_CAMERA_TIMEOUT_MS = 20_000;
const DEFAULT_SOCKET_TIMEOUT_MS = 10_000;

export const MAX_TRANSCRIPTION_LENGTH = 20_000;

function stopTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function mergeTranscription(currentText, message) {
  const fullText = typeof message?.full_text === 'string' ? message.full_text.trim() : '';
  const delta = typeof message?.text === 'string' ? message.text.trim() : '';

  let nextText = currentText;
  if (fullText) {
    nextText = fullText;
  } else if (delta) {
    nextText = `${currentText.trimEnd()} ${delta}`.trimStart();
  }

  return nextText.length > MAX_TRANSCRIPTION_LENGTH
    ? nextText.slice(-MAX_TRANSCRIPTION_LENGTH)
    : nextText;
}

export function createRealtimeSession({
  getVideoElement,
  getCanvasElement,
  getSocketUrl,
  onStateChange,
  onMessage,
  onError,
  fps = DEFAULT_FPS,
  cameraTimeoutMs = DEFAULT_CAMERA_TIMEOUT_MS,
  socketTimeoutMs = DEFAULT_SOCKET_TIMEOUT_MS,
  mediaDevices = globalThis.navigator?.mediaDevices,
  createWebSocket = (url) => new WebSocket(url),
}) {
  let state = 'idle';
  let generation = 0;
  let cameraGeneration = 0;
  let mediaStream = null;
  let cameraPromise = null;
  let socket = null;
  let socketConnectTimer = null;
  let cancelScheduledFrame = null;
  let activeEncode = null;
  let lastFrameAt = 0;
  let disposed = false;

  const frameInterval = 1000 / fps;

  function setState(nextState, reason) {
    state = nextState;
    onStateChange(nextState, reason);
  }

  function isCurrent(sessionGeneration, candidateSocket = socket) {
    return !disposed
      && generation === sessionGeneration
      && socket === candidateSocket;
  }

  function detachAndCloseSocket(candidateSocket, code = 1000, reason = 'Stopped') {
    if (!candidateSocket) return;

    candidateSocket.onopen = null;
    candidateSocket.onmessage = null;
    candidateSocket.onerror = null;
    candidateSocket.onclose = null;

    if (candidateSocket.readyState === 0 || candidateSocket.readyState === 1) {
      candidateSocket.close(code, reason);
    }
  }

  function clearSocketConnectTimer() {
    if (socketConnectTimer !== null) {
      clearTimeout(socketConnectTimer);
      socketConnectTimer = null;
    }
  }

  function cancelFrameScheduler() {
    if (cancelScheduledFrame) {
      cancelScheduledFrame();
      cancelScheduledFrame = null;
    }
  }

  function releaseCamera() {
    cameraGeneration += 1;
    cameraPromise = null;

    const stream = mediaStream;
    mediaStream = null;
    stopTracks(stream);

    const video = getVideoElement();
    if (video?.srcObject === stream) {
      video.srcObject = null;
    }
  }

  async function prepareCamera() {
    if (disposed) return null;

    if (mediaStream?.getVideoTracks().some((track) => track.readyState === 'live')) {
      return mediaStream;
    }

    if (cameraPromise) return cameraPromise;
    if (!mediaDevices?.getUserMedia) {
      throw new Error('Camera API is not available');
    }

    const requestGeneration = ++cameraGeneration;
    const request = mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    });

    let timeoutId = null;
    const guardedRequest = request.then((stream) => {
      if (disposed || requestGeneration !== cameraGeneration) {
        stopTracks(stream);
        return null;
      }

      stopTracks(mediaStream);
      mediaStream = stream;

      const video = getVideoElement();
      if (video) {
        video.srcObject = stream;
      }

      return stream;
    });

    const timeoutRequest = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (requestGeneration === cameraGeneration) {
          cameraGeneration += 1;
        }

        const error = new Error('Camera permission request timed out');
        error.name = 'TimeoutError';
        reject(error);
      }, cameraTimeoutMs);
    });

    const pendingRequest = Promise.race([guardedRequest, timeoutRequest]);
    cameraPromise = pendingRequest;

    try {
      return await pendingRequest;
    } finally {
      clearTimeout(timeoutId);
      if (cameraPromise === pendingRequest) {
        cameraPromise = null;
      }
    }
  }

  function requestNextFrame(video, callback) {
    if (typeof video.requestVideoFrameCallback === 'function') {
      const frameId = video.requestVideoFrameCallback((timestamp) => callback(timestamp));
      return () => video.cancelVideoFrameCallback?.(frameId);
    }

    if (typeof requestAnimationFrame === 'function') {
      const frameId = requestAnimationFrame((timestamp) => callback(timestamp));
      return () => cancelAnimationFrame(frameId);
    }

    const timerId = setTimeout(() => callback(now()), frameInterval);
    return () => clearTimeout(timerId);
  }

  function captureFrame(sessionGeneration, candidateSocket, timestamp) {
    if (!isCurrent(sessionGeneration, candidateSocket) || state !== 'streaming') return;
    if (timestamp - lastFrameAt < frameInterval || activeEncode) return;
    if (candidateSocket.bufferedAmount > MAX_BUFFERED_BYTES) return;

    const video = getVideoElement();
    const canvas = getCanvasElement();
    if (!video || !canvas || video.readyState < 2) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    lastFrameAt = timestamp;
    const encode = { sessionGeneration };
    activeEncode = encode;

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (activeEncode === encode) {
          activeEncode = null;
        }

        if (
          !blob
          || !isCurrent(sessionGeneration, candidateSocket)
          || state !== 'streaming'
          || candidateSocket.readyState !== 1
          || candidateSocket.bufferedAmount > MAX_BUFFERED_BYTES
        ) {
          return;
        }

        try {
          candidateSocket.send(blob);
        } catch (error) {
          if (isCurrent(sessionGeneration, candidateSocket)) {
            onError(error);
            finishSession(sessionGeneration, candidateSocket, 'error');
          }
        }
      }, 'image/jpeg', 0.5);
    } catch (error) {
      if (activeEncode === encode) {
        activeEncode = null;
      }
      onError(error);
    }
  }

  function scheduleFrame(sessionGeneration, candidateSocket) {
    if (!isCurrent(sessionGeneration, candidateSocket) || state !== 'streaming') return;

    const video = getVideoElement();
    if (!video) return;

    cancelScheduledFrame = requestNextFrame(video, (timestamp) => {
      cancelScheduledFrame = null;
      captureFrame(sessionGeneration, candidateSocket, timestamp);
      scheduleFrame(sessionGeneration, candidateSocket);
    });
  }

  function finishSession(sessionGeneration, candidateSocket, reason) {
    if (!isCurrent(sessionGeneration, candidateSocket)) return;

    generation += 1;
    clearSocketConnectTimer();
    cancelFrameScheduler();
    activeEncode = null;
    socket = null;
    detachAndCloseSocket(candidateSocket, reason === 'error' ? 1011 : 1000, reason);
    releaseCamera();
    setState('idle', reason);
  }

  async function start() {
    if (disposed || state !== 'idle') return false;

    const sessionGeneration = ++generation;
    let failureReason = 'camera-error';
    setState('connecting', 'start');

    try {
      const stream = await prepareCamera();
      if (disposed || generation !== sessionGeneration) return false;
      if (!stream) {
        generation += 1;
        releaseCamera();
        setState('idle', 'camera-error');
        return false;
      }

      failureReason = 'error';
      const candidateSocket = createWebSocket(getSocketUrl());
      if (disposed || generation !== sessionGeneration) {
        detachAndCloseSocket(candidateSocket);
        return false;
      }

      socket = candidateSocket;
      socketConnectTimer = setTimeout(() => {
        if (!isCurrent(sessionGeneration, candidateSocket) || state !== 'connecting') return;

        const error = new Error('WebSocket connection timed out');
        error.name = 'TimeoutError';
        onError(error);
        finishSession(sessionGeneration, candidateSocket, 'error');
      }, socketTimeoutMs);

      candidateSocket.onopen = () => {
        if (!isCurrent(sessionGeneration, candidateSocket)) {
          detachAndCloseSocket(candidateSocket);
          return;
        }

        clearSocketConnectTimer();
        lastFrameAt = 0;
        setState('streaming', 'connected');
        scheduleFrame(sessionGeneration, candidateSocket);
      };

      candidateSocket.onmessage = (event) => {
        if (!isCurrent(sessionGeneration, candidateSocket)) return;

        try {
          onMessage(JSON.parse(event.data));
        } catch (error) {
          console.warn('WS message parse error:', error);
        }
      };

      candidateSocket.onerror = () => {
        if (!isCurrent(sessionGeneration, candidateSocket)) return;
        onError(new Error('WebSocket connection error'));
        finishSession(sessionGeneration, candidateSocket, 'error');
      };

      candidateSocket.onclose = () => {
        finishSession(sessionGeneration, candidateSocket, 'disconnected');
      };

      return true;
    } catch (error) {
      if (disposed || generation !== sessionGeneration) return false;
      onError(error);

      generation += 1;
      clearSocketConnectTimer();
      cancelFrameScheduler();
      activeEncode = null;
      const candidateSocket = socket;
      socket = null;
      detachAndCloseSocket(candidateSocket, 1011, 'error');
      releaseCamera();
      setState('idle', failureReason);
      return false;
    }
  }

  function stop(reason = 'stopped') {
    generation += 1;
    clearSocketConnectTimer();
    cancelFrameScheduler();
    activeEncode = null;

    const candidateSocket = socket;
    socket = null;
    detachAndCloseSocket(candidateSocket, 1000, reason);
    releaseCamera();

    if (state !== 'idle') {
      setState('idle', reason);
    }
  }

  function destroy() {
    stop('destroyed');
    disposed = true;
  }

  return {
    destroy,
    prepareCamera,
    releaseCamera,
    start,
    stop,
  };
}
